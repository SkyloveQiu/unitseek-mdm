import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db, require_admin
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.sync import ConnectionStatusOut
from app.services.android_management import AndroidManagementService
from app.services.audit import record_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enterprise", tags=["Enterprise"])


def _get_amapi_service() -> AndroidManagementService:
    return AndroidManagementService(
        credentials_path=settings.GCP_CREDENTIALS_PATH,
        project_id=settings.GCP_PROJECT_ID,
    )


# --- Schemas ---


class EnterpriseStatusOut(BaseModel):
    is_linked: bool
    enterprise_id: str | None = None
    enterprise_display_name: str | None = None


class SignupUrlOut(BaseModel):
    signup_url: str
    callback_url: str


class EnterpriseCallbackIn(BaseModel):
    enterprise_token: str = Field(..., min_length=1)


class EnterpriseOut(BaseModel):
    enterprise_id: str
    enterprise_display_name: str | None = None
    status: str


class DisconnectOut(BaseModel):
    status: str


# --- Endpoints ---


@router.get("/connection", response_model=ConnectionStatusOut)
async def get_connection_status(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return non-sensitive enterprise and AMAPI connection state for the UI."""
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    ).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    linked_enterprise = (
        tenant.enterprise_id
        if tenant.enterprise_id and not tenant.enterprise_id.startswith("pending:")
        else None
    )
    return ConnectionStatusOut(
        enterprise_id=linked_enterprise,
        enterprise_display_name=tenant.enterprise_display_name if linked_enterprise else None,
        google_cloud_project=settings.GCP_PROJECT_ID or None,
        mode=settings.AMAPI_MODE,
        connection_status=tenant.amapi_connection_status,
        last_successful_api_communication=tenant.last_amapi_success_at,
        last_error=tenant.last_amapi_error,
        last_sync_started_at=tenant.last_sync_started_at,
        last_sync_completed_at=tenant.last_sync_completed_at,
    )


@router.get("/status", response_model=EnterpriseStatusOut)
async def get_enterprise_status(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Check if the tenant has a linked Google Enterprise."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    is_linked = bool(tenant.enterprise_id) and not (tenant.enterprise_id or "").startswith("pending:")
    return EnterpriseStatusOut(
        is_linked=is_linked,
        enterprise_id=tenant.enterprise_id if is_linked else None,
        enterprise_display_name=tenant.enterprise_display_name if is_linked else None,
    )


@router.post("/signup-url", response_model=SignupUrlOut)
async def create_signup_url(
    callback_url: str = Query(
        ...,
        description="URL where Google will redirect after enterprise signup",
    ),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a Google Enterprise signup URL.
    The admin opens this URL, signs in with their Google account,
    and Google redirects back to callback_url with an enterprise token.
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if tenant.enterprise_id and not tenant.enterprise_id.startswith("pending:"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Enterprise already linked. Disconnect first to re-link.",
        )

    amapi = _get_amapi_service()

    # Google requires HTTPS callback URLs.
    # Force HTTPS for the Google API call (production always uses HTTPS;
    # for local dev, Google redirects to https:// which the user can
    # manually change to http:// to complete the flow).
    google_callback = callback_url.replace("http://", "https://", 1)

    signup_data = await amapi.create_signup_url(callback_url=google_callback)

    if not signup_data:
        raise HTTPException(
            status_code=500,
            detail="Failed to create signup URL",
        )

    # Store the signup URL name in the tenant for later use in complete_signup.
    # Google requires the signupUrlName when creating the enterprise.
    signup_url_name = signup_data.get("name", "")
    if signup_url_name:
        tenant.enterprise_id = f"pending:{signup_url_name}"
        db.add(tenant)
        await db.flush()

    await record_audit_event(
        db,
        tenant_id=tenant.id,
        user=current_user,
        action="enterprise.signup_requested",
        resource_type="tenant",
        resource_id=tenant.id,
        details={"callback_url": google_callback},
    )

    return SignupUrlOut(
        signup_url=signup_data.get("url", ""),
        callback_url=google_callback,
    )


@router.post("/complete-signup", response_model=EnterpriseOut)
async def complete_enterprise_signup(
    data: EnterpriseCallbackIn,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Complete the enterprise signup after the admin returns from Google.
    Takes the enterprise_token from the Google redirect and creates
    the enterprise binding.
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Extract signupUrlName stored during signup-url creation
    signup_url_name = ""
    if tenant.enterprise_id and tenant.enterprise_id.startswith("pending:"):
        signup_url_name = tenant.enterprise_id.replace("pending:", "", 1)
    elif tenant.enterprise_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Enterprise already linked",
        )

    amapi = _get_amapi_service()
    enterprise = await amapi.complete_signup(
        enterprise_token=data.enterprise_token,
        signup_url_name=signup_url_name,
        contact_email=tenant.contact_email or current_user.email,
    )

    if not enterprise:
        raise HTTPException(
            status_code=500,
            detail="Failed to create enterprise from signup token",
        )

    enterprise_name = enterprise.get("name", "")
    tenant.enterprise_id = enterprise_name
    tenant.enterprise_display_name = enterprise.get("enterpriseDisplayName") or None
    db.add(tenant)
    await db.flush()
    await db.refresh(tenant)

    logger.info(
        f"Enterprise linked: {enterprise_name} for tenant {tenant.name} (id={tenant.id})"
    )
    await record_audit_event(
        db,
        tenant_id=tenant.id,
        user=current_user,
        action="enterprise.linked",
        resource_type="enterprise",
        resource_id=enterprise_name,
    )

    return EnterpriseOut(
        enterprise_id=enterprise_name,
        enterprise_display_name=tenant.enterprise_display_name,
        status="linked",
    )


@router.delete("/disconnect", response_model=DisconnectOut)
async def disconnect_enterprise(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Disconnect the Google Enterprise from this tenant.
    This only removes the local binding, it does NOT delete the enterprise on Google.
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if not tenant.enterprise_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No enterprise linked",
        )

    old_id = tenant.enterprise_id
    tenant.enterprise_id = None
    tenant.enterprise_display_name = None
    db.add(tenant)
    await db.flush()

    logger.info(
        f"Enterprise disconnected: {old_id} from tenant {tenant.name} (id={tenant.id})"
    )
    await record_audit_event(
        db,
        tenant_id=tenant.id,
        user=current_user,
        action="enterprise.disconnected",
        resource_type="enterprise",
        resource_id=old_id,
    )

    return DisconnectOut(status="disconnected")

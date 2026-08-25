import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db, require_approved
from app.models.policy import Policy
from app.models.managed_application import ManagedApplication
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.apps import WebTokenRequest, WebTokenResponse
from app.schemas.managed_application import (
    ManagedApplicationOut,
    ManagedApplicationUpdate,
)
from app.services.android_management import AndroidManagementService
from app.services.audit import record_audit_event
from app.services.policy_management import (
    app_entry_from_managed_app,
    enable_single_app_kiosk,
    publish_policy,
    replace_application_in_policy,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/apps", tags=["Applications"])


def _get_amapi_service() -> AndroidManagementService:
    return AndroidManagementService(
        credentials_path=settings.GCP_CREDENTIALS_PATH,
        project_id=settings.GCP_PROJECT_ID,
    )


async def _get_tenant(user: User, db: AsyncSession) -> Tenant:
    """Get the tenant for the current user."""
    if not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a tenant",
        )
    result = await db.execute(
        select(Tenant).where(Tenant.id == user.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )
    return tenant


def _configured_policy_ids(app: ManagedApplication) -> list[int]:
    value = (app.metadata_json or {}).get("policy_ids", [])
    return [int(item) for item in value if isinstance(item, int) or str(item).isdigit()]


def _managed_app_out(app: ManagedApplication) -> ManagedApplicationOut:
    return ManagedApplicationOut(
        id=app.id,
        tenant_id=app.tenant_id,
        package_name=app.package_name,
        display_name=app.display_name,
        install_type=app.install_type,
        auto_update_mode=app.auto_update_mode,
        is_required=app.is_required,
        is_kiosk_app=app.is_kiosk_app,
        last_known_version=app.last_known_version,
        last_sync_at=app.last_sync_at,
        metadata_json=app.metadata_json,
        policy_ids=_configured_policy_ids(app),
        created_at=app.created_at,
        updated_at=app.updated_at,
    )


async def _publish_changed_policy(
    policy: Policy, tenant: Tenant, db: AsyncSession
) -> None:
    if not tenant.enterprise_id or tenant.enterprise_id.startswith("pending:"):
        return
    try:
        await publish_policy(policy, tenant, _get_amapi_service())
    except Exception as exc:
        logger.warning("Policy publication failed for policy %s: %s", policy.id, type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google policy publication failed; local change was not saved.",
        ) from exc


@router.get("", response_model=list[ManagedApplicationOut])
async def list_managed_applications(
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """List private/public Managed Google Play apps configured by this tenant."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User is not assigned to a tenant")
    apps = (
        await db.execute(
            select(ManagedApplication)
            .where(ManagedApplication.tenant_id == current_user.tenant_id)
            .order_by(ManagedApplication.package_name)
        )
    ).scalars().all()
    return [_managed_app_out(app) for app in apps]


@router.post("/web-token", response_model=WebTokenResponse)
async def create_web_token(
    req: WebTokenRequest,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a web token for the Managed Google Play iframe.
    Requires the tenant to have an enterprise_id linked.
    """
    tenant = await _get_tenant(current_user, db)

    if not tenant.enterprise_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enterprise not linked. Connect your Google Enterprise first in Settings > Tenant.",
        )

    amapi = _get_amapi_service()
    token_data = await amapi.create_web_token(
        enterprise_name=tenant.enterprise_id,
        parent_frame_url=req.parent_frame_url,
    )

    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create web token",
        )

    token_value = token_data.get("value", "")
    iframe_url = f"https://play.google.com/work/embedded/search?token={token_value}&mode=SELECT"

    return WebTokenResponse(token=token_value, iframe_url=iframe_url)


@router.put("/{package_name}", response_model=ManagedApplicationOut)
async def configure_managed_application(
    package_name: str,
    app_data: ManagedApplicationUpdate,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Configure a Managed Google Play app and apply it to selected policies.

    New applications default to the required private-app behavior requested for
    the product: ``FORCE_INSTALLED`` plus ``AUTO_UPDATE_HIGH_PRIORITY``.
    """
    tenant = await _get_tenant(current_user, db)
    package_name = package_name.strip().lower()
    labels = package_name.split(".")
    if len(labels) < 2 or any(not label.replace("_", "").isalnum() for label in labels):
        raise HTTPException(status_code=422, detail="package_name must be a valid Android package name")

    app = (
        await db.execute(
            select(ManagedApplication).where(
                ManagedApplication.tenant_id == tenant.id,
                ManagedApplication.package_name == package_name,
            )
        )
    ).scalar_one_or_none()
    created = app is None
    if app is None:
        app = ManagedApplication(tenant_id=tenant.id, package_name=package_name)

    for field, value in app_data.model_dump(exclude_unset=True, exclude={"policy_ids", "managed_configuration", "accessible_track_ids"}).items():
        setattr(app, field, value)

    old_metadata = dict(app.metadata_json or {})
    old_policy_ids = set(_configured_policy_ids(app))
    target_policy_ids = (
        set(app_data.policy_ids)
        if app_data.policy_ids is not None
        else old_policy_ids
    )
    all_policy_ids = old_policy_ids | target_policy_ids
    policies_by_id: dict[int, Policy] = {}
    if all_policy_ids:
        policies = (
            await db.execute(
                select(Policy).where(
                    Policy.id.in_(all_policy_ids),
                    Policy.tenant_id == tenant.id,
                )
            )
        ).scalars().all()
        policies_by_id = {policy.id: policy for policy in policies}
        missing_ids = all_policy_ids - set(policies_by_id)
        if missing_ids:
            raise HTTPException(status_code=404, detail="One or more policies were not found")

    managed_configuration = (
        app_data.managed_configuration
        if "managed_configuration" in app_data.model_fields_set
        else old_metadata.get("managed_configuration")
    )
    metadata = dict(old_metadata)
    metadata["policy_ids"] = sorted(target_policy_ids)
    accessible_track_ids = (
        app_data.accessible_track_ids
        if "accessible_track_ids" in app_data.model_fields_set
        else old_metadata.get("accessible_track_ids", [])
    )
    if accessible_track_ids:
        metadata["accessible_track_ids"] = accessible_track_ids
    else:
        metadata.pop("accessible_track_ids", None)
    if managed_configuration is None:
        metadata.pop("managed_configuration", None)
    else:
        metadata["managed_configuration"] = managed_configuration
    app.metadata_json = metadata

    try:
        app_entry = app_entry_from_managed_app(app, managed_configuration)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    changed_policies: list[Policy] = []
    for policy_id in old_policy_ids - target_policy_ids:
        policy = policies_by_id[policy_id]
        replace_application_in_policy(policy, package_name=package_name, entry=None)
        changed_policies.append(policy)
    for policy_id in target_policy_ids:
        policy = policies_by_id[policy_id]
        if app.is_kiosk_app:
            enable_single_app_kiosk(policy, package_name)
        replace_application_in_policy(policy, package_name=package_name, entry=app_entry)
        changed_policies.append(policy)

    db.add(app)
    for policy in {policy.id: policy for policy in changed_policies}.values():
        db.add(policy)
        await _publish_changed_policy(policy, tenant, db)
    await db.flush()
    await db.refresh(app)
    await record_audit_event(
        db,
        tenant_id=tenant.id,
        user=current_user,
        action="application.created" if created else "application.updated",
        resource_type="managed_application",
        resource_id=app.id,
        details={
            "package_name": package_name,
            "policy_ids": sorted(target_policy_ids),
            "install_type": app_entry["installType"],
            "auto_update_mode": app_entry["autoUpdateMode"],
            "accessible_track_ids": app_entry.get("accessibleTrackIds", []),
        },
        request=request,
    )
    return _managed_app_out(app)


@router.delete("/{package_name}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_managed_application(
    package_name: str,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Remove an app configuration and remove it from the policies it manages."""
    tenant = await _get_tenant(current_user, db)
    app = (
        await db.execute(
            select(ManagedApplication).where(
                ManagedApplication.tenant_id == tenant.id,
                ManagedApplication.package_name == package_name.strip().lower(),
            )
        )
    ).scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=404, detail="Managed application not found")

    policy_ids = _configured_policy_ids(app)
    if policy_ids:
        policies = (
            await db.execute(
                select(Policy).where(
                    Policy.id.in_(policy_ids), Policy.tenant_id == tenant.id
                )
            )
        ).scalars().all()
        for policy in policies:
            replace_application_in_policy(policy, package_name=app.package_name, entry=None)
            db.add(policy)
            await _publish_changed_policy(policy, tenant, db)

    await record_audit_event(
        db,
        tenant_id=tenant.id,
        user=current_user,
        action="application.deleted",
        resource_type="managed_application",
        resource_id=app.id,
        details={"package_name": app.package_name, "policy_ids": policy_ids},
        request=request,
    )
    await db.delete(app)
    await db.flush()

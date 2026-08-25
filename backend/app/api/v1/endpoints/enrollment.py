import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db, require_approved
from app.models.device_group import DeviceGroup
from app.models.enrollment_token import EnrollmentToken
from app.models.policy import Policy
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.enrollment import (
    EnrollmentTokenCreate,
    EnrollmentTokenListOut,
    EnrollmentTokenOut,
)
from app.services.android_management import AndroidManagementService
from app.services.audit import record_audit_event
from app.services.policy_management import publish_policy

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enrollment", tags=["Enrollment"])


def _get_amapi_service() -> AndroidManagementService:
    return AndroidManagementService(
        credentials_path=settings.GCP_CREDENTIALS_PATH,
        project_id=settings.GCP_PROJECT_ID,
    )


@router.post(
    "/tokens", response_model=EnrollmentTokenOut, status_code=status.HTTP_201_CREATED
)
async def create_enrollment_token(
    token_data: EnrollmentTokenCreate,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """
    Create an enrollment token for device provisioning.
    Calls the Android Management API to generate a real enrollment token
    and stores the result locally.
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a tenant",
        )

    # Verify policy exists
    policy_result = await db.execute(
        select(Policy).where(
            Policy.id == token_data.policy_id,
            Policy.tenant_id == current_user.tenant_id,
        )
    )
    policy = policy_result.scalar_one_or_none()
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found",
        )

    if token_data.group_id is not None:
        group_result = await db.execute(
            select(DeviceGroup).where(
                DeviceGroup.id == token_data.group_id,
                DeviceGroup.tenant_id == current_user.tenant_id,
            )
        )
        if group_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found",
            )

    # Get tenant for enterprise ID
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    if settings.AMAPI_MODE == "real" and (
        not tenant.enterprise_id or tenant.enterprise_id.startswith("pending:")
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Link the Google Android Enterprise before creating a real enrollment token.",
        )

    # Calculate expiry
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=token_data.duration_minutes
    )

    # Build Google policy name
    enterprise_name = tenant.enterprise_id if tenant.enterprise_id else ""

    # Call Google API
    amapi = _get_amapi_service()
    if enterprise_name and not enterprise_name.startswith("pending:"):
        try:
            await publish_policy(policy, tenant, amapi)
        except Exception as exc:
            logger.warning("Could not publish policy %s before enrollment: %s", policy.id, type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Android Management API did not publish the enrollment policy.",
            ) from exc
    policy_resource = policy.google_policy_name or (
        f"{enterprise_name}/policies/{policy.name}" if enterprise_name else policy.name
    )
    token_value = None
    qr_code_data = None

    try:
        google_token = await amapi.create_enrollment_token(
            enterprise_name=enterprise_name or "enterprises/mock",
            policy_name=policy_resource,
            duration=f"{token_data.duration_minutes * 60}s",
            one_time_only=token_data.max_uses == 1,
            allow_personal_usage=(
                "PERSONAL_USAGE_DISALLOWED_USERLESS"
                if token_data.management_mode == "dedicated"
                else "PERSONAL_USAGE_DISALLOWED"
            ),
        )
        if google_token:
            token_value = google_token.get("value")
            qr_code_raw = google_token.get("qrCode")
            if qr_code_raw:
                import json
                try:
                    qr_code_data = json.loads(qr_code_raw) if isinstance(qr_code_raw, str) else qr_code_raw
                except json.JSONDecodeError:
                    qr_code_data = {"raw": qr_code_raw}
    except Exception as e:
        logger.error(
            "Failed to create enrollment token via Android Management API: %s",
            type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Android Management API did not create the enrollment token",
        ) from e

    enrollment_token = EnrollmentToken(
        tenant_id=current_user.tenant_id,
        token_value=token_value,
        google_token_name=google_token.get("name") if google_token else None,
        qr_code_data=qr_code_data,
        policy_id=token_data.policy_id,
        group_id=token_data.group_id,
        enrollment_type=token_data.enrollment_type,
        management_mode=token_data.management_mode,
        duration_minutes=token_data.duration_minutes,
        max_uses=token_data.max_uses,
        expires_at=expires_at,
        is_active=True,
    )

    db.add(enrollment_token)
    await db.flush()
    await db.refresh(enrollment_token)

    logger.info(
        f"Enrollment token created (id={enrollment_token.id}, "
        f"type={token_data.enrollment_type}, tenant={current_user.tenant_id})"
    )
    await record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        action="enrollment.token_created",
        resource_type="enrollment_token",
        resource_id=enrollment_token.id,
        details={
            "policy_id": policy.id,
            "group_id": token_data.group_id,
            "management_mode": token_data.management_mode,
            "duration_minutes": token_data.duration_minutes,
            "max_uses": token_data.max_uses,
        },
        request=request,
    )
    return enrollment_token


@router.get("/tokens", response_model=EnrollmentTokenListOut)
async def list_enrollment_tokens(
    active_only: bool = Query(True, description="Only show active tokens"),
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """List all enrollment tokens for the current tenant."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a tenant",
        )

    query = select(EnrollmentToken).where(
        EnrollmentToken.tenant_id == current_user.tenant_id
    )

    if active_only:
        query = query.where(EnrollmentToken.is_active == True)

    query = query.order_by(EnrollmentToken.created_at.desc())

    result = await db.execute(query)
    tokens = result.scalars().all()

    return EnrollmentTokenListOut(
        items=[EnrollmentTokenOut.model_validate(t) for t in tokens],
        total=len(tokens),
    )


@router.get("/tokens/{token_id}", response_model=EnrollmentTokenOut)
async def get_enrollment_token(
    token_id: int,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Get a single enrollment token with full QR code data."""
    result = await db.execute(
        select(EnrollmentToken).where(
            EnrollmentToken.id == token_id,
            EnrollmentToken.tenant_id == current_user.tenant_id,
        )
    )
    token = result.scalar_one_or_none()

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment token not found",
        )

    return token


@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_enrollment_token(
    token_id: int,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Revoke (deactivate) an enrollment token."""
    result = await db.execute(
        select(EnrollmentToken).where(
            EnrollmentToken.id == token_id,
            EnrollmentToken.tenant_id == current_user.tenant_id,
        )
    )
    token = result.scalar_one_or_none()

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment token not found",
        )

    if token.google_token_name:
        try:
            await _get_amapi_service().delete_enrollment_token(token.google_token_name)
        except Exception as exc:
            logger.warning("Failed to revoke Google enrollment token %s: %s", token.id, type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Android Management API did not revoke the enrollment token; local state was unchanged.",
            ) from exc

    token.is_active = False
    db.add(token)
    await db.flush()

    logger.info(f"Enrollment token revoked: id={token_id}")
    await record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        action="enrollment.token_revoked",
        resource_type="enrollment_token",
        resource_id=token.id,
        details={"management_mode": token.management_mode},
        request=request,
    )

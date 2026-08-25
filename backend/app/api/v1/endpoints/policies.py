import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db, require_approved
from app.models.device import Device
from app.models.policy import Policy
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.policy import PolicyApply, PolicyCreate, PolicyOut, PolicyUpdate
from app.services.android_management import AndroidManagementService
from app.services.audit import record_audit_event
from app.services.policy_management import publish_policy, with_default_inventory_reporting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/policies", tags=["Policies"])


def _get_amapi_service() -> AndroidManagementService:
    return AndroidManagementService(
        credentials_path=settings.GCP_CREDENTIALS_PATH,
        project_id=settings.GCP_PROJECT_ID,
    )


async def _publish_or_raise(policy: Policy, tenant: Tenant) -> None:
    if not tenant.enterprise_id or tenant.enterprise_id.startswith("pending:"):
        return
    try:
        await publish_policy(policy, tenant, _get_amapi_service())
    except Exception as exc:
        logger.warning("Failed to publish policy %s: %s", policy.id, type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Android Management API did not publish the policy; local change was not saved.",
        ) from exc


@router.get("", response_model=list[PolicyOut])
async def list_policies(
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """List all policies for the current user's tenant."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a tenant",
        )

    result = await db.execute(
        select(Policy)
        .where(Policy.tenant_id == current_user.tenant_id)
        .order_by(Policy.name)
    )
    policies = result.scalars().all()
    return policies


@router.post("", response_model=PolicyOut, status_code=status.HTTP_201_CREATED)
async def create_policy(
    policy_data: PolicyCreate,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Create a new policy for the current tenant."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a tenant",
        )

    # Check for duplicate name within tenant
    result = await db.execute(
        select(Policy).where(
            Policy.tenant_id == current_user.tenant_id,
            Policy.name == policy_data.name,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A policy named '{policy_data.name}' already exists in this tenant",
        )

    # If marking as default, unset other defaults
    if policy_data.is_default:
        existing_defaults = (
            await db.execute(
                select(Policy).where(
                    Policy.tenant_id == current_user.tenant_id,
                    Policy.is_default == True,
                )
            )
        ).scalars().all()
        for p in existing_defaults:
            p.is_default = False
            db.add(p)

    policy = Policy(
        tenant_id=current_user.tenant_id,
        name=policy_data.name,
        display_name=policy_data.display_name,
        description=policy_data.description,
        policy_json=with_default_inventory_reporting(policy_data.policy_json),
        is_default=policy_data.is_default,
        version=1,
    )

    db.add(policy)
    await db.flush()
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    ).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    await _publish_or_raise(policy, tenant)
    await db.refresh(policy)

    logger.info(
        f"Policy created: {policy.name} (id={policy.id}, tenant={current_user.tenant_id})"
    )
    await record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        action="policy.created",
        resource_type="policy",
        resource_id=policy.id,
        details={"name": policy.name, "published": bool(policy.google_policy_name)},
        request=request,
    )
    return policy


@router.get("/{policy_id}", response_model=PolicyOut)
async def get_policy(
    policy_id: int,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Get a single policy by ID."""
    result = await db.execute(
        select(Policy).where(
            Policy.id == policy_id,
            Policy.tenant_id == current_user.tenant_id,
        )
    )
    policy = result.scalar_one_or_none()

    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found",
        )

    return policy


@router.put("/{policy_id}", response_model=PolicyOut)
async def update_policy(
    policy_id: int,
    update_data: PolicyUpdate,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing policy. Increments the version number."""
    result = await db.execute(
        select(Policy).where(
            Policy.id == policy_id,
            Policy.tenant_id == current_user.tenant_id,
        )
    )
    policy = result.scalar_one_or_none()

    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found",
        )

    if update_data.display_name is not None:
        policy.display_name = update_data.display_name

    if update_data.description is not None:
        policy.description = update_data.description

    if update_data.policy_json is not None:
        policy.policy_json = with_default_inventory_reporting(update_data.policy_json)
        policy.version += 1  # Bump version on policy content change

    if update_data.is_default is not None:
        if update_data.is_default:
            # Unset other defaults
            existing_defaults = (
                await db.execute(
                    select(Policy).where(
                        Policy.tenant_id == current_user.tenant_id,
                        Policy.is_default == True,
                        Policy.id != policy_id,
                    )
                )
            ).scalars().all()
            for p in existing_defaults:
                p.is_default = False
                db.add(p)
        policy.is_default = update_data.is_default

    db.add(policy)
    await db.flush()
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    ).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    await _publish_or_raise(policy, tenant)
    await db.refresh(policy)

    logger.info(f"Policy updated: {policy.name} (v{policy.version})")
    await record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        action="policy.updated",
        resource_type="policy",
        resource_id=policy.id,
        details={"version": policy.version, "published": bool(policy.google_policy_name)},
        request=request,
    )
    return policy


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    policy_id: int,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a policy. Fails if the policy is currently applied to any devices.
    """
    result = await db.execute(
        select(Policy).where(
            Policy.id == policy_id,
            Policy.tenant_id == current_user.tenant_id,
        )
    )
    policy = result.scalar_one_or_none()

    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found",
        )

    # Check if policy is in use
    device_count_result = await db.execute(
        select(Device).where(Device.policy_id == policy_id).limit(1)
    )
    if device_count_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete policy: it is currently applied to one or more devices. "
            "Reassign devices first.",
        )

    await record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        action="policy.deleted",
        resource_type="policy",
        resource_id=policy.id,
        details={"name": policy.name},
        request=request,
    )
    await db.delete(policy)
    await db.flush()

    logger.info(f"Policy deleted: {policy.name} (id={policy_id})")


@router.post("/{policy_id}/apply")
async def apply_policy_to_devices(
    policy_id: int,
    apply_data: PolicyApply,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """
    Apply a policy to one or more devices.
    Updates the local database and sends policy change to Google API
    for devices that have a Google device name.
    """
    # Verify policy exists and belongs to tenant
    result = await db.execute(
        select(Policy).where(
            Policy.id == policy_id,
            Policy.tenant_id == current_user.tenant_id,
        )
    )
    policy = result.scalar_one_or_none()

    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found",
        )

    # Get the tenant for enterprise ID
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    # Get devices
    devices_result = await db.execute(
        select(Device).where(
            Device.id.in_(apply_data.device_ids),
            Device.tenant_id == current_user.tenant_id,
        )
    )
    devices = devices_result.scalars().all()

    if not devices:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching devices found in this tenant",
        )

    amapi = _get_amapi_service()
    await _publish_or_raise(policy, tenant)
    results = []
    applied_count = 0

    for device in devices:
        device.policy_id = policy.id

        # Build the Google policy resource name
        if device.device_name and tenant.enterprise_id:
            policy_resource = policy.google_policy_name
            if not policy_resource:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Policy is not published to Android Management API",
                )
            device.policy_name = policy_resource
            try:
                await amapi.apply_policy(device.device_name, policy_resource)
                results.append(
                    {"device_id": device.id, "status": "applied"}
                )
            except Exception as exc:
                logger.warning("Failed to apply policy to device %s: %s", device.id, type(exc).__name__)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Android Management API did not apply the policy; local device state was not saved.",
                ) from exc
        else:
            results.append(
                {"device_id": device.id, "status": "pending_google_sync"}
            )

        db.add(device)
        applied_count += 1

    # Update applied devices count
    policy.applied_devices_count = applied_count
    db.add(policy)
    await db.flush()
    await record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        action="policy.applied",
        resource_type="policy",
        resource_id=policy.id,
        details={"device_ids": apply_data.device_ids, "applied_count": applied_count},
        request=request,
    )

    return {
        "policy_id": policy_id,
        "applied_count": applied_count,
        "results": results,
    }

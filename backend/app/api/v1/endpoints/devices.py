import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db, require_approved
from app.models.device import Device
from app.models.device_group import DeviceGroup
from app.models.policy import Policy
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.device import (
    DeviceCommand,
    DeviceListOut,
    DeviceOut,
    DeviceUpdate,
    DeviceWipeRequest,
)
from app.services.android_management import AndroidManagementService
from app.services.audit import record_audit_event
from app.services.device_commands import wipe_confirmation_matches
from app.services.policy_management import publish_policy

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["Devices"])


def _get_amapi_service() -> AndroidManagementService:
    return AndroidManagementService(
        credentials_path=settings.GCP_CREDENTIALS_PATH,
        project_id=settings.GCP_PROJECT_ID,
    )


@router.get("", response_model=DeviceListOut)
async def list_devices(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    state: Optional[str] = Query(None, description="Filter by state"),
    compliance_state: Optional[str] = Query(None, description="Filter by compliance"),
    group_id: Optional[int] = Query(None, description="Filter by group"),
    search: Optional[str] = Query(None, description="Search display_name, serial, model"),
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """
    List all devices for the current user's tenant.
    Supports pagination, filtering by state/compliance/group, and text search.
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a tenant",
        )

    query = select(Device).where(Device.tenant_id == current_user.tenant_id)
    count_query = select(func.count(Device.id)).where(
        Device.tenant_id == current_user.tenant_id
    )

    # Apply filters
    if state:
        query = query.where(Device.state == state)
        count_query = count_query.where(Device.state == state)

    if compliance_state:
        query = query.where(Device.compliance_state == compliance_state)
        count_query = count_query.where(Device.compliance_state == compliance_state)

    if group_id is not None:
        query = query.where(Device.group_id == group_id)
        count_query = count_query.where(Device.group_id == group_id)

    if search:
        search_filter = (
            Device.display_name.ilike(f"%{search}%")
            | Device.serial_number.ilike(f"%{search}%")
            | Device.model.ilike(f"%{search}%")
            | Device.manufacturer.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.order_by(Device.created_at.desc()).offset(offset).limit(per_page)

    result = await db.execute(query)
    devices = result.scalars().all()

    return DeviceListOut(
        items=[DeviceOut.model_validate(d) for d in devices],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(
    device_id: int,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Get a single device by ID. Only returns devices in the user's tenant."""
    result = await db.execute(
        select(Device).where(
            Device.id == device_id,
            Device.tenant_id == current_user.tenant_id,
        )
    )
    device = result.scalar_one_or_none()

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    return device


@router.put("/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: int,
    update_data: DeviceUpdate,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Update a device's display name or group assignment."""
    result = await db.execute(
        select(Device).where(
            Device.id == device_id,
            Device.tenant_id == current_user.tenant_id,
        )
    )
    device = result.scalar_one_or_none()

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    if update_data.display_name is not None:
        device.display_name = update_data.display_name

    previous_group_id = device.group_id
    if "group_id" in update_data.model_fields_set:
        if update_data.group_id is None:
            device.group_id = None
        else:
            group_result = await db.execute(
                select(DeviceGroup).where(
                    DeviceGroup.id == update_data.group_id,
                    DeviceGroup.tenant_id == current_user.tenant_id,
                )
            )
            group = group_result.scalar_one_or_none()
            if group is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Group not found",
                )
            device.group_id = update_data.group_id
            if group.default_policy_id:
                policy = (
                    await db.execute(
                        select(Policy).where(
                            Policy.id == group.default_policy_id,
                            Policy.tenant_id == current_user.tenant_id,
                        )
                    )
                ).scalar_one_or_none()
                if policy is not None:
                    tenant = (
                        await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
                    ).scalar_one_or_none()
                    if device.device_name and tenant and tenant.enterprise_id:
                        try:
                            await publish_policy(policy, tenant, _get_amapi_service())
                            if not policy.google_policy_name:
                                raise RuntimeError("policy_not_published")
                            await _get_amapi_service().apply_policy(device.device_name, policy.google_policy_name)
                        except Exception as exc:
                            raise HTTPException(
                                status_code=status.HTTP_502_BAD_GATEWAY,
                                detail="Android Management API did not apply the group policy; group move was not saved.",
                            ) from exc
                    device.policy_id = policy.id
                    device.policy_name = policy.google_policy_name or device.policy_name

    db.add(device)
    await db.flush()
    if previous_group_id != device.group_id:
        group_ids = [group_id for group_id in {previous_group_id, device.group_id} if group_id]
        for group_id in group_ids:
            group_to_count = (
                await db.execute(
                    select(DeviceGroup).where(
                        DeviceGroup.id == group_id,
                        DeviceGroup.tenant_id == current_user.tenant_id,
                    )
                )
            ).scalar_one_or_none()
            if group_to_count:
                group_to_count.device_count = (
                    await db.execute(
                        select(func.count(Device.id)).where(
                            Device.tenant_id == current_user.tenant_id,
                            Device.group_id == group_id,
                            Device.state != "deleted",
                        )
                    )
                ).scalar() or 0
                db.add(group_to_count)
        await record_audit_event(
            db,
            tenant_id=current_user.tenant_id,
            user=current_user,
            action="device.group_moved",
            resource_type="device",
            resource_id=device.id,
            details={"from_group_id": previous_group_id, "to_group_id": device.group_id},
        )
    elif update_data.display_name is not None:
        await record_audit_event(
            db,
            tenant_id=current_user.tenant_id,
            user=current_user,
            action="device.updated",
            resource_type="device",
            resource_id=device.id,
            details={"display_name_changed": True},
        )
    await db.refresh(device)

    return device


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: int,
    wipe_request: DeviceWipeRequest,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """
    Legacy wipe route. A precise confirmation value is required before an
    AMAPI device delete can irreversibly factory-reset a tablet.
    """
    result = await db.execute(
        select(Device).where(
            Device.id == device_id,
            Device.tenant_id == current_user.tenant_id,
        )
    )
    device = result.scalar_one_or_none()

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    if not wipe_confirmation_matches(device_id, wipe_request.confirmation):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Confirmation must exactly equal 'WIPE {device_id}'.",
        )
    if not device.device_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device is not bound to Android Management API; a wipe cannot be sent.",
        )

    # Do not mark the local device deleted if the remote wipe/delete failed.
    try:
        amapi = _get_amapi_service()
        await amapi.delete_device(device.device_name, wipe_request.wipe_data_flags)
    except Exception as e:
        logger.error(
            "Failed to delete device from Google API for device %s: %s",
            device_id,
            type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to wipe device through Android Management API; local state was unchanged.",
        ) from e

    device.state = "deleted"
    db.add(device)
    await db.flush()
    await record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        action="device.wipe_requested",
        resource_type="device",
        resource_id=device.id,
        details={"reason": wipe_request.reason, "wipe_data_flags": wipe_request.wipe_data_flags or []},
        request=request,
    )


@router.post("/{device_id}/commands/wipe")
async def wipe_device(
    device_id: int,
    wipe_request: DeviceWipeRequest,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Explicit, audited AMAPI wipe endpoint required by the MVP API."""
    await delete_device(device_id, wipe_request, request, current_user, db)
    return {"status": "wipe_requested", "device_id": device_id}


@router.post("/{device_id}/command")
async def send_device_command(
    device_id: int,
    command_data: DeviceCommand,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a management command to a device.
    Supported commands: lock, reboot, reset_password. Wipe is a separate
    destructive delete flow and is not sent through issueCommand.
    """
    result = await db.execute(
        select(Device).where(
            Device.id == device_id,
            Device.tenant_id == current_user.tenant_id,
        )
    )
    device = result.scalar_one_or_none()

    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    if not device.device_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device is not bound to Google Android Management. Cannot send commands.",
        )

    valid_commands = {"lock", "reboot", "reset_password"}
    if command_data.command not in valid_commands:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid command. Supported: {', '.join(sorted(valid_commands))}",
        )

    amapi = _get_amapi_service()
    try:
        result_data = await amapi.send_command(
            device.device_name, command_data.command, command_data.params
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to send command to device {device_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to communicate with Android Management API",
        )

    await record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        action=f"device.command.{command_data.command}",
        resource_type="device",
        resource_id=device.id,
        details={"command": command_data.command},
        request=request,
    )

    return {
        "status": "command_sent",
        "device_id": device_id,
        "command": command_data.command,
        "result": result_data,
    }


@router.post("/{device_id}/commands/{command}")
async def send_named_device_command(
    device_id: int,
    command: Literal["lock", "reboot"],
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Convenience routes such as ``/commands/reboot`` for supported AMAPI commands."""
    return await send_device_command(
        device_id=device_id,
        command_data=DeviceCommand(command=command),
        request=request,
        current_user=current_user,
        db=db,
    )

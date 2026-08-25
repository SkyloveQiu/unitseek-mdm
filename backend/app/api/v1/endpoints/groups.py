import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_approved
from app.models.device import Device
from app.models.device_group import DeviceGroup
from app.models.policy import Policy
from app.models.user import User
from app.services.audit import record_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/groups", tags=["Device Groups"])


# ---------- Schemas (inline for groups, lightweight) ----------

from typing import Optional

from pydantic import BaseModel, Field


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    default_policy_id: Optional[int] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    default_policy_id: Optional[int] = None


class GroupOut(BaseModel):
    id: int
    tenant_id: int
    name: str
    description: Optional[str] = None
    default_policy_id: Optional[int] = None
    device_count: int
    created_at: object
    updated_at: object

    model_config = {"from_attributes": True}


# ---------- Endpoints ----------


@router.get("", response_model=list[GroupOut])
async def list_groups(
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """List all device groups for the current tenant."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a tenant",
        )

    result = await db.execute(
        select(DeviceGroup)
        .where(DeviceGroup.tenant_id == current_user.tenant_id)
        .order_by(DeviceGroup.name)
    )
    groups = result.scalars().all()
    return groups


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupCreate,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Create a new device group."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a tenant",
        )

    if group_data.default_policy_id is not None:
        policy_result = await db.execute(
            select(Policy).where(
                Policy.id == group_data.default_policy_id,
                Policy.tenant_id == current_user.tenant_id,
            )
        )
        if policy_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Policy not found")

    # Check for duplicate name within tenant
    result = await db.execute(
        select(DeviceGroup).where(
            DeviceGroup.tenant_id == current_user.tenant_id,
            DeviceGroup.name == group_data.name,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A group named '{group_data.name}' already exists in this tenant",
        )

    group = DeviceGroup(
        tenant_id=current_user.tenant_id,
        name=group_data.name,
        description=group_data.description,
        default_policy_id=group_data.default_policy_id,
        device_count=0,
    )

    db.add(group)
    await db.flush()
    await db.refresh(group)

    logger.info(
        f"Group created: {group.name} (id={group.id}, tenant={current_user.tenant_id})"
    )
    await record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        action="group.created",
        resource_type="group",
        resource_id=group.id,
        details={"name": group.name, "default_policy_id": group.default_policy_id},
        request=request,
    )
    return group


@router.put("/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: int,
    update_data: GroupUpdate,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """Update a device group."""
    result = await db.execute(
        select(DeviceGroup).where(
            DeviceGroup.id == group_id,
            DeviceGroup.tenant_id == current_user.tenant_id,
        )
    )
    group = result.scalar_one_or_none()

    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    if update_data.name is not None:
        # Check uniqueness
        dup_result = await db.execute(
            select(DeviceGroup).where(
                DeviceGroup.tenant_id == current_user.tenant_id,
                DeviceGroup.name == update_data.name,
                DeviceGroup.id != group_id,
            )
        )
        if dup_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A group named '{update_data.name}' already exists",
            )
        group.name = update_data.name

    if update_data.description is not None:
        group.description = update_data.description

    if "default_policy_id" in update_data.model_fields_set:
        if update_data.default_policy_id is None:
            group.default_policy_id = None
        else:
            policy_result = await db.execute(
                select(Policy).where(
                    Policy.id == update_data.default_policy_id,
                    Policy.tenant_id == current_user.tenant_id,
                )
            )
            if policy_result.scalar_one_or_none() is None:
                raise HTTPException(status_code=404, detail="Policy not found")
            group.default_policy_id = update_data.default_policy_id

    db.add(group)
    await db.flush()
    await db.refresh(group)

    await record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        action="group.updated",
        resource_type="group",
        resource_id=group.id,
        details={"default_policy_id": group.default_policy_id},
        request=request,
    )

    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    request: Request,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a device group.
    Devices in this group will have their group_id set to NULL
    (handled by the ON DELETE SET NULL foreign key).
    """
    result = await db.execute(
        select(DeviceGroup).where(
            DeviceGroup.id == group_id,
            DeviceGroup.tenant_id == current_user.tenant_id,
        )
    )
    group = result.scalar_one_or_none()

    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    await record_audit_event(
        db,
        tenant_id=current_user.tenant_id,
        user=current_user,
        action="group.deleted",
        resource_type="group",
        resource_id=group.id,
        details={"name": group.name},
        request=request,
    )
    await db.delete(group)
    await db.flush()

    logger.info(f"Group deleted: {group.name} (id={group_id})")

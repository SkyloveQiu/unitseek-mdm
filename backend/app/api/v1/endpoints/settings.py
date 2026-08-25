import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.models.tenant import Tenant
from app.models.tenant_settings import TenantSettings
from app.models.user import User
from app.schemas.settings import (
    GeneralSettingsOut,
    GeneralSettingsUpdate,
)
from app.schemas.tenant import TenantOut, TenantUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])


async def _get_or_create_tenant_settings(
    db: AsyncSession, tenant_id: int
) -> TenantSettings:
    result = await db.execute(
        select(TenantSettings).where(TenantSettings.tenant_id == tenant_id)
    )
    ts = result.scalar_one_or_none()
    if ts is None:
        ts = TenantSettings(tenant_id=tenant_id)
        db.add(ts)
        await db.flush()
        await db.refresh(ts)
    return ts


# --- General Settings ---


@router.get("/general", response_model=GeneralSettingsOut)
async def get_general_settings(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get general settings for the current tenant."""
    ts = await _get_or_create_tenant_settings(db, current_user.tenant_id)
    return ts


@router.put("/general", response_model=GeneralSettingsOut)
async def update_general_settings(
    data: GeneralSettingsUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update general settings for the current tenant."""
    ts = await _get_or_create_tenant_settings(db, current_user.tenant_id)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ts, field, value)

    db.add(ts)
    await db.flush()
    await db.refresh(ts)

    logger.info(f"General settings updated for tenant {current_user.tenant_id}")
    return ts


# --- Tenant Info ---


@router.get("/tenant", response_model=TenantOut)
async def get_tenant_info(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get current tenant information."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
        )
    return tenant


@router.put("/tenant", response_model=TenantOut)
async def update_tenant_info(
    data: TenantUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update current tenant information."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tenant, field, value)

    db.add(tenant)
    await db.flush()
    await db.refresh(tenant)

    logger.info(f"Tenant info updated: {tenant.name} (id={tenant.id})")
    return tenant

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin, require_approved
from app.models.tenant import Tenant
from app.models.device_group import DeviceGroup
from app.models.user import User
from app.schemas.tenant import TenantCreate, TenantOut, TenantUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.get("", response_model=list[TenantOut])
async def list_tenants(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all tenants. Admin only."""
    result = await db.execute(select(Tenant).order_by(Tenant.name))
    tenants = result.scalars().all()
    return tenants


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_data: TenantCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tenant. Admin only."""
    # Check for duplicate code
    result = await db.execute(
        select(Tenant).where(Tenant.code == tenant_data.code.upper())
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A tenant with code '{tenant_data.code}' already exists",
        )

    tenant = Tenant(
        name=tenant_data.name,
        code=tenant_data.code.upper(),
        is_active=True,
        contact_email=tenant_data.contact_email,
        contact_phone=tenant_data.contact_phone,
        max_devices=tenant_data.max_devices,
    )

    db.add(tenant)
    await db.flush()
    db.add_all([
        DeviceGroup(tenant_id=tenant.id, name="Testing", description="Pre-production validation devices"),
        DeviceGroup(tenant_id=tenant.id, name="Production", description="Production dedicated devices"),
    ])
    await db.refresh(tenant)

    logger.info(f"Tenant created: {tenant.name} (code={tenant.code})")
    return tenant


@router.get("/{tenant_id}", response_model=TenantOut)
async def get_tenant(
    tenant_id: int,
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """
    Get tenant details.
    Admins can view any tenant. Non-admins can only view their own tenant.
    """
    if not current_user.is_admin and current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own tenant",
        )

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()

    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    return tenant


@router.put("/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: int,
    update_data: TenantUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a tenant. Admin only."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()

    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    if update_data.name is not None:
        tenant.name = update_data.name

    if update_data.contact_email is not None:
        tenant.contact_email = update_data.contact_email

    if update_data.contact_phone is not None:
        tenant.contact_phone = update_data.contact_phone

    if update_data.max_devices is not None:
        tenant.max_devices = update_data.max_devices

    if update_data.is_active is not None:
        tenant.is_active = update_data.is_active

    db.add(tenant)
    await db.flush()
    await db.refresh(tenant)

    logger.info(f"Tenant updated: {tenant.name} (id={tenant_id})")
    return tenant

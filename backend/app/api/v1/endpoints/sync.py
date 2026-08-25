import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import get_db, require_admin
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.sync import SyncResultOut
from app.services.android_management import AndroidManagementService
from app.services.audit import record_audit_event
from app.services.sync import AndroidManagementSyncService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["Synchronization"])


@router.post("", response_model=SyncResultOut)
async def sync_current_tenant(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Synchronize AMAPI inventory, device reports, app versions, and policy state now."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not assigned to a tenant")

    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    ).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    amapi = AndroidManagementService(
        credentials_path=settings.GCP_CREDENTIALS_PATH,
        project_id=settings.GCP_PROJECT_ID,
        mode=settings.AMAPI_MODE,
    )
    result = await AndroidManagementSyncService(amapi).sync_tenant(db, tenant)
    await record_audit_event(
        db,
        tenant_id=tenant.id,
        user=current_user,
        action="sync.run",
        resource_type="tenant",
        resource_id=tenant.id,
        details={
            "status": result.status,
            "devices_seen": result.devices_seen,
            "devices_created": result.devices_created,
            "devices_updated": result.devices_updated,
            "policies_published": result.policies_published,
            "error": result.error,
        },
    )
    if result.status == "error":
        logger.warning("Manual sync failed for tenant %s: %s", tenant.id, result.error)
    return SyncResultOut(**result.__dict__)

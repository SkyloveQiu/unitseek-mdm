from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_admin
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogListOut, AuditLogOut

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("", response_model=AuditLogListOut)
async def list_audit_events(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Inspect recent security-relevant events for the current tenant."""
    count = (
        await db.execute(
            select(func.count(AuditLog.id)).where(AuditLog.tenant_id == current_user.tenant_id)
        )
    ).scalar() or 0
    events = (
        await db.execute(
            select(AuditLog)
            .where(AuditLog.tenant_id == current_user.tenant_id)
            .order_by(AuditLog.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    ).scalars().all()
    return AuditLogListOut(
        items=[AuditLogOut.model_validate(event) for event in events],
        total=count,
        page=page,
        per_page=per_page,
    )

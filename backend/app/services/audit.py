"""Audit logging helpers for security-relevant administrative actions."""

from typing import Any, Mapping

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User

_SENSITIVE_DETAIL_KEYS = {
    "access_token",
    "authorization",
    "credentials",
    "enterprise_token",
    "new_password",
    "password",
    "token",
    "token_value",
}


def _safe_details(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {
            str(key): "[redacted]" if str(key).lower() in _SENSITIVE_DETAIL_KEYS else _safe_details(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_safe_details(item) for item in value]
    return value


async def record_audit_event(
    db: AsyncSession,
    *,
    tenant_id: int,
    action: str,
    user: User | None = None,
    resource_type: str | None = None,
    resource_id: str | int | None = None,
    details: Mapping[str, Any] | None = None,
    request: Request | None = None,
) -> AuditLog:
    """Stage an audit event in the current request transaction.

    Secrets and credential-like values are always redacted before persistence.
    The request transaction owns the commit, keeping business changes and their
    audit record atomic.
    """
    ip_address = request.client.host if request and request.client else None
    event = AuditLog(
        tenant_id=tenant_id,
        user_id=user.id if user else None,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        details=_safe_details(dict(details or {})),
        ip_address=ip_address,
    )
    db.add(event)
    return event

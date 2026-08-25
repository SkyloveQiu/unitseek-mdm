from typing import Any, Optional

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db_types import JSON_DOCUMENT
from app.models.base import BaseModel


class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    tenant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    action: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True,
        comment="e.g. device.enroll, policy.update, user.login",
    )
    resource_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    details: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON_DOCUMENT, nullable=True, default=dict
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db_types import JSON_DOCUMENT
from app.models.base import BaseModel


class EnrollmentToken(BaseModel):
    __tablename__ = "enrollment_tokens"

    tenant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    token_value: Mapped[Optional[str]] = mapped_column(
        String(1000), nullable=True, comment="Google enrollment token string"
    )
    google_token_name: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, unique=True, comment="Google enrollment token resource name"
    )
    qr_code_data: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON_DOCUMENT, nullable=True, comment="QR code payload"
    )

    policy_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("policies.id", ondelete="CASCADE"), nullable=False
    )
    group_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("device_groups.id", ondelete="SET NULL"), nullable=True
    )

    enrollment_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="qr_code",
        comment="qr_code, link, nfc, zte",
    )
    management_mode: Mapped[str] = mapped_column(
        String(50), nullable=False, default="fully_managed",
        comment="fully_managed or dedicated",
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer, default=1440, nullable=False, comment="Default 24 hours"
    )
    max_uses: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="0 = reusable; 1 = Google-enforced one-time token"
    )
    # Retained for schema compatibility. AMAPI does not
    # expose a reliable counter for enrollment-token consumption.
    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    policy = relationship("Policy", foreign_keys=[policy_id])
    group = relationship("DeviceGroup", foreign_keys=[group_id])

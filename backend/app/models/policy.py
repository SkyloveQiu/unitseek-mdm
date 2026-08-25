from datetime import datetime
from typing import TYPE_CHECKING, Any, List, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db_types import JSON_DOCUMENT
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.tenant import Tenant


class Policy(BaseModel):
    __tablename__ = "policies"

    tenant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Unique per tenant"
    )
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    policy_json: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON_DOCUMENT, nullable=True, default=dict,
        comment="Full Android Management API policy object",
    )

    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    applied_devices_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    google_policy_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    last_published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_publish_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_remote_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    remote_policy_json: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON_DOCUMENT, nullable=True, comment="Last policy resource read back from Android Management API"
    )

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="policies")
    devices: Mapped[List["Device"]] = relationship("Device", back_populates="policy")

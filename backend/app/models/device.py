from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db_types import JSON_DOCUMENT
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.device_group import DeviceGroup
    from app.models.policy import Policy
    from app.models.tenant import Tenant


class Device(BaseModel):
    __tablename__ = "devices"

    tenant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Google Android Management identifiers
    device_name: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, unique=True,
        comment="Google device name like enterprises/xxx/devices/yyy",
    )
    display_name: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="Friendly name set by admin"
    )

    # Hardware identifiers
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    imei: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    imei2: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Device info
    model: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    os_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    api_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    security_patch_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Policy and group
    policy_name: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="Google policy resource name"
    )
    policy_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("policies.id", ondelete="SET NULL"), nullable=True
    )
    group_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("device_groups.id", ondelete="SET NULL"), nullable=True
    )

    # Management state
    management_mode: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, default="fully_managed",
        comment="fully_managed, work_profile, dedicated",
    )
    state: Mapped[str] = mapped_column(
        String(50), nullable=False, default="provisioning",
        comment="active, disabled, deleted, provisioning",
    )
    compliance_state: Mapped[str] = mapped_column(
        String(50), nullable=False, default="unknown",
        comment="compliant, non_compliant, unknown",
    )

    # Timestamps
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_reported_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    enrolled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Extended info stored as JSON
    hardware_info: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON_DOCUMENT, nullable=True, default=dict
    )
    software_info: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON_DOCUMENT, nullable=True, default=dict
    )
    network_info: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON_DOCUMENT, nullable=True, default=dict
    )
    application_reports: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON_DOCUMENT, nullable=True, default=dict,
        comment="Latest AMAPI application reports keyed by package name",
    )

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="devices")
    policy: Mapped[Optional["Policy"]] = relationship(
        "Policy", back_populates="devices"
    )
    group: Mapped[Optional["DeviceGroup"]] = relationship(
        "DeviceGroup", back_populates="devices"
    )

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.device_group import DeviceGroup
    from app.models.managed_application import ManagedApplication
    from app.models.policy import Policy
    from app.models.user import User


class Tenant(BaseModel):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(
        String(20), unique=True, nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enterprise_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="Google enterprise binding ID"
    )
    enterprise_display_name: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="Display name returned by Android Management API"
    )
    max_devices: Mapped[int] = mapped_column(
        Integer, default=-1, nullable=False, comment="-1 = unlimited"
    )
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    amapi_connection_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="not_configured"
    )
    last_amapi_success_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_amapi_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_sync_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_sync_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="tenant")
    devices: Mapped[List["Device"]] = relationship("Device", back_populates="tenant")
    policies: Mapped[List["Policy"]] = relationship("Policy", back_populates="tenant")
    groups: Mapped[List["DeviceGroup"]] = relationship(
        "DeviceGroup", back_populates="tenant"
    )
    managed_apps: Mapped[List["ManagedApplication"]] = relationship(
        "ManagedApplication", back_populates="tenant", cascade="all, delete-orphan"
    )

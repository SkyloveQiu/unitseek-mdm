from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.policy import Policy
    from app.models.tenant import Tenant


class DeviceGroup(BaseModel):
    __tablename__ = "device_groups"

    tenant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    default_policy_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("policies.id", ondelete="SET NULL"), nullable=True
    )
    device_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="groups")
    default_policy: Mapped[Optional["Policy"]] = relationship(
        "Policy", foreign_keys=[default_policy_id]
    )
    devices: Mapped[List["Device"]] = relationship("Device", back_populates="group")

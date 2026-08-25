from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db_types import JSON_DOCUMENT
from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.tenant import Tenant


class ManagedApplication(BaseModel):
    """A Managed Google Play application configured by a tenant."""

    __tablename__ = "managed_applications"
    __table_args__ = (
        UniqueConstraint("tenant_id", "package_name", name="uq_managed_apps_tenant_package"),
    )

    tenant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    package_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    install_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="FORCE_INSTALLED"
    )
    auto_update_mode: Mapped[str] = mapped_column(
        String(80), nullable=False, default="AUTO_UPDATE_HIGH_PRIORITY"
    )
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_kiosk_app: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_known_version: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSON_DOCUMENT, nullable=True, default=dict
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="managed_apps")

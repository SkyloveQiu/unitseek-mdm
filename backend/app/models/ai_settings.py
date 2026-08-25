from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.tenant import Tenant


class AISettings(BaseModel):
    __tablename__ = "ai_settings"

    tenant_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    ai_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_provider: Mapped[str] = mapped_column(String(50), default="ollama", nullable=False)
    ai_model: Mapped[str] = mapped_column(String(100), default="llama3", nullable=False)
    ai_base_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ai_api_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", backref="ai_settings")

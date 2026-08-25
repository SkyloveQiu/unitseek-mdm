from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class ManagedApplicationCreate(BaseModel):
    package_name: str = Field(..., min_length=3, max_length=255)
    display_name: Optional[str] = Field(None, max_length=255)
    install_type: str = Field("FORCE_INSTALLED", max_length=50)
    auto_update_mode: str = Field("AUTO_UPDATE_HIGH_PRIORITY", max_length=80)
    is_required: bool = True
    is_kiosk_app: bool = False
    policy_ids: list[int] = Field(default_factory=list)
    accessible_track_ids: list[str] = Field(default_factory=list)
    managed_configuration: Optional[dict[str, Any]] = None

    @field_validator("package_name")
    @classmethod
    def validate_package_name(cls, value: str) -> str:
        package_name = value.strip().lower()
        labels = package_name.split(".")
        if len(labels) < 2 or any(not label.replace("_", "").isalnum() for label in labels):
            raise ValueError("package_name must be a valid Android package name")
        return package_name


class ManagedApplicationUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=255)
    install_type: Optional[str] = Field(None, max_length=50)
    auto_update_mode: Optional[str] = Field(None, max_length=80)
    is_required: Optional[bool] = None
    is_kiosk_app: Optional[bool] = None
    policy_ids: Optional[list[int]] = None
    accessible_track_ids: Optional[list[str]] = None
    managed_configuration: Optional[dict[str, Any]] = None


class ManagedApplicationOut(BaseModel):
    id: int
    tenant_id: int
    package_name: str
    display_name: Optional[str] = None
    install_type: str
    auto_update_mode: str
    is_required: bool
    is_kiosk_app: bool
    last_known_version: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    metadata_json: Optional[dict[str, Any]] = None
    policy_ids: list[int] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

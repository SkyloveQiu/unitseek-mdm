from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator


class DeviceOut(BaseModel):
    id: int
    tenant_id: int
    device_name: Optional[str] = None
    display_name: Optional[str] = None
    serial_number: Optional[str] = None
    imei: Optional[str] = None
    imei2: Optional[str] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    os_version: Optional[str] = None
    api_level: Optional[int] = None
    security_patch_level: Optional[str] = None
    policy_name: Optional[str] = None
    policy_id: Optional[int] = None
    group_id: Optional[int] = None
    management_mode: Optional[str] = None
    state: str
    compliance_state: str
    last_sync_at: Optional[datetime] = None
    last_reported_at: Optional[datetime] = None
    enrolled_at: Optional[datetime] = None
    hardware_info: Optional[dict[str, Any]] = None
    software_info: Optional[dict[str, Any]] = None
    network_info: Optional[dict[str, Any]] = None
    application_reports: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeviceUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=255)
    group_id: Optional[int] = None

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: Optional[str]) -> Optional[str]:
        # A blank name clears the friendly name so the console falls back to
        # the Google device identifier instead of rendering an empty label.
        if value is None:
            return None
        return value.strip() or None


class DeviceListOut(BaseModel):
    items: List[DeviceOut]
    total: int
    page: int
    per_page: int


class DeviceCommand(BaseModel):
    command: str = Field(
        ..., description="Command to send: lock, reboot, reset_password; wipe uses the delete endpoint"
    )
    params: Optional[dict[str, Any]] = None


class DeviceWipeRequest(BaseModel):
    confirmation: str = Field(
        ..., min_length=6, max_length=100,
        description="Must exactly equal WIPE <device_id> to confirm an irreversible wipe",
    )
    wipe_data_flags: Optional[list[str]] = None
    reason: Optional[str] = Field(None, max_length=500)

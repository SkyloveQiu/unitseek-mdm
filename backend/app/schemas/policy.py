from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class PolicyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    display_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    policy_json: Optional[dict[str, Any]] = None
    is_default: bool = False


class PolicyUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    policy_json: Optional[dict[str, Any]] = None
    is_default: Optional[bool] = None


class PolicyOut(BaseModel):
    id: int
    tenant_id: int
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    policy_json: Optional[dict[str, Any]] = None
    is_default: bool
    version: int
    applied_devices_count: int
    google_policy_name: Optional[str] = None
    last_published_at: Optional[datetime] = None
    last_publish_error: Optional[str] = None
    last_remote_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PolicyApply(BaseModel):
    device_ids: List[int] = Field(..., min_length=1)

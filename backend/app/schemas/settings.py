from typing import Optional

from pydantic import BaseModel, Field


class GeneralSettingsOut(BaseModel):
    timezone: str
    language: str
    date_format: str
    notifications_enabled: bool
    session_timeout_minutes: int

    model_config = {"from_attributes": True}


class GeneralSettingsUpdate(BaseModel):
    timezone: Optional[str] = Field(None, max_length=100)
    language: Optional[str] = Field(None, max_length=10)
    date_format: Optional[str] = Field(None, max_length=30)
    notifications_enabled: Optional[bool] = None
    session_timeout_minutes: Optional[int] = Field(None, ge=5, le=1440)

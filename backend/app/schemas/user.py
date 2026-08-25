from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)


class UserLogin(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[str] = Field(None, max_length=255)


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    is_admin: bool
    is_approved: bool
    tenant_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class BrowserSession(BaseModel):
    """Non-secret response returned after creating an HttpOnly browser session."""

    user: UserOut


class BootstrapStatus(BaseModel):
    """Whether this empty installation still needs its first administrator."""

    initial_administrator_required: bool


class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None

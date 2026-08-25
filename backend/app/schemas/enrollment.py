from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class EnrollmentTokenCreate(BaseModel):
    policy_id: int
    group_id: Optional[int] = None
    enrollment_type: str = Field(
        default="qr_code", pattern=r"^(qr_code|link|nfc|zte)$"
    )
    management_mode: str = Field(
        default="fully_managed", pattern=r"^(fully_managed|dedicated)$"
    )
    duration_minutes: int = Field(default=1440, ge=1, le=525600)
    # AMAPI enforces this as a boolean (oneTimeOnly), rather than an arbitrary
    # local counter.  Do not promise a limit that the upstream service cannot
    # authoritatively enforce.
    max_uses: int = Field(default=0, ge=0, le=1)


class EnrollmentTokenOut(BaseModel):
    id: int
    tenant_id: int
    token_value: Optional[str] = None
    qr_code_data: Optional[dict[str, Any]] = None
    policy_id: int
    group_id: Optional[int] = None
    enrollment_type: str
    management_mode: str
    duration_minutes: int
    max_uses: int
    use_count: int
    expires_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class EnrollmentTokenListOut(BaseModel):
    items: List[EnrollmentTokenOut]
    total: int

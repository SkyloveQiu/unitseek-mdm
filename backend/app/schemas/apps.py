from pydantic import BaseModel, Field


class WebTokenRequest(BaseModel):
    parent_frame_url: str = Field(
        ...,
        description="URL of the parent page embedding the iframe",
    )


class WebTokenResponse(BaseModel):
    token: str
    iframe_url: str

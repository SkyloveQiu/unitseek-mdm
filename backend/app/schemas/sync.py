from datetime import datetime

from pydantic import BaseModel


class SyncResultOut(BaseModel):
    tenant_id: int
    status: str
    devices_seen: int = 0
    devices_created: int = 0
    devices_updated: int = 0
    policies_published: int = 0
    started_at: datetime
    completed_at: datetime
    error: str | None = None


class ConnectionStatusOut(BaseModel):
    enterprise_id: str | None = None
    enterprise_display_name: str | None = None
    google_cloud_project: str | None = None
    mode: str
    connection_status: str
    last_successful_api_communication: datetime | None = None
    last_error: str | None = None
    last_sync_started_at: datetime | None = None
    last_sync_completed_at: datetime | None = None

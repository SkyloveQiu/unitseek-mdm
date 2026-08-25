from typing import Dict

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_devices: int = 0
    active_devices: int = 0
    compliant_devices: int = 0
    non_compliant_devices: int = 0
    policies_count: int = 0
    groups_count: int = 0
    recent_enrollments: int = 0  # Last 7 days
    recently_reporting_devices: int = 0  # Last 24 hours
    testing_devices: int = 0
    production_devices: int = 0
    devices_with_application_problems: int = 0
    devices_by_state: Dict[str, int] = {}
    devices_by_os: Dict[str, int] = {}

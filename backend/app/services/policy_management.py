"""Policy construction and publication helpers for Android Management API."""

from datetime import datetime, timezone
import re
from typing import Any

from app.models.managed_application import ManagedApplication
from app.models.policy import Policy
from app.models.tenant import Tenant
from app.services.android_management import AndroidManagementService

VALID_INSTALL_TYPES = {
    "AVAILABLE",
    "FORCE_INSTALLED",
    "REQUIRED_FOR_SETUP",
    "BLOCKED",
    "PREINSTALLED",
    "KIOSK",
}
VALID_AUTO_UPDATE_MODES = {
    "AUTO_UPDATE_MODE_UNSPECIFIED",
    "AUTO_UPDATE_DEFAULT",
    "AUTO_UPDATE_POSTPONED",
    "AUTO_UPDATE_HIGH_PRIORITY",
}

# These two reports are the minimum telemetry needed to meet the product's
# device-inventory and managed-app status requirements. They deliberately do
# not enable network, display, or other optional reporting categories.
DEFAULT_STATUS_REPORTING_SETTINGS = {
    "applicationReportsEnabled": True,
    "softwareInfoEnabled": True,
}


def with_default_inventory_reporting(policy_json: dict[str, Any] | None) -> dict[str, Any]:
    """Add minimal inventory reporting defaults without overriding choices.

    Explicit tenant choices (including ``False``) are preserved. This lets an
    administrator reduce reporting deliberately while ensuring a newly created
    policy produces application/version data by default.
    """
    result = dict(policy_json or {})
    reporting = result.get("statusReportingSettings")
    if reporting is None:
        reporting = {}
    if not isinstance(reporting, dict):
        # Keep malformed input so AMAPI can return its precise validation error
        # instead of silently replacing a user's policy structure.
        return result

    reporting = dict(reporting)
    for key, value in DEFAULT_STATUS_REPORTING_SETTINGS.items():
        reporting.setdefault(key, value)
    result["statusReportingSettings"] = reporting
    return result


def google_policy_id(policy: Policy) -> str:
    """Return a stable AMAPI-safe ID without relying on a user supplied name."""
    normalized = re.sub(r"[^a-z0-9-]+", "-", policy.name.lower()).strip("-")
    return f"policy-{policy.id}-{normalized[:80] or 'default'}"


def app_entry_from_managed_app(
    app: ManagedApplication,
    managed_configuration: dict[str, Any] | None = None,
) -> dict[str, Any]:
    install_type = app.install_type.upper()
    if install_type not in VALID_INSTALL_TYPES:
        raise ValueError(f"Unsupported install type: {app.install_type}")

    auto_update_mode = app.auto_update_mode.upper()
    if auto_update_mode not in VALID_AUTO_UPDATE_MODES:
        raise ValueError(f"Unsupported auto update mode: {app.auto_update_mode}")

    entry: dict[str, Any] = {
        "packageName": app.package_name,
        "installType": "KIOSK" if app.is_kiosk_app else install_type,
        "autoUpdateMode": auto_update_mode,
    }
    accessible_track_ids = (app.metadata_json or {}).get("accessible_track_ids", [])
    if accessible_track_ids:
        entry["accessibleTrackIds"] = list(accessible_track_ids)
    if managed_configuration:
        entry["managedConfiguration"] = managed_configuration
    return entry


def replace_application_in_policy(
    policy: Policy,
    *,
    package_name: str,
    entry: dict[str, Any] | None,
) -> None:
    """Replace one package in a policy while preserving all other policy fields."""
    policy_json = with_default_inventory_reporting(policy.policy_json)
    applications = [
        app for app in list(policy_json.get("applications") or [])
        if app.get("packageName") != package_name
    ]
    if entry is not None:
        applications.append(entry)
    policy_json["applications"] = applications
    policy.policy_json = policy_json
    policy.version += 1


def enable_single_app_kiosk(policy: Policy, package_name: str) -> None:
    """Apply the AMAPI-supported application KIOSK install type for one app."""
    policy_json = dict(policy.policy_json or {})
    applications = list(policy_json.get("applications") or [])
    for app in applications:
        if app.get("installType") == "KIOSK" and app.get("packageName") != package_name:
            app["installType"] = "FORCE_INSTALLED"
    policy_json["applications"] = applications
    policy.policy_json = policy_json


async def publish_policy(
    policy: Policy,
    tenant: Tenant,
    amapi: AndroidManagementService,
) -> str | None:
    """Publish desired policy JSON and retain an honest local publication state."""
    if not tenant.enterprise_id or tenant.enterprise_id.startswith("pending:"):
        return None

    remote_id = google_policy_id(policy)
    try:
        remote = await amapi.create_policy(
            tenant.enterprise_id,
            remote_id,
            dict(policy.policy_json or {}),
        )
    except Exception as exc:
        policy.last_publish_error = type(exc).__name__
        raise

    policy.google_policy_name = (remote or {}).get(
        "name", f"{tenant.enterprise_id}/policies/{remote_id}"
    )
    policy.last_published_at = datetime.now(timezone.utc)
    policy.last_publish_error = None
    return policy.google_policy_name

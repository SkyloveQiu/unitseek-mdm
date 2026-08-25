"""Small-fleet Android Management API synchronization service."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.models.managed_application import ManagedApplication
from app.models.policy import Policy
from app.models.tenant import Tenant
from app.services.android_management import AndroidManagementService
from app.services.policy_management import publish_policy


class SyncPrerequisiteError(RuntimeError):
    """Raised when a tenant cannot yet be synchronized with AMAPI."""


@dataclass
class SyncResult:
    tenant_id: int
    status: str
    devices_seen: int
    devices_created: int
    devices_updated: int
    policies_published: int
    started_at: datetime
    completed_at: datetime
    error: str | None = None


def _parse_google_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _application_reports(reports: Any) -> dict[str, Any]:
    if not isinstance(reports, list):
        return {}
    return {
        report["packageName"]: report
        for report in reports
        if isinstance(report, dict) and report.get("packageName")
    }


def apply_google_device(device: Device, payload: dict[str, Any], now: datetime) -> None:
    """Map the AMAPI device resource to the locally cached inventory fields."""
    hardware = dict(payload.get("hardwareInfo") or {})
    software = dict(payload.get("softwareInfo") or {})
    network = dict(payload.get("networkInfo") or {})
    reports = _application_reports(payload.get("applicationReports"))

    device.policy_name = payload.get("policyName") or device.policy_name
    device.management_mode = (payload.get("managementMode") or device.management_mode or "fully_managed").lower()
    device.state = (payload.get("state") or device.state or "provisioning").lower()
    compliant = payload.get("policyCompliant")
    device.compliance_state = "compliant" if compliant is True else "non_compliant" if compliant is False else "unknown"
    device.serial_number = hardware.get("serialNumber") or device.serial_number
    device.model = hardware.get("model") or device.model
    device.manufacturer = hardware.get("manufacturer") or device.manufacturer
    device.os_version = software.get("androidVersion") or device.os_version
    device.api_level = software.get("apiLevel") or device.api_level
    device.security_patch_level = software.get("securityPatchLevel") or device.security_patch_level
    device.enrolled_at = _parse_google_time(payload.get("enrollmentTime")) or device.enrolled_at
    device.last_reported_at = _parse_google_time(payload.get("lastStatusReportTime")) or device.last_reported_at
    device.last_sync_at = now
    device.hardware_info = hardware
    device.software_info = software
    device.network_info = network
    device.application_reports = reports


class AndroidManagementSyncService:
    def __init__(self, amapi: AndroidManagementService):
        self.amapi = amapi

    async def sync_tenant(self, db: AsyncSession, tenant: Tenant) -> SyncResult:
        started_at = datetime.now(timezone.utc)
        tenant.last_sync_started_at = started_at

        if not tenant.enterprise_id or tenant.enterprise_id.startswith("pending:"):
            tenant.amapi_connection_status = "not_linked"
            tenant.last_amapi_error = "enterprise_not_linked"
            completed_at = datetime.now(timezone.utc)
            tenant.last_sync_completed_at = completed_at
            return SyncResult(tenant.id, "not_linked", 0, 0, 0, 0, started_at, completed_at, "enterprise_not_linked")

        devices_seen = devices_created = devices_updated = policies_published = 0
        now = datetime.now(timezone.utc)
        try:
            # A failed page or policy publish must not leave a half-refreshed
            # device cache. The AMAPI calls are external and cannot be rolled
            # back, but all local state from this sync is isolated in a
            # savepoint and is discarded on failure.
            async with db.begin_nested():
                policies = (
                    await db.execute(select(Policy).where(Policy.tenant_id == tenant.id))
                ).scalars().all()
                for policy in policies:
                    if (
                        policy.google_policy_name is None
                        or policy.last_publish_error is not None
                    ) and await publish_policy(policy, tenant, self.amapi):
                        policies_published += 1
                    if policy.google_policy_name:
                        remote_policy = await self.amapi.get_policy(policy.google_policy_name)
                        policy.remote_policy_json = remote_policy
                        policy.last_remote_sync_at = now
                        policy.last_publish_error = None
                        db.add(policy)
                policy_by_google_name = {
                    policy.google_policy_name: policy
                    for policy in policies
                    if policy.google_policy_name
                }

                page_token = ""
                while True:
                    page = await self.amapi.list_devices(
                        tenant.enterprise_id, page_size=100, page_token=page_token
                    )
                    for payload in page.get("devices", []):
                        if not isinstance(payload, dict) or not payload.get("name"):
                            continue
                        devices_seen += 1
                        device_name = payload["name"]
                        device = (
                            await db.execute(select(Device).where(Device.device_name == device_name))
                        ).scalar_one_or_none()
                        if device is None:
                            device = Device(tenant_id=tenant.id, device_name=device_name)
                            db.add(device)
                            devices_created += 1
                        elif device.tenant_id != tenant.id:
                            raise RuntimeError("device_resource_belongs_to_another_tenant")
                        else:
                            devices_updated += 1

                        apply_google_device(device, payload, now)
                        remote_policy = policy_by_google_name.get(device.policy_name)
                        if remote_policy:
                            device.policy_id = remote_policy.id
                        db.add(device)

                    page_token = page.get("nextPageToken", "") or ""
                    if not page_token:
                        break

                await self._update_managed_app_versions(db, tenant.id, now)
                completed_at = datetime.now(timezone.utc)
                tenant.amapi_connection_status = "mock" if self.amapi.mode == "mock" else "connected"
                tenant.last_amapi_success_at = completed_at
                tenant.last_amapi_error = None
                tenant.last_sync_completed_at = completed_at
                # Force ORM/database errors into the savepoint rather than
                # letting the outer request transaction commit a partial sync.
                await db.flush()
            return SyncResult(tenant.id, "success", devices_seen, devices_created, devices_updated, policies_published, started_at, completed_at)
        except Exception as exc:
            completed_at = datetime.now(timezone.utc)
            tenant.amapi_connection_status = "error"
            tenant.last_amapi_error = type(exc).__name__
            tenant.last_sync_completed_at = completed_at
            return SyncResult(tenant.id, "error", devices_seen, devices_created, devices_updated, policies_published, started_at, completed_at, type(exc).__name__)

    async def _update_managed_app_versions(
        self, db: AsyncSession, tenant_id: int, now: datetime
    ) -> None:
        apps = (
            await db.execute(
                select(ManagedApplication).where(ManagedApplication.tenant_id == tenant_id)
            )
        ).scalars().all()
        devices = (
            await db.execute(select(Device).where(Device.tenant_id == tenant_id))
        ).scalars().all()
        for app in apps:
            reported_versions = [
                (
                    device.last_reported_at or device.last_sync_at or datetime.min.replace(tzinfo=timezone.utc),
                    report.get("versionName"),
                )
                for device in devices
                for report in [(device.application_reports or {}).get(app.package_name, {})]
                if report.get("versionName")
            ]
            if reported_versions:
                # Android version names are arbitrary strings (for example,
                # "1.10" sorts before "1.9" lexicographically). Report the
                # version from the most recently reporting device instead of
                # pretending that a textual comparison is a version ordering.
                app.last_known_version = max(reported_versions, key=lambda item: item[0])[1]
            app.last_sync_at = now
            db.add(app)

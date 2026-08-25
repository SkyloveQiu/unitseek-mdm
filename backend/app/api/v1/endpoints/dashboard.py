import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_approved
from app.models.device import Device
from app.models.device_group import DeviceGroup
from app.models.policy import Policy
from app.models.user import User
from app.schemas.dashboard import DashboardStats

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(require_approved),
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregated dashboard statistics for the current tenant.
    Includes device counts by state, compliance, OS version, and
    recent enrollment activity.
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not assigned to a tenant",
        )

    tenant_id = current_user.tenant_id

    # Total devices (exclude deleted)
    total_result = await db.execute(
        select(func.count(Device.id)).where(
            Device.tenant_id == tenant_id,
            Device.state != "deleted",
        )
    )
    total_devices = total_result.scalar() or 0

    # Active devices
    active_result = await db.execute(
        select(func.count(Device.id)).where(
            Device.tenant_id == tenant_id,
            Device.state == "active",
        )
    )
    active_devices = active_result.scalar() or 0

    # Compliant devices
    compliant_result = await db.execute(
        select(func.count(Device.id)).where(
            Device.tenant_id == tenant_id,
            Device.compliance_state == "compliant",
            Device.state != "deleted",
        )
    )
    compliant_devices = compliant_result.scalar() or 0

    # Non-compliant devices
    non_compliant_result = await db.execute(
        select(func.count(Device.id)).where(
            Device.tenant_id == tenant_id,
            Device.compliance_state == "non_compliant",
            Device.state != "deleted",
        )
    )
    non_compliant_devices = non_compliant_result.scalar() or 0

    # Policy count
    policies_result = await db.execute(
        select(func.count(Policy.id)).where(Policy.tenant_id == tenant_id)
    )
    policies_count = policies_result.scalar() or 0

    # Group count
    groups_result = await db.execute(
        select(func.count(DeviceGroup.id)).where(DeviceGroup.tenant_id == tenant_id)
    )
    groups_count = groups_result.scalar() or 0

    # Recent enrollments (last 7 days)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_result = await db.execute(
        select(func.count(Device.id)).where(
            Device.tenant_id == tenant_id,
            Device.enrolled_at >= seven_days_ago,
        )
    )
    recent_enrollments = recent_result.scalar() or 0

    # Devices that have delivered a status report in the last 24 hours. This
    # is deliberately based on AMAPI's report timestamp, not local sync time.
    reporting_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    recently_reporting_result = await db.execute(
        select(func.count(Device.id)).where(
            Device.tenant_id == tenant_id,
            Device.state != "deleted",
            Device.last_reported_at >= reporting_cutoff,
        )
    )
    recently_reporting_devices = recently_reporting_result.scalar() or 0

    # The initial rollout groups are intentionally ordinary groups so more can
    # be added later. Resolve their IDs by name rather than hard-coding IDs.
    rollout_groups = (
        await db.execute(
            select(DeviceGroup.id, DeviceGroup.name).where(
                DeviceGroup.tenant_id == tenant_id,
                func.lower(DeviceGroup.name).in_(["testing", "production"]),
            )
        )
    ).all()
    rollout_group_ids = {name.lower(): group_id for group_id, name in rollout_groups}
    async def _group_device_count(group_id: int | None) -> int:
        if group_id is None:
            return 0
        return (
            await db.execute(
                select(func.count(Device.id)).where(
                    Device.tenant_id == tenant_id,
                    Device.group_id == group_id,
                    Device.state != "deleted",
                )
            )
        ).scalar() or 0

    testing_devices = await _group_device_count(rollout_group_ids.get("testing"))
    production_devices = await _group_device_count(rollout_group_ids.get("production"))

    reported_devices = (
        await db.execute(
            select(Device.application_reports).where(
                Device.tenant_id == tenant_id,
                Device.state != "deleted",
            )
        )
    ).scalars().all()
    devices_with_application_problems = sum(
        1
        for reports in reported_devices
        if any(
            isinstance(report, dict)
            and (
                report.get("installFailureReason")
                or report.get("installationFailureReason")
                or report.get("installState") in {"INSTALLATION_FAILED", "INSTALL_FAILED"}
            )
            for report in (reports or {}).values()
        )
    )

    # Devices by state
    state_result = await db.execute(
        select(Device.state, func.count(Device.id))
        .where(Device.tenant_id == tenant_id)
        .group_by(Device.state)
    )
    devices_by_state = {row[0]: row[1] for row in state_result.all()}

    # Devices by OS version
    os_result = await db.execute(
        select(
            func.coalesce(Device.os_version, "Unknown"),
            func.count(Device.id),
        )
        .where(
            Device.tenant_id == tenant_id,
            Device.state != "deleted",
        )
        .group_by(Device.os_version)
    )
    devices_by_os = {row[0]: row[1] for row in os_result.all()}

    return DashboardStats(
        total_devices=total_devices,
        active_devices=active_devices,
        compliant_devices=compliant_devices,
        non_compliant_devices=non_compliant_devices,
        policies_count=policies_count,
        groups_count=groups_count,
        recent_enrollments=recent_enrollments,
        recently_reporting_devices=recently_reporting_devices,
        testing_devices=testing_devices,
        production_devices=production_devices,
        devices_with_application_problems=devices_with_application_problems,
        devices_by_state=devices_by_state,
        devices_by_os=devices_by_os,
    )

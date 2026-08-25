from datetime import datetime, timezone

import pytest

from app.models.device import Device
from app.models.managed_application import ManagedApplication
from app.models.policy import Policy
from app.services.audit import _safe_details
from app.services.device_commands import wipe_confirmation_matches
from app.services.policy_management import (
    app_entry_from_managed_app,
    enable_single_app_kiosk,
    google_policy_id,
    replace_application_in_policy,
    with_default_inventory_reporting,
)
from app.services.sync import apply_google_device


def test_private_app_policy_defaults_to_force_install_and_high_priority_updates():
    app = ManagedApplication(
        id=1,
        tenant_id=1,
        package_name="com.company.control",
        install_type="FORCE_INSTALLED",
        auto_update_mode="AUTO_UPDATE_HIGH_PRIORITY",
        is_required=True,
        is_kiosk_app=False,
    )

    assert app_entry_from_managed_app(app) == {
        "packageName": "com.company.control",
        "installType": "FORCE_INSTALLED",
        "autoUpdateMode": "AUTO_UPDATE_HIGH_PRIORITY",
    }


def test_inventory_reporting_defaults_preserve_explicit_tenant_choices():
    policy_json = {
        "statusReportingSettings": {
            "applicationReportsEnabled": False,
        }
    }

    normalized = with_default_inventory_reporting(policy_json)

    assert normalized == {
        "statusReportingSettings": {
            "applicationReportsEnabled": False,
            "softwareInfoEnabled": True,
        }
    }
    assert policy_json["statusReportingSettings"] == {"applicationReportsEnabled": False}


def test_private_app_can_target_a_managed_google_play_closed_track():
    app = ManagedApplication(
        id=2,
        tenant_id=1,
        package_name="com.company.control",
        install_type="FORCE_INSTALLED",
        auto_update_mode="AUTO_UPDATE_HIGH_PRIORITY",
        is_required=True,
        is_kiosk_app=False,
        metadata_json={"accessible_track_ids": ["testing-track"]},
    )

    assert app_entry_from_managed_app(app)["accessibleTrackIds"] == ["testing-track"]


def test_kiosk_replaces_existing_kiosk_app_without_removing_required_app():
    policy = Policy(
        id=7,
        tenant_id=1,
        name="Production policy",
        policy_json={
            "applications": [
                {"packageName": "com.company.old", "installType": "KIOSK"},
                {"packageName": "com.company.required", "installType": "FORCE_INSTALLED"},
            ]
        },
        version=1,
    )

    enable_single_app_kiosk(policy, "com.company.control")
    replace_application_in_policy(
        policy,
        package_name="com.company.control",
        entry={
            "packageName": "com.company.control",
            "installType": "KIOSK",
            "autoUpdateMode": "AUTO_UPDATE_HIGH_PRIORITY",
        },
    )

    apps = {entry["packageName"]: entry for entry in policy.policy_json["applications"]}
    assert apps["com.company.old"]["installType"] == "FORCE_INSTALLED"
    assert apps["com.company.required"]["installType"] == "FORCE_INSTALLED"
    assert apps["com.company.control"]["installType"] == "KIOSK"
    assert google_policy_id(policy).startswith("policy-7-production-policy")


def test_sync_maps_device_inventory_compliance_reports_and_app_versions():
    device = Device(tenant_id=1, device_name="enterprises/e/devices/d")
    now = datetime.now(timezone.utc)

    apply_google_device(
        device,
        {
            "name": device.device_name,
            "state": "ACTIVE",
            "managementMode": "DEVICE_OWNER",
            "policyCompliant": False,
            "policyName": "enterprises/e/policies/production",
            "enrollmentTime": "2026-08-20T12:00:00Z",
            "lastStatusReportTime": "2026-08-25T12:00:00Z",
            "hardwareInfo": {"serialNumber": "SERIAL-1", "manufacturer": "Acme", "model": "Tablet"},
            "softwareInfo": {"androidVersion": "15", "apiLevel": 35, "securityPatchLevel": "2026-08-01"},
            "applicationReports": [
                {"packageName": "com.company.control", "versionName": "1.1", "installState": "INSTALLED"}
            ],
        },
        now,
    )

    assert device.state == "active"
    assert device.compliance_state == "non_compliant"
    assert device.serial_number == "SERIAL-1"
    assert device.security_patch_level == "2026-08-01"
    assert device.application_reports["com.company.control"]["versionName"] == "1.1"
    assert device.last_reported_at == datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)


@pytest.mark.parametrize("value", ["password", "token_value", "credentials"])
def test_audit_details_redact_sensitive_values(value):
    assert _safe_details({value: "secret", "visible": "safe"}) == {
        value: "[redacted]",
        "visible": "safe",
    }


def test_wipe_requires_an_exact_device_specific_confirmation():
    assert wipe_confirmation_matches(42, "WIPE 42")
    assert not wipe_confirmation_matches(42, "WIPE 41")
    assert not wipe_confirmation_matches(42, "wipe 42")

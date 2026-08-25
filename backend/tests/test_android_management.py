import pytest
from pydantic import ValidationError

from app.schemas.enrollment import EnrollmentTokenCreate
from app.services.android_management import (
    AndroidManagementConfigurationError,
    AndroidManagementService,
)


def test_mock_health_is_explicit_and_non_production():
    service = AndroidManagementService(mode="mock")

    assert service.health() == {"status": "mock", "mode": "mock"}


@pytest.mark.asyncio
async def test_mock_enrollment_token_is_available_for_local_ui_development():
    service = AndroidManagementService(mode="mock")

    token = await service.create_enrollment_token(
        enterprise_name="enterprises/mock",
        policy_name="enterprises/mock/policies/testing",
    )

    assert token is not None
    assert token["value"]
    assert token["policyName"].endswith("policies/testing")


@pytest.mark.asyncio
async def test_real_mode_never_falls_back_to_mock_data():
    service = AndroidManagementService(
        mode="real",
        project_id="project-id",
        credentials_path="missing-service-account.json",
    )

    with pytest.raises(AndroidManagementConfigurationError):
        await service.list_devices("enterprises/example")


@pytest.mark.asyncio
async def test_wipe_is_not_sent_as_an_issue_command():
    service = AndroidManagementService(mode="mock")

    with pytest.raises(ValueError, match="Unknown command"):
        await service.send_command("enterprises/example/devices/1", "wipe")


@pytest.mark.asyncio
async def test_password_reset_requires_an_explicit_new_password():
    service = AndroidManagementService(mode="mock")

    with pytest.raises(ValueError, match="new_password"):
        await service.send_command("enterprises/example/devices/1", "reset_password")


@pytest.mark.asyncio
async def test_dedicated_enrollment_uses_google_personal_usage_restriction(monkeypatch):
    captured: dict = {}

    class Execute:
        def execute(self):
            return {"name": "enterprises/e/enrollmentTokens/t", "value": "token"}

    class EnrollmentTokens:
        def create(self, **kwargs):
            captured.update(kwargs)
            return Execute()

    class Enterprises:
        def enrollmentTokens(self):
            return EnrollmentTokens()

    class FakeService:
        def enterprises(self):
            return Enterprises()

    service = AndroidManagementService(
        mode="real", project_id="project-id", credentials_path="unused.json"
    )
    monkeypatch.setattr(service, "_get_service", lambda: FakeService())

    await service.create_enrollment_token(
        enterprise_name="enterprises/e",
        policy_name="enterprises/e/policies/p",
        allow_personal_usage="PERSONAL_USAGE_DISALLOWED_USERLESS",
    )

    assert captured["parent"] == "enterprises/e"
    assert captured["body"]["allowPersonalUsage"] == "PERSONAL_USAGE_DISALLOWED_USERLESS"


def test_enrollment_token_does_not_advertise_an_unenforceable_use_limit():
    with pytest.raises(ValidationError):
        EnrollmentTokenCreate(policy_id=1, max_uses=2)


@pytest.mark.asyncio
async def test_mock_policy_read_is_available_for_policy_state_sync():
    service = AndroidManagementService(mode="mock")

    policy = await service.get_policy("enterprises/mock/policies/testing")

    assert policy == {"name": "enterprises/mock/policies/testing"}


@pytest.mark.asyncio
async def test_mock_enterprise_read_exposes_the_google_display_name():
    service = AndroidManagementService(mode="mock")

    enterprise = await service.get_enterprise("enterprises/mock")

    assert enterprise == {
        "name": "enterprises/mock",
        "enterpriseDisplayName": "Mock Android Enterprise",
    }

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.devices import update_device
from app.core.deps import require_admin, require_approved
from app.models.device import Device
from app.models.device_group import DeviceGroup
from app.models.policy import Policy
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.device import DeviceUpdate


class _Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalar(self):
        return self.value


class _Session:
    def __init__(self, results):
        self.results = list(results)
        self.added = []

    async def execute(self, _statement):
        return _Result(self.results.pop(0))

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        return None

    async def refresh(self, _item):
        return None


def _user(*, admin: bool = True, approved: bool = True) -> User:
    return User(
        id=1,
        tenant_id=1,
        email="admin@example.com",
        hashed_password="hash",
        full_name="Admin",
        is_admin=admin,
        is_approved=approved,
        is_active=True,
    )


@pytest.mark.asyncio
async def test_authorization_rejects_non_admin_and_unapproved_accounts():
    with pytest.raises(HTTPException) as admin_error:
        await require_admin(_user(admin=False))
    assert admin_error.value.status_code == 403

    with pytest.raises(HTTPException) as approval_error:
        await require_approved(_user(approved=False))
    assert approval_error.value.status_code == 403


@pytest.mark.asyncio
async def test_group_move_assigns_its_default_policy_and_writes_audit_event():
    device = Device(id=10, tenant_id=1, state="active")
    group = DeviceGroup(id=2, tenant_id=1, name="Production", default_policy_id=3)
    policy = Policy(id=3, tenant_id=1, name="production", policy_json={}, version=1)
    tenant = Tenant(id=1, name="Example", code="EXAMPLE")
    session = _Session([device, group, policy, tenant, group, 1])

    updated = await update_device(
        device_id=10,
        update_data=DeviceUpdate(group_id=2),
        current_user=_user(),
        db=session,
    )

    assert updated.group_id == 2
    assert updated.policy_id == 3
    assert group.device_count == 1
    assert any(getattr(item, "action", None) == "device.group_moved" for item in session.added)


@pytest.mark.asyncio
async def test_rename_sets_trimmed_display_name_and_writes_audit_event():
    device = Device(id=10, tenant_id=1, state="active")
    session = _Session([device])

    updated = await update_device(
        device_id=10,
        update_data=DeviceUpdate(display_name="  Warehouse scanner 01  "),
        current_user=_user(),
        db=session,
    )

    assert updated.display_name == "Warehouse scanner 01"
    assert updated.group_id is None
    assert any(getattr(item, "action", None) == "device.updated" for item in session.added)


@pytest.mark.asyncio
async def test_blank_rename_clears_display_name():
    device = Device(id=10, tenant_id=1, state="active", display_name="Old name")
    session = _Session([device])

    updated = await update_device(
        device_id=10,
        update_data=DeviceUpdate(display_name="   "),
        current_user=_user(),
        db=session,
    )

    assert updated.display_name is None
    assert any(getattr(item, "action", None) == "device.updated" for item in session.added)


@pytest.mark.asyncio
async def test_group_move_without_display_name_keeps_existing_name():
    device = Device(id=10, tenant_id=1, state="active", display_name="Front desk")
    session = _Session([device])

    updated = await update_device(
        device_id=10,
        update_data=DeviceUpdate(group_id=None),
        current_user=_user(),
        db=session,
    )

    assert updated.display_name == "Front desk"
    assert not any(getattr(item, "action", None) == "device.updated" for item in session.added)

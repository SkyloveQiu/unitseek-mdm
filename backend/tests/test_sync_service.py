from contextlib import AbstractAsyncContextManager
from datetime import datetime, timezone

import pytest

from app.models.policy import Policy
from app.models.device import Device
from app.models.managed_application import ManagedApplication
from app.models.tenant import Tenant
from app.services.sync import AndroidManagementSyncService


class _ScalarResult:
    def __init__(self, values):
        self.values = values

    def all(self):
        return self.values


class _Result:
    def __init__(self, values):
        self.values = values

    def scalars(self):
        return _ScalarResult(self.values)


class _Savepoint(AbstractAsyncContextManager):
    def __init__(self):
        self.entered = False
        self.error_type = None

    async def __aenter__(self):
        self.entered = True
        return self

    async def __aexit__(self, exc_type, _exc, _traceback):
        self.error_type = exc_type
        return False


class _Session:
    def __init__(self, results):
        self.results = list(results)
        self.savepoint = _Savepoint()
        self.added = []
        self.flushes = 0

    def begin_nested(self):
        return self.savepoint

    async def execute(self, _statement):
        return _Result(self.results.pop(0))

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        self.flushes += 1


class _AMAPI:
    mode = "real"

    def __init__(self, *, fail_inventory=False):
        self.fail_inventory = fail_inventory
        self.remote_policy_reads = []

    async def create_policy(self, enterprise_name, policy_id, policy_json):
        return {"name": f"{enterprise_name}/policies/{policy_id}", **policy_json}

    async def get_policy(self, policy_name):
        self.remote_policy_reads.append(policy_name)
        return {"name": policy_name, "applications": []}

    async def list_devices(self, _enterprise_name, **_kwargs):
        if self.fail_inventory:
            raise RuntimeError("inventory_unavailable")
        return {"devices": [], "nextPageToken": ""}


@pytest.mark.asyncio
async def test_sync_reads_back_published_policy_inside_a_savepoint():
    tenant = Tenant(id=1, name="Example", code="EXAMPLE", enterprise_id="enterprises/e")
    policy = Policy(id=7, tenant_id=1, name="Testing", policy_json={})
    db = _Session([[policy], [], []])
    amapi = _AMAPI()

    result = await AndroidManagementSyncService(amapi).sync_tenant(db, tenant)

    assert result.status == "success"
    assert result.policies_published == 1
    assert db.savepoint.entered
    assert db.savepoint.error_type is None
    assert db.flushes == 1
    assert policy.last_remote_sync_at is not None
    assert policy.remote_policy_json == {
        "name": policy.google_policy_name,
        "applications": [],
    }
    assert amapi.remote_policy_reads == [policy.google_policy_name]


@pytest.mark.asyncio
async def test_failed_sync_exits_savepoint_and_records_only_error_state():
    tenant = Tenant(id=1, name="Example", code="EXAMPLE", enterprise_id="enterprises/e")
    policy = Policy(id=7, tenant_id=1, name="Testing", policy_json={})
    db = _Session([[policy]])
    amapi = _AMAPI(fail_inventory=True)

    result = await AndroidManagementSyncService(amapi).sync_tenant(db, tenant)

    assert result.status == "error"
    assert result.error == "RuntimeError"
    assert db.savepoint.entered
    assert db.savepoint.error_type is RuntimeError
    assert tenant.amapi_connection_status == "error"
    assert tenant.last_sync_completed_at is not None


@pytest.mark.asyncio
async def test_managed_app_version_uses_the_most_recent_device_report():
    app = ManagedApplication(
        id=1,
        tenant_id=1,
        package_name="com.company.control",
    )
    older_device = Device(
        tenant_id=1,
        last_reported_at=datetime(2026, 8, 25, 10, 0, tzinfo=timezone.utc),
        application_reports={"com.company.control": {"versionName": "1.9"}},
    )
    newer_device = Device(
        tenant_id=1,
        last_reported_at=datetime(2026, 8, 25, 11, 0, tzinfo=timezone.utc),
        application_reports={"com.company.control": {"versionName": "1.10"}},
    )
    db = _Session([[app], [older_device, newer_device]])

    await AndroidManagementSyncService(_AMAPI())._update_managed_app_versions(
        db, tenant_id=1, now=datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)
    )

    assert app.last_known_version == "1.10"

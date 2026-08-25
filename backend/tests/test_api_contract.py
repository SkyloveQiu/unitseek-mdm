from app.main import create_app


def test_mvp_routes_are_registered_without_legacy_policy_app_mutations():
    app = create_app()
    routes = {
        (route.path, method)
        for route in app.routes
        for method in getattr(route, "methods", set())
    }

    required_routes = {
        ("/api/v1/devices", "GET"),
        ("/api/v1/devices/{device_id}", "GET"),
        ("/api/v1/enrollment/tokens", "POST"),
        ("/api/v1/policies", "GET"),
        ("/api/v1/policies", "POST"),
        ("/api/v1/policies/{policy_id}", "PUT"),
        ("/api/v1/groups", "GET"),
        ("/api/v1/groups", "POST"),
        ("/api/v1/groups/{group_id}", "PUT"),
        ("/api/v1/devices/{device_id}/commands/wipe", "POST"),
        ("/api/v1/devices/{device_id}/commands/{command}", "POST"),
        ("/api/v1/apps", "GET"),
        ("/api/v1/apps/{package_name}", "PUT"),
        ("/api/v1/sync", "POST"),
    }

    assert required_routes <= routes
    assert not any("/apps/policies/" in path for path, _method in routes)

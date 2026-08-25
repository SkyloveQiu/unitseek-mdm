from fastapi import APIRouter

from app.api.v1.endpoints import (
    apps,
    audit,
    auth,
    dashboard,
    devices,
    enrollment,
    enterprise,
    groups,
    policies,
    settings,
    sync,
    tenants,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(audit.router)
api_router.include_router(devices.router)
api_router.include_router(policies.router)
api_router.include_router(groups.router)
api_router.include_router(enrollment.router)
api_router.include_router(dashboard.router)
api_router.include_router(tenants.router)
api_router.include_router(settings.router)
api_router.include_router(apps.router)
api_router.include_router(enterprise.router)
api_router.include_router(sync.router)

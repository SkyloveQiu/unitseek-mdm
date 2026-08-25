import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.router import api_router
from app.config import settings
from app.core.security import csrf_token_matches
from app.database import async_session_factory
from app.models.tenant import Tenant
from app.services.android_management import AndroidManagementService
from app.services.sync import AndroidManagementSyncService

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events."""
    settings.validate_runtime()
    logger.info("Unitseek MDM API started - %s mode", settings.DEPLOYMENT_MODE)
    sync_task: asyncio.Task[None] | None = None

    async def periodic_sync_loop() -> None:
        while True:
            await asyncio.sleep(settings.SYNC_INTERVAL_MINUTES * 60)
            try:
                async with async_session_factory() as db:
                    tenants = (
                        await db.execute(
                            select(Tenant).where(
                                Tenant.enterprise_id.is_not(None),
                                Tenant.is_active.is_(True),
                            )
                        )
                    ).scalars().all()
                    amapi = AndroidManagementService(
                        credentials_path=settings.GCP_CREDENTIALS_PATH,
                        project_id=settings.GCP_PROJECT_ID,
                        mode=settings.AMAPI_MODE,
                    )
                    sync_service = AndroidManagementSyncService(amapi)
                    for tenant in tenants:
                        result = await sync_service.sync_tenant(db, tenant)
                        if result.status == "error":
                            logger.warning(
                                "Scheduled AMAPI sync failed for tenant %s: %s",
                                tenant.id,
                                result.error,
                            )
                    await db.commit()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Scheduled AMAPI sync loop failed: %s", type(exc).__name__)

    if settings.SYNC_ENABLED:
        sync_task = asyncio.create_task(periodic_sync_loop(), name="amapi-periodic-sync")
    try:
        yield
    finally:
        if sync_task is not None:
            sync_task.cancel()
            try:
                await sync_task
            except asyncio.CancelledError:
                pass
        logger.info("Unitseek MDM API shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Unitseek MDM API",
        description=(
            "Self-hosted Android Enterprise device manager built on the "
            "Google Android Management API."
        ),
        version="0.1.0",
        docs_url="/docs" if settings.ENABLE_DOCS else None,
        redoc_url="/redoc" if settings.ENABLE_DOCS else None,
        openapi_url="/openapi.json" if settings.ENABLE_DOCS else None,
        redirect_slashes=False,
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API v1 router
    app.include_router(api_router, prefix="/api/v1")

    @app.middleware("http")
    async def add_security_headers(request, call_next):
        """Apply browser protections and CSRF validation for cookie sessions."""
        if (
            request.method not in {"GET", "HEAD", "OPTIONS"}
            and request.url.path.startswith("/api/v1/")
            and request.cookies.get(settings.SESSION_COOKIE_NAME)
            and not csrf_token_matches(request)
        ):
            response = JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "CSRF token missing or invalid"},
            )
        else:
            response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        return response

    # Health check
    @app.get("/health/live", tags=["Health"])
    async def liveness_check():
        return {
            "status": "ok",
            "app": settings.APP_NAME,
            "version": "0.1.0",
            "deployment_mode": settings.DEPLOYMENT_MODE,
        }

    @app.get("/health/ready", tags=["Health"])
    async def readiness_check():
        """Report whether local dependencies and AMAPI configuration are ready."""
        checks: dict[str, object] = {}
        ready = True

        try:
            async with async_session_factory() as session:
                await session.execute(text("SELECT 1"))
            checks["database"] = {"status": "ok"}
        except SQLAlchemyError as exc:
            logger.warning("Database readiness check failed: %s", type(exc).__name__)
            checks["database"] = {"status": "error"}
            ready = False

        amapi = AndroidManagementService(
            credentials_path=settings.GCP_CREDENTIALS_PATH,
            project_id=settings.GCP_PROJECT_ID,
            mode=settings.AMAPI_MODE,
        )
        amapi_check = amapi.health()
        checks["amapi"] = amapi_check
        if amapi_check["status"] == "error":
            ready = False

        payload = {
            "status": "ok" if ready else "not_ready",
            "app": settings.APP_NAME,
            "version": "0.1.0",
            "checks": checks,
        }
        return JSONResponse(
            status_code=status.HTTP_200_OK if ready else status.HTTP_503_SERVICE_UNAVAILABLE,
            content=payload,
        )

    @app.get("/health", tags=["Health"])
    async def health_check():
        """Backward-compatible alias for the liveness endpoint."""
        return await liveness_check()

    return app


app = create_app()

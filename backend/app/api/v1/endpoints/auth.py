import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.rate_limit import SlidingWindowRateLimiter
from app.config import settings
from app.core.security import (
    create_access_token,
    get_password_hash,
    normalize_email,
    verify_password,
)
from app.models.tenant import Tenant
from app.models.device_group import DeviceGroup
from app.models.user import User
from app.schemas.user import (
    BootstrapStatus,
    BrowserSession,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
)
from app.services.audit import record_audit_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])
login_limiter = SlidingWindowRateLimiter(
    limit=settings.AUTH_LOGIN_MAX_ATTEMPTS,
    window_seconds=settings.AUTH_LOGIN_WINDOW_SECONDS,
)


@router.get("/bootstrap-status", response_model=BootstrapStatus)
async def get_bootstrap_status(
    db: AsyncSession = Depends(get_db),
):
    """Expose only whether a fresh installation needs its first administrator."""
    user_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    return BootstrapStatus(initial_administrator_required=user_count == 0)


def _login_rate_limit_key(request: Request, email: str) -> str:
    ip_address = request.client.host if request.client else "unknown"
    return f"{ip_address}:{email}"


async def _authenticate_login_credentials(
    credentials: UserLogin,
    request: Request,
    db: AsyncSession,
) -> User:
    """Authenticate credentials with the shared browser/API login limit."""
    email = normalize_email(credentials.email)
    rate_limit_key = _login_rate_limit_key(request, email)
    if not login_limiter.is_allowed(rate_limit_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
            headers={"Retry-After": str(settings.AUTH_LOGIN_WINDOW_SECONDS)},
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(credentials.password, user.hashed_password):
        login_limiter.record_failure(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    login_limiter.reset(rate_limit_key)
    return user


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user.

    The first user registered in the system automatically becomes admin and
    gets approved. A default tenant is also created for them. Subsequent
    users must be approved by an admin.
    """
    email = normalize_email(user_data.email)

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    # MySQL named locks serialize bootstrap attempts across workers. The lock
    # is held by this session until it is released after the user transaction
    # commits, so two simultaneous registrations cannot both become admins.
    lock_name = "easy_mdm_initial_administrator"
    use_mysql_lock = settings.DATABASE_URL.startswith("mysql+")
    if use_mysql_lock:
        lock_result = await db.execute(
            text("SELECT GET_LOCK(:lock_name, :timeout_seconds)"),
            {"lock_name": lock_name, "timeout_seconds": 15},
        )
        if lock_result.scalar() != 1:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Initial administrator registration is busy. Please retry.",
            )
    else:
        # Preserve the lightweight PostgreSQL development path. Its advisory
        # transaction lock is released automatically by the request commit.
        await db.execute(
            text("SELECT pg_advisory_xact_lock(:lock_id)"),
            {"lock_id": 918273645},
        )

    try:
        # Check if this is the first user after acquiring the database lock.
        count_result = await db.execute(select(func.count(User.id)))
        user_count = count_result.scalar()
        is_first_user = user_count == 0
        if not is_first_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The initial administrator has already been created.",
            )

        # Create the user
        user = User(
            email=email,
            hashed_password=get_password_hash(user_data.password),
            full_name=user_data.full_name,
            is_active=True,
            is_admin=is_first_user,
            is_approved=is_first_user,
            approved_at=datetime.now(timezone.utc) if is_first_user else None,
        )

        # First user: create a default tenant
        default_tenant = Tenant(
            name="Default Organization",
            code="DEFAULT",
            is_active=True,
            contact_email=email,
        )
        db.add(default_tenant)
        await db.flush()
        db.add_all([
            DeviceGroup(tenant_id=default_tenant.id, name="Testing", description="Pre-production validation devices"),
            DeviceGroup(tenant_id=default_tenant.id, name="Production", description="Production dedicated devices"),
        ])
        user.tenant_id = default_tenant.id
        logger.info(
            f"First user registered: {email} (auto-admin, tenant: DEFAULT)"
        )

        db.add(user)
        await db.flush()
        await db.refresh(user)

        logger.info(f"User registered: {email} (admin={user.is_admin})")
        if user.tenant_id:
            await record_audit_event(
                db,
                tenant_id=user.tenant_id,
                user=user,
                action="user.registered",
                resource_type="user",
                resource_id=user.id,
                details={"is_admin": user.is_admin},
                request=request,
            )
        if use_mysql_lock:
            # Commit before releasing the session-scoped MySQL lock. The
            # generic request dependency observes there is no remaining work.
            await db.commit()
        return user
    finally:
        if use_mysql_lock:
            await db.execute(
                text("SELECT RELEASE_LOCK(:lock_name)"), {"lock_name": lock_name}
            )


@router.post("/login", response_model=BrowserSession)
async def login(
    credentials: UserLogin,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate a user and create an HttpOnly browser session."""
    user = await _authenticate_login_credentials(credentials, request, db)

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "tenant_id": user.tenant_id}
    )
    csrf_token = secrets.token_urlsafe(32)
    session_cookie_options = {
        "max_age": settings.JWT_EXPIRE_MINUTES * 60,
        "secure": settings.SESSION_COOKIE_SECURE,
        "samesite": "lax",
        "path": "/api/v1",
    }
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=access_token,
        httponly=True,
        **session_cookie_options,
    )
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite="lax",
        # The SPA is served at /, so the readable double-submit value must be
        # available there while still being sent to /api/v1 requests.
        path="/",
    )

    logger.info(f"User logged in: {user.email}")
    if user.tenant_id:
        await record_audit_event(
            db,
            tenant_id=user.tenant_id,
            user=user,
            action="user.logged_in",
            resource_type="user",
            resource_id=user.id,
            request=request,
        )
    return BrowserSession(user=UserOut.model_validate(user))


@router.post("/token", response_model=Token)
async def create_api_token(
    credentials: UserLogin,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Issue a short-lived Bearer token for non-browser API clients only."""
    user = await _authenticate_login_credentials(credentials, request, db)
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "tenant_id": user.tenant_id}
    )
    if user.tenant_id:
        await record_audit_event(
            db,
            tenant_id=user.tenant_id,
            user=user,
            action="user.api_token_issued",
            resource_type="user",
            resource_id=user.id,
            request=request,
        )
    return Token(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """End the browser session and invalidate its cookies in the client."""
    response.delete_cookie(settings.SESSION_COOKIE_NAME, path="/api/v1")
    response.delete_cookie(settings.CSRF_COOKIE_NAME, path="/")
    if current_user.tenant_id:
        await record_audit_event(
            db,
            tenant_id=current_user.tenant_id,
            user=current_user,
            action="user.logged_out",
            resource_type="user",
            resource_id=current_user.id,
            request=request,
        )


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return the currently authenticated user's profile."""
    return current_user


@router.put("/me", response_model=UserOut)
async def update_me(
    update_data: UserUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile."""
    if update_data.full_name is not None:
        current_user.full_name = update_data.full_name

    normalized_email = (
        normalize_email(update_data.email) if update_data.email is not None else None
    )
    if normalized_email is not None and normalized_email != current_user.email:
        # Check email uniqueness
        result = await db.execute(
            select(User).where(User.email == normalized_email)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )
        current_user.email = normalized_email

    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)

    if current_user.tenant_id:
        await record_audit_event(
            db,
            tenant_id=current_user.tenant_id,
            user=current_user,
            action="user.profile_updated",
            resource_type="user",
            resource_id=current_user.id,
            request=request,
        )

    return current_user

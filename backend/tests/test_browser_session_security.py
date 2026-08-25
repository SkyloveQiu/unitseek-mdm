from datetime import datetime, timezone

from fastapi import HTTPException, Response
from fastapi.testclient import TestClient
import pytest
from starlette.requests import Request

from app.api.v1.endpoints.auth import create_api_token, get_bootstrap_status, login, register
from app.config import settings
from app.core.deps import get_current_user
from app.core.rate_limit import SlidingWindowRateLimiter
from app.core.security import create_access_token, csrf_token_matches
from app.main import create_app
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin


def _request(*, cookies: str = "", csrf: str = "") -> Request:
    headers = []
    if cookies:
        headers.append((b"cookie", cookies.encode()))
    if csrf:
        headers.append((b"x-csrf-token", csrf.encode()))
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/devices/1/commands/lock",
            "headers": headers,
            "client": ("127.0.0.1", 1234),
        }
    )


class _Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _Session:
    def __init__(self, user):
        self.user = user
        self.added = []

    async def execute(self, _statement, *_args):
        return _Result(self.user)

    def add(self, item):
        self.added.append(item)


class _CountSession:
    def __init__(self, count: int):
        self.count = count

    async def execute(self, _statement):
        return _CountResult(self.count)


class _CountResult:
    def __init__(self, count: int):
        self.count = count

    def scalar(self):
        return self.count


class _RegistrationBlockedSession:
    def __init__(self):
        self.calls = 0

    async def execute(self, _statement, *_args):
        self.calls += 1
        if self.calls == 1:
            return _Result(None)
        return _CountResult(1)


def _user() -> User:
    return User(
        id=1,
        tenant_id=1,
        email="admin@example.com",
        hashed_password="hash",
        full_name="Admin",
        is_active=True,
        is_admin=True,
        is_approved=True,
        created_at=datetime.now(timezone.utc),
    )


def test_csrf_double_submit_requires_matching_values():
    cookie = f"{settings.CSRF_COOKIE_NAME}=expected"

    assert csrf_token_matches(_request(cookies=cookie, csrf="expected"))
    assert not csrf_token_matches(_request(cookies=cookie, csrf="wrong"))
    assert not csrf_token_matches(_request(cookies=cookie))


def test_login_rate_limit_expires_and_resets_failures():
    limiter = SlidingWindowRateLimiter(limit=2, window_seconds=60)

    assert limiter.is_allowed("client", now=100)
    limiter.record_failure("client", now=100)
    limiter.record_failure("client", now=101)
    assert not limiter.is_allowed("client", now=102)
    assert limiter.is_allowed("client", now=161)
    limiter.record_failure("client", now=162)
    limiter.reset("client")
    assert limiter.is_allowed("client", now=163)


@pytest.mark.asyncio
async def test_bootstrap_status_and_registration_reject_after_first_admin():
    assert (await get_bootstrap_status(db=_CountSession(0))).initial_administrator_required
    assert not (await get_bootstrap_status(db=_CountSession(1))).initial_administrator_required

    with pytest.raises(HTTPException) as error:
        await register(
            user_data=UserCreate(
                email="next@example.com",
                password="valid-password",
                full_name="Next User",
            ),
            request=_request(),
            db=_RegistrationBlockedSession(),
        )
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_cookie_session_authentication_is_accepted_without_a_bearer_token():
    user = _user()
    token = create_access_token({"sub": str(user.id)})
    request = _request(cookies=f"{settings.SESSION_COOKIE_NAME}={token}")

    resolved = await get_current_user(request=request, credentials=None, db=_Session(user))

    assert resolved is user
    assert request.state.auth_via_cookie is True


@pytest.mark.asyncio
async def test_login_returns_only_user_data_and_sets_session_and_csrf_cookies(monkeypatch):
    user = _user()
    request = _request()
    response = Response()
    monkeypatch.setattr("app.api.v1.endpoints.auth.verify_password", lambda *_: True)

    result = await login(
        credentials=UserLogin(email=user.email, password="valid-password"),
        request=request,
        response=response,
        db=_Session(user),
    )

    cookies = response.headers.getlist("set-cookie")
    assert result.user.email == user.email
    assert not hasattr(result, "access_token")
    assert any(settings.SESSION_COOKIE_NAME in value and "HttpOnly" in value for value in cookies)
    assert any(settings.CSRF_COOKIE_NAME in value and "HttpOnly" not in value for value in cookies)


@pytest.mark.asyncio
async def test_non_browser_token_endpoint_returns_a_bearer_token_without_cookies(monkeypatch):
    user = _user()
    monkeypatch.setattr("app.api.v1.endpoints.auth.verify_password", lambda *_: True)

    result = await create_api_token(
        credentials=UserLogin(email=user.email, password="valid-password"),
        request=_request(),
        db=_Session(user),
    )

    assert result.token_type == "bearer"
    assert result.access_token.count(".") == 2


def test_cookie_authenticated_write_without_csrf_is_rejected_before_routing(monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", True)
    with TestClient(create_app()) as client:
        response = client.post(
            "/api/v1/not-a-route",
            cookies={settings.SESSION_COOKIE_NAME: "session"},
        )

    assert response.status_code == 403
    assert response.json() == {"detail": "CSRF token missing or invalid"}

from datetime import datetime, timedelta, timezone
import hmac
from typing import Any, Optional

from fastapi import Request

import bcrypt
from jose import JWTError, jwt

from app.config import settings


def normalize_email(email: str) -> str:
    """Normalize login identifiers consistently across registration and login."""
    return email.strip().lower()


def csrf_token_matches(request: Request) -> bool:
    """Validate the double-submit CSRF token for cookie-authenticated requests."""
    expected = request.cookies.get(settings.CSRF_COOKIE_NAME, "")
    supplied = request.headers.get("X-CSRF-Token", "")
    return bool(expected and supplied) and hmac.compare_digest(expected, supplied)


def create_access_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.JWT_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """Decode and validate a JWT access token. Returns payload or None."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Unitseek MDM"
    DEBUG: bool = False
    DEPLOYMENT_MODE: Literal["saas", "selfhosted"] = "selfhosted"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://unitseek_mdm:unitseek_mdm_dev@localhost:5432/unitseek_mdm"
    DATABASE_SSL_CA: str = ""
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 10

    # JWT
    SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    SESSION_COOKIE_NAME: str = "unitseek_mdm_session"
    CSRF_COOKIE_NAME: str = "unitseek_mdm_csrf"
    SESSION_COOKIE_SECURE: bool = False
    AUTH_LOGIN_MAX_ATTEMPTS: int = Field(default=10, ge=1, le=100)
    AUTH_LOGIN_WINDOW_SECONDS: int = Field(default=900, ge=60, le=86400)

    # Google Cloud Platform
    AMAPI_MODE: Literal["mock", "real"] = "mock"
    GCP_PROJECT_ID: str = ""
    GCP_CREDENTIALS_PATH: str = ""
    SYNC_ENABLED: bool = True
    SYNC_INTERVAL_MINUTES: int = Field(default=15, ge=1, le=1440)

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            import json
            return json.loads(v)
        return v

    # API docs
    ENABLE_DOCS: bool = True

    def validate_runtime(self) -> None:
        """Validate settings that must never silently fall back in production."""
        if self.DATABASE_URL.startswith("mysql+"):
            if not self.DATABASE_SSL_CA:
                raise RuntimeError(
                    "DATABASE_SSL_CA is required for MySQL connections"
                )
            if not Path(self.DATABASE_SSL_CA).is_file():
                raise RuntimeError(
                    "DATABASE_SSL_CA does not point to a readable CA certificate"
                )

        if not self.DEBUG:
            if len(self.SECRET_KEY) < 32:
                raise RuntimeError(
                    "SECRET_KEY must contain at least 32 characters when DEBUG=false"
                )
            if self.SECRET_KEY.lower() in {"change-me", "password", "secret"}:
                raise RuntimeError("SECRET_KEY must not use a default value")
            if not self.SESSION_COOKIE_SECURE:
                raise RuntimeError(
                    "SESSION_COOKIE_SECURE must be true when DEBUG=false"
                )

        if "*" in self.CORS_ORIGINS and not self.DEBUG:
            raise RuntimeError("Wildcard CORS_ORIGINS are not allowed when DEBUG=false")

        if self.AMAPI_MODE == "real":
            if not self.GCP_PROJECT_ID:
                raise RuntimeError(
                    "GCP_PROJECT_ID is required when AMAPI_MODE=real"
                )
            if not self.GCP_CREDENTIALS_PATH:
                raise RuntimeError(
                    "GCP_CREDENTIALS_PATH is required when AMAPI_MODE=real"
                )
            if not Path(self.GCP_CREDENTIALS_PATH).is_file():
                raise RuntimeError(
                    "GCP_CREDENTIALS_PATH does not point to a readable file"
                )


settings = Settings()

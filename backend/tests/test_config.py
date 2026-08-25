import pytest

from app.config import Settings


def test_production_requires_a_strong_secret():
    settings = Settings(DEBUG=False, SECRET_KEY="too-short", AMAPI_MODE="mock")

    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        settings.validate_runtime()


def test_real_amapi_requires_project_and_credentials(tmp_path):
    settings = Settings(
        DEBUG=True,
        AMAPI_MODE="real",
        GCP_PROJECT_ID="project-id",
        GCP_CREDENTIALS_PATH=str(tmp_path / "missing.json"),
    )

    with pytest.raises(RuntimeError, match="GCP_CREDENTIALS_PATH"):
        settings.validate_runtime()


def test_mysql_requires_a_certificate_authority_file():
    settings = Settings(
        DEBUG=True,
        DATABASE_URL="mysql+aiomysql://easy_mdm:password@db.example/fleet",
        DATABASE_SSL_CA="",
    )

    with pytest.raises(RuntimeError, match="DATABASE_SSL_CA"):
        settings.validate_runtime()

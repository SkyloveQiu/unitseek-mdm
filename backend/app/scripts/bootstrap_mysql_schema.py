"""Create and stamp a clean Azure MySQL schema exactly once.

The historical Alembic chain was authored for PostgreSQL. A new, empty MySQL
database is initialized from the complete SQLAlchemy metadata, then stamped at
the current Alembic head. Subsequent releases continue to use Alembic normally.
The command refuses to touch a database containing unknown tables.
"""

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.config import settings
from app.database import Base, engine
import app.models  # noqa: F401 - registers all model metadata


def _create_schema_if_empty(sync_connection) -> bool:
    table_names = set(inspect(sync_connection).get_table_names())
    if "alembic_version" in table_names:
        return False
    if table_names:
        raise RuntimeError(
            "Refusing to initialize MySQL: the database contains tables but has no Alembic version."
        )
    Base.metadata.create_all(sync_connection)
    return True


async def _initialize() -> bool:
    try:
        async with engine.begin() as connection:
            return await connection.run_sync(_create_schema_if_empty)
    finally:
        # aiomysql must close its TLS connections on the same event loop that
        # opened them. Disposing in a second asyncio.run() emits a harmless but
        # noisy "Event loop is closed" error during every service start.
        await engine.dispose()


def main() -> None:
    if not settings.DATABASE_URL.startswith("mysql+"):
        raise RuntimeError("bootstrap_mysql_schema only supports a MySQL DATABASE_URL")

    initialized = asyncio.run(_initialize())
    if initialized:
        backend_dir = Path(__file__).resolve().parents[2]
        config = Config(str(backend_dir / "alembic.ini"))
        command.stamp(config, "head")
        print("Initialized and stamped the empty MySQL schema.")
    else:
        print("MySQL schema is already initialized.")


if __name__ == "__main__":
    main()

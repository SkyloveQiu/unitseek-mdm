from collections.abc import AsyncGenerator
import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


def _database_connect_args() -> dict[str, object]:
    """Configure certificate-verified TLS for Azure Database for MySQL."""
    if settings.DATABASE_URL.startswith("mysql+") and settings.DATABASE_SSL_CA:
        return {"ssl": ssl.create_default_context(cafile=settings.DATABASE_SSL_CA)}
    return {}


_uses_aiomysql = settings.DATABASE_URL.startswith("mysql+aiomysql")

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    # aiomysql 0.2 exposes ping(reconnect) while SQLAlchemy's pre-ping hook
    # invokes it without that argument. Recycling avoids stale Azure MySQL
    # connections without issuing the incompatible pre-ping call.
    pool_pre_ping=not _uses_aiomysql,
    pool_recycle=1800 if _uses_aiomysql else -1,
    connect_args=_database_connect_args(),
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

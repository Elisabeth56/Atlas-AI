"""
Async database engine + session management.

Postgres via asyncpg is the only supported driver — this is a deliberate
simplification versus supporting both SQLite and Postgres: one code path,
one set of column types (JSONB, etc.) that behave identically in dev and
prod. Tests spin up a real Postgres (see tests/conftest.py) rather than
faking it with SQLite, since JSONB / UUID semantics differ enough that a
SQLite-backed test suite would give false confidence.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


_engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
)

_SessionFactory = async_sessionmaker(
    bind=_engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a request-scoped async session."""
    async with _SessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def session_scope() -> AsyncGenerator[AsyncSession, None]:
    """
    Context-manager session for use *outside* the FastAPI request cycle —
    the orchestrator runs as a detached background task, not inside a
    request, so it can't use the `get_db` dependency.
    """
    async with _SessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_models() -> None:
    """
    Create all tables if they don't exist. Adequate for hackathon velocity;
    swap for Alembic migrations before this becomes a real product (see
    README "Future Improvements").
    """
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose_engine() -> None:
    await _engine.dispose()


def get_engine() -> AsyncEngine:
    return _engine

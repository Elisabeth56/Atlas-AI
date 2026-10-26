"""Shared fixtures. Integration tests run against a real Postgres (TEST_DATABASE_URL)."""
from __future__ import annotations

import os

os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL", "postgresql+asyncpg://atlas:atlas@localhost:5432/atlas_test"
    ),
)
os.environ.setdefault("DEMO_MODE", "true")

import httpx  # noqa: E402
import pytest  # noqa: E402

from app import models  # noqa: E402, F401  (registers tables on Base)
from app.database import Base, dispose_engine, get_engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
async def db_ready():
    """Fresh tables per test; the engine is disposed after so no connection outlives its event loop."""
    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await dispose_engine()


@pytest.fixture
async def client(db_ready):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

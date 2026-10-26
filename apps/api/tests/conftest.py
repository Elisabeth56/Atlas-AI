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

from pathlib import Path  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.database import dispose_engine, get_engine  # noqa: E402
from app.main import app  # noqa: E402

SUPABASE = Path(__file__).resolve().parents[3] / "supabase"
SCHEMA_SQL = "\n".join(
    p.read_text()
    for p in [SUPABASE / "local" / "auth-stub.sql", *sorted((SUPABASE / "migrations").glob("*.sql")), SUPABASE / "seed.sql"]
)
DEMO_WORKSPACE = "00000000-0000-0000-0000-0000000000d0"


@pytest.fixture
async def db_ready():
    """A fresh database built from the real migrations for every test."""
    async with get_engine().begin() as conn:
        raw = await conn.get_raw_connection()
        await raw.driver_connection.execute(
            "drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;"
            + SCHEMA_SQL
        )
    yield
    await dispose_engine()


@pytest.fixture
async def client(db_ready):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

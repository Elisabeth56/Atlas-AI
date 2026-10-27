"""Sign-in and workspace scoping: no token, a bad token, someone else's run and the hourly limit."""
from __future__ import annotations

import httpx
import pytest
from sqlalchemy import select

from app.config import get_settings
from app.database import get_engine, session_scope
from app.main import app
from app.models import Run, WorkspaceMember
from app.routers import runs as runs_router
from tests.conftest import DEMO_WORKSPACE, token_for

STRANGER = "00000000-0000-0000-0000-0000000000ff"


@pytest.fixture(autouse=True)
def no_pipeline(monkeypatch):
    async def idle(*_args) -> None:
        pass

    monkeypatch.setattr(runs_router, "run_context_phase", idle)


async def _as(user: str | None, method: str, path: str, **kwargs) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token_for(user)}"} if user else {}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t", headers=headers) as c:
        return await c.request(method, path, **kwargs)


async def _demo_run() -> str:
    async with session_scope() as db:
        run = Run(prompt="revenue", workspace_id=DEMO_WORKSPACE)
        db.add(run)
        await db.flush()
        return run.id


async def _add_user(user_id: str) -> None:
    async with get_engine().begin() as conn:
        raw = (await conn.get_raw_connection()).driver_connection
        await raw.execute(f"insert into auth.users (id) values ('{user_id}')")


async def test_no_token_is_401(db_ready):
    response = await _as(None, "GET", "/api/runs")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "sign_in_required"


async def test_expired_token_is_401(db_ready):
    headers = {"Authorization": f"Bearer {token_for(STRANGER, expires_in=-10)}"}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t", headers=headers) as c:
        response = await c.get("/api/runs")
    assert response.json()["error"]["code"] == "invalid_token"


async def test_new_user_gets_their_own_workspace_and_cannot_see_others(db_ready):
    await _add_user(STRANGER)
    demo_run = await _demo_run()

    listed = await _as(STRANGER, "GET", "/api/runs")
    peek = await _as(STRANGER, "GET", f"/api/runs/{demo_run}")
    act = await _as(STRANGER, "POST", f"/api/runs/{demo_run}/writeback/skip")

    assert listed.status_code == 200 and listed.json() == []
    assert peek.status_code == 404
    assert act.status_code == 404
    async with session_scope() as db:
        membership = await db.scalar(select(WorkspaceMember).where(WorkspaceMember.user_id == STRANGER))
    assert membership is not None


async def test_runs_are_created_in_the_callers_workspace(client):
    response = await client.post("/api/runs", json={"prompt": "daily orders"})

    listed = await client.get("/api/runs")
    assert response.status_code == 201
    assert [r["id"] for r in listed.json()] == [response.json()["run_id"]]


async def test_hourly_limit(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "RUNS_PER_HOUR", 2)

    codes = [(await client.post("/api/runs", json={"prompt": f"run {i}"})).status_code for i in range(3)]

    assert codes == [201, 201, 429]

"""Applying the PII fix at the writeback checkpoint patches the model, re-runs QA and unlocks approval."""
from __future__ import annotations

import pytest
from sqlalchemy import select, update

from app import orchestrator, worker
from app.database import session_scope
from app.datahub.mock_gateway import MockDataHubGateway
from app.demo.seed_data import mock_llm_fixtures
from app.llm.mock_provider import MockLLMProvider
from app.models import Artifact, Run
from tests.conftest import DEMO_WORKSPACE

STG = "models/staging/stg_stripe_payments.sql"


@pytest.fixture(autouse=True)
def instant_mocks(monkeypatch):
    monkeypatch.setattr(
        orchestrator, "_build_llm_provider",
        lambda: MockLLMProvider(fixtures=mock_llm_fixtures(), latency_seconds=0),
    )
    monkeypatch.setattr(orchestrator, "_build_datahub_gateway", lambda: MockDataHubGateway(latency_seconds=0))


async def _at_writeback(client) -> str:
    async with session_scope() as db:
        run = Run(prompt="customer revenue from stripe and postgres", status="pending", phase="context",
                  workspace_id=DEMO_WORKSPACE)
        db.add(run)
        await db.flush()
        run_id = run.id
    await worker.execute(await worker.claim("t"), "t")
    assert (await client.post(f"/api/runs/{run_id}/context/accept")).status_code == 202
    await worker.execute(await worker.claim("t"), "t")
    return run_id


async def _stg(run_id: str) -> str:
    async with session_scope() as db:
        return await db.scalar(select(Artifact.content).where(Artifact.run_id == run_id, Artifact.filename == STG))


async def test_applying_the_pii_fix_clears_the_block(client):
    run_id = await _at_writeback(client)
    report = (await client.get(f"/api/runs/{run_id}/validation")).json()
    assert report["blocking"] is True
    [fix] = report["fixes"]
    assert (fix["file"], fix["line"], fix["after"]) == (STG, 10, "    md5(card_last4) as card_last4_hash,")

    response = await client.post(f"/api/runs/{run_id}/fixes/{fix['id']}/apply")

    assert response.status_code == 200
    after = response.json()
    assert after["blocking"] is False
    assert [f["applied"] for f in after["fixes"]] == [True]
    assert "md5(card_last4) as card_last4_hash" in await _stg(run_id)
    qa = next(s for s in (await client.get(f"/api/runs/{run_id}")).json()["steps"] if s["agent"] == "qa")
    assert qa["logs"][-1].startswith("masked card_last4")
    assert (await client.post(f"/api/runs/{run_id}/writeback/approve")).status_code == 202


async def test_applying_twice_changes_nothing(client):
    run_id = await _at_writeback(client)
    fix_id = (await client.get(f"/api/runs/{run_id}/validation")).json()["fixes"][0]["id"]

    first = (await client.post(f"/api/runs/{run_id}/fixes/{fix_id}/apply")).json()
    content = await _stg(run_id)
    second = await client.post(f"/api/runs/{run_id}/fixes/{fix_id}/apply")

    assert second.status_code == 200
    assert second.json() == first
    assert await _stg(run_id) == content


async def test_fix_outside_the_checkpoint_is_rejected(client):
    run_id = await _at_writeback(client)
    fix_id = (await client.get(f"/api/runs/{run_id}/validation")).json()["fixes"][0]["id"]
    async with session_scope() as db:
        await db.execute(update(Run).where(Run.id == run_id).values(status="complete"))

    response = await client.post(f"/api/runs/{run_id}/fixes/{fix_id}/apply")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "checkpoint_conflict"


async def test_unknown_fix_is_404(client):
    run_id = await _at_writeback(client)

    response = await client.post(f"/api/runs/{run_id}/fixes/nope/apply")

    assert response.json()["error"]["code"] == "fix_not_found"


async def test_artifacts_come_back_one_entry_per_file(client):
    run_id = await _at_writeback(client)

    files = (await client.get(f"/api/runs/{run_id}/artifacts")).json()["files"]

    assert STG in [f["filename"] for f in files]
    stg = next(f for f in files if f["filename"] == STG)
    assert (stg["kind"], stg["source_agent"]) == ("dbt_model", "data_engineer")
    assert "card_last4" in stg["content"]

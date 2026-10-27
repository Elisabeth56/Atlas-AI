"""A failed run continues from the step that failed; earlier steps and their files are kept."""
from __future__ import annotations

import pytest
from sqlalchemy import func, select, update

from app import orchestrator, worker
from app.agents.qa_agent import QAAgent
from app.database import session_scope
from app.datahub.mock_gateway import MockDataHubGateway
from app.demo.seed_data import mock_llm_fixtures
from app.llm.mock_provider import MockLLMProvider
from app.models import Artifact, Run, RunStep
from tests.conftest import DEMO_WORKSPACE


@pytest.fixture(autouse=True)
def instant_mocks(monkeypatch):
    monkeypatch.setattr(
        orchestrator, "_build_llm_provider",
        lambda: MockLLMProvider(fixtures=mock_llm_fixtures(), latency_seconds=0),
    )
    monkeypatch.setattr(orchestrator, "_build_datahub_gateway", lambda: MockDataHubGateway(latency_seconds=0))


async def _drain() -> None:
    while job := await worker.claim("t"):
        await worker.execute(job, "t")


async def _failed_at_qa(monkeypatch) -> str:
    async with session_scope() as db:
        run = Run(prompt="customer revenue from stripe and postgres", status="pending", phase="context",
                  workspace_id=DEMO_WORKSPACE)
        db.add(run)
        await db.flush()
        run_id = run.id
    await _drain()
    async with session_scope() as db:
        await db.execute(update(Run).where(Run.id == run_id).values(
            status="running", context_mode="grounded", phase="generation"))

    async def outage(self, ctx):
        raise RuntimeError("every LLM provider failed")

    monkeypatch.setattr(QAAgent, "run", outage)
    await _drain()
    monkeypatch.undo()
    monkeypatch.setattr(orchestrator, "_build_llm_provider",
                        lambda: MockLLMProvider(fixtures=mock_llm_fixtures(), latency_seconds=0))
    monkeypatch.setattr(orchestrator, "_build_datahub_gateway", lambda: MockDataHubGateway(latency_seconds=0))
    return run_id


async def _engineer_files(run_id: str) -> list[str]:
    async with session_scope() as db:
        return list(await db.scalars(
            select(Artifact.id).where(Artifact.run_id == run_id, Artifact.source_agent == "data_engineer")
            .order_by(Artifact.id)))


async def test_retry_continues_from_the_failed_step(client, monkeypatch):
    run_id = await _failed_at_qa(monkeypatch)
    files_before = await _engineer_files(run_id)
    assert (await client.get(f"/api/runs/{run_id}")).json()["status"] == "failed"

    response = await client.post(f"/api/runs/{run_id}/steps/qa/retry")
    await _drain()

    assert response.status_code == 202
    body = (await client.get(f"/api/runs/{run_id}")).json()
    assert body["status"] == "awaiting_writeback_approval"
    qa = next(s for s in body["steps"] if s["agent"] == "qa")
    assert (qa["status"], qa["error"]) == ("success", None)
    assert await _engineer_files(run_id) == files_before  # the data engineer didn't run again


async def test_retrying_a_step_that_succeeded_is_rejected(client, monkeypatch):
    run_id = await _failed_at_qa(monkeypatch)

    response = await client.post(f"/api/runs/{run_id}/steps/data_engineer/retry")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "step_not_failed"


async def test_retrying_a_run_that_has_not_failed_is_rejected(client):
    async with session_scope() as db:
        run = Run(prompt="revenue", status="awaiting_context_approval", workspace_id=DEMO_WORKSPACE)
        db.add(run)
        await db.flush()
        db.add(RunStep(run_id=run.id, sequence=1, agent="metadata_analyst", status="failed"))
        run_id = run.id

    response = await client.post(f"/api/runs/{run_id}/steps/metadata_analyst/retry")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "run_not_failed"
    async with session_scope() as db:
        assert await db.scalar(select(func.count()).select_from(Run).where(Run.phase.is_not(None))) == 0

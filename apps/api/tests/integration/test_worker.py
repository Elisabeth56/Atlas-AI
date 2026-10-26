"""The worker: one claim per run, and a run whose worker died resumes where it stopped."""
from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import func, select, update

from app import orchestrator, worker
from app.agents.data_engineer import DataEngineerAgent
from app.agents.qa_agent import QAAgent
from app.database import session_scope
from app.datahub.mock_gateway import MockDataHubGateway
from app.demo.seed_data import mock_llm_fixtures
from app.llm.mock_provider import MockLLMProvider
from app.models import Artifact, Run
from tests.conftest import DEMO_WORKSPACE


@pytest.fixture(autouse=True)
def instant_mocks(monkeypatch):
    monkeypatch.setattr(
        orchestrator, "_build_llm_provider",
        lambda: MockLLMProvider(fixtures=mock_llm_fixtures(), latency_seconds=0),
    )
    monkeypatch.setattr(orchestrator, "_build_datahub_gateway", lambda: MockDataHubGateway(latency_seconds=0))


async def _queued(**values) -> str:
    async with session_scope() as db:
        run = Run(prompt="customer revenue from stripe and postgres", workspace_id=DEMO_WORKSPACE, **values)
        db.add(run)
        await db.flush()
        return run.id


async def _get(run_id: str) -> Run:
    async with session_scope() as db:
        return await db.get(Run, run_id)


async def test_two_workers_never_claim_the_same_run(db_ready):
    run_id = await _queued(status="pending", phase="context")

    jobs = await asyncio.gather(worker.claim("a"), worker.claim("b"))

    claimed = [j for j in jobs if j]
    assert [j.run_id for j in claimed] == [run_id]


async def test_worker_runs_the_queued_phase_and_releases_it(db_ready):
    run_id = await _queued(status="pending", phase="context")

    job = await worker.claim("a")
    await worker.execute(job, "a")

    run = await _get(run_id)
    assert (run.status, run.phase, run.locked_by) == ("awaiting_context_approval", None, None)
    assert await worker.claim("a") is None


async def test_crashed_run_resumes_from_the_last_finished_step(db_ready, monkeypatch):
    run_id = await _queued(status="pending", phase="context")
    await worker.execute(await worker.claim("a"), "a")
    async with session_scope() as db:
        await db.execute(update(Run).where(Run.id == run_id).values(
            status="running", context_mode="grounded", phase="generation", attempts=0))  # as accept_context does

    calls = {"data_engineer": 0}
    real_engineer = DataEngineerAgent.run

    async def counted(self, ctx):
        calls["data_engineer"] += 1
        return await real_engineer(self, ctx)

    async def killed(self, ctx):
        raise asyncio.CancelledError  # the process going away mid-QA, not an exception the worker handles

    monkeypatch.setattr(DataEngineerAgent, "run", counted)
    monkeypatch.setattr(QAAgent, "run", killed)

    job = await worker.claim("dead")
    with pytest.raises(asyncio.CancelledError):
        await orchestrator.PHASES[job.phase](job.run_id)
    assert await worker.claim("other") is None  # still leased to the dead worker

    async with session_scope() as db:  # the lease runs out
        await db.execute(update(Run).where(Run.id == run_id).values(locked_until=func.now()))
    monkeypatch.undo()
    monkeypatch.setattr(DataEngineerAgent, "run", counted)
    monkeypatch.setattr(orchestrator, "_build_llm_provider",
                        lambda: MockLLMProvider(fixtures=mock_llm_fixtures(), latency_seconds=0))
    monkeypatch.setattr(orchestrator, "_build_datahub_gateway", lambda: MockDataHubGateway(latency_seconds=0))

    job = await worker.claim("other")
    assert (job.run_id, job.phase, job.attempts) == (run_id, "generation", 2)
    await worker.execute(job, "other")

    run = await _get(run_id)
    assert (run.status, run.phase) == ("awaiting_writeback_approval", None)
    assert calls["data_engineer"] == 1
    async with session_scope() as db:
        engineer_files = await db.scalar(
            select(func.count()).select_from(Artifact)
            .where(Artifact.run_id == run_id, Artifact.source_agent == "data_engineer"))
    assert engineer_files == len(mock_llm_fixtures()["DataEngineerOutput"].files)


async def test_a_phase_that_keeps_crashing_fails_the_run(db_ready):
    run_id = await _queued(status="running", phase="generation", attempts=worker.MAX_ATTEMPTS)

    job = await worker.claim("a")
    await worker.execute(job, "a")

    run = await _get(run_id)
    assert (run.status, run.phase) == ("failed", None)

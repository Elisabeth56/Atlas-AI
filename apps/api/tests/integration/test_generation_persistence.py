"""The generation phase persists each stage's output with the stage itself, never half of it."""
from __future__ import annotations

import pytest
from sqlalchemy import func, select, update

from app import orchestrator
from app.agents.documentation_agent import DocumentationAgent
from app.database import session_scope
from app.datahub.mock_gateway import MockDataHubGateway
from app.demo.seed_data import mock_llm_fixtures
from app.llm.mock_provider import MockLLMProvider
from app.models import Artifact, Run, ValidationReport
from tests.conftest import DEMO_WORKSPACE


@pytest.fixture(autouse=True)
def instant_mocks(monkeypatch):
    monkeypatch.setattr(
        orchestrator, "_build_llm_provider",
        lambda: MockLLMProvider(fixtures=mock_llm_fixtures(), latency_seconds=0),
    )
    monkeypatch.setattr(
        orchestrator, "_build_datahub_gateway", lambda: MockDataHubGateway(latency_seconds=0)
    )


async def _run_to_generation(db_ready) -> str:
    async with session_scope() as db:
        request = Run(prompt="customer revenue from stripe and postgres", status="pending", workspace_id=DEMO_WORKSPACE)
        db.add(request)
        await db.flush()
        run_id = request.id
    await orchestrator.run_context_phase(run_id)
    await _claim_generation(run_id)
    return run_id


async def _claim_generation(run_id: str) -> None:
    async with session_scope() as db:
        await db.execute(
            update(Run)
            .where(Run.id == run_id)
            .values(status="running", context_mode="grounded")
        )


async def _counts(run_id: str) -> dict[str, int]:
    async with session_scope() as db:
        rows = await db.execute(
            select(Artifact.source_agent, func.count())
            .where(Artifact.run_id == run_id)
            .group_by(Artifact.source_agent)
        )
        return dict(rows.all())


async def test_generation_saves_artifacts_report_and_status(db_ready):
    run_id = await _run_to_generation(db_ready)

    await orchestrator.resume_generation_phase(run_id)

    counts = await _counts(run_id)
    async with session_scope() as db:
        request = await db.get(Run, run_id)
        report = await db.scalar(
            select(ValidationReport).where(ValidationReport.run_id == run_id)
        )
    assert request.status == "awaiting_writeback_approval"
    assert counts["data_engineer"] > 0 and counts["documentation"] > 0
    assert report is not None


async def test_rerunning_generation_replaces_instead_of_duplicating(db_ready):
    run_id = await _run_to_generation(db_ready)
    await orchestrator.resume_generation_phase(run_id)
    first = await _counts(run_id)

    await _claim_generation(run_id)
    await orchestrator.resume_generation_phase(run_id)

    assert await _counts(run_id) == first


async def test_documentation_failure_keeps_data_engineer_files(db_ready, monkeypatch):
    async def boom(self, ctx):
        raise RuntimeError("documentation provider down")

    monkeypatch.setattr(DocumentationAgent, "run", boom)
    run_id = await _run_to_generation(db_ready)

    await orchestrator.resume_generation_phase(run_id)

    counts = await _counts(run_id)
    async with session_scope() as db:
        request = await db.get(Run, run_id)
    assert request.status == "failed"
    assert counts.get("data_engineer", 0) > 0
    assert "documentation" not in counts

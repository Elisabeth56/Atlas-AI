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
from app.models import Artifact, Request, ValidationReport


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
        request = Request(prompt="customer revenue from stripe and postgres", status="pending")
        db.add(request)
        await db.flush()
        request_id = request.id
    await orchestrator.run_context_phase(request_id, "customer revenue from stripe and postgres")
    await _claim_generation(request_id)
    return request_id


async def _claim_generation(request_id: str) -> None:
    async with session_scope() as db:
        await db.execute(
            update(Request)
            .where(Request.id == request_id)
            .values(status="running", context_mode="grounded")
        )


async def _counts(request_id: str) -> dict[str, int]:
    async with session_scope() as db:
        rows = await db.execute(
            select(Artifact.source_agent, func.count())
            .where(Artifact.request_id == request_id)
            .group_by(Artifact.source_agent)
        )
        return dict(rows.all())


async def test_generation_saves_artifacts_report_and_status(db_ready):
    request_id = await _run_to_generation(db_ready)

    await orchestrator.resume_generation_phase(request_id)

    counts = await _counts(request_id)
    async with session_scope() as db:
        request = await db.get(Request, request_id)
        report = await db.scalar(
            select(ValidationReport).where(ValidationReport.request_id == request_id)
        )
    assert request.status == "awaiting_writeback_approval"
    assert counts["data_engineer"] > 0 and counts["documentation"] > 0
    assert report is not None


async def test_rerunning_generation_replaces_instead_of_duplicating(db_ready):
    request_id = await _run_to_generation(db_ready)
    await orchestrator.resume_generation_phase(request_id)
    first = await _counts(request_id)

    await _claim_generation(request_id)
    await orchestrator.resume_generation_phase(request_id)

    assert await _counts(request_id) == first


async def test_documentation_failure_keeps_data_engineer_files(db_ready, monkeypatch):
    async def boom(self, ctx):
        raise RuntimeError("documentation provider down")

    monkeypatch.setattr(DocumentationAgent, "run", boom)
    request_id = await _run_to_generation(db_ready)

    await orchestrator.resume_generation_phase(request_id)

    counts = await _counts(request_id)
    async with session_scope() as db:
        request = await db.get(Request, request_id)
    assert request.status == "failed"
    assert counts.get("data_engineer", 0) > 0
    assert "documentation" not in counts

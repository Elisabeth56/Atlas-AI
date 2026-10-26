"""Checkpoint endpoints move a run forward exactly once, even under concurrent clicks."""
from __future__ import annotations

import asyncio

import pytest

from app.database import session_scope
from app.models import Request, ValidationReport
from app.routers import requests as requests_router


@pytest.fixture
def scheduled(monkeypatch):
    """Replaces the phase runners with recorders so tests only exercise the endpoints."""
    calls: list[tuple[str, str]] = []

    async def fake_generation(request_id: str) -> None:
        calls.append(("generation", request_id))

    async def fake_writeback(request_id: str) -> None:
        calls.append(("writeback", request_id))

    monkeypatch.setattr(requests_router, "resume_generation_phase", fake_generation)
    monkeypatch.setattr(requests_router, "resume_writeback_phase", fake_writeback)
    return calls


async def _seed(status: str) -> str:
    async with session_scope() as db:
        request = Request(prompt="customer revenue", status=status)
        db.add(request)
        await db.flush()
        return request.id


async def test_concurrent_accepts_run_generation_once(client, scheduled):
    request_id = await _seed("awaiting_context_approval")

    responses = await asyncio.gather(
        client.post(f"/api/requests/{request_id}/context/accept"),
        client.post(f"/api/requests/{request_id}/context/accept"),
    )

    assert sorted(r.status_code for r in responses) == [202, 409]
    assert scheduled == [("generation", request_id)]


async def test_accept_records_mode_and_claims_run(client, scheduled):
    request_id = await _seed("awaiting_context_approval")

    response = await client.post(f"/api/requests/{request_id}/context/start-fresh")

    assert response.status_code == 202
    async with session_scope() as db:
        request = await db.get(Request, request_id)
        assert (request.status, request.context_mode) == ("running", "fresh")


async def test_skip_writeback_from_wrong_state_is_rejected(client, scheduled):
    request_id = await _seed("awaiting_context_approval")

    response = await client.post(f"/api/requests/{request_id}/writeback/skip")

    assert response.status_code == 409
    assert scheduled == []


async def test_unknown_run_is_404(client, scheduled):
    response = await client.post(
        "/api/requests/00000000-0000-0000-0000-000000000000/context/accept"
    )

    assert response.status_code == 404


async def _seed_report(request_id: str, *, blocking: bool) -> None:
    async with session_scope() as db:
        db.add(
            ValidationReport(
                request_id=request_id,
                checks=[
                    {
                        "name": "PII exposure",
                        "passed": not blocking,
                        "message": "card_last4 is not masked",
                        "severity": "critical",
                    }
                ],
                passed=not blocking,
                blocking=blocking,
            )
        )


async def test_critical_qa_finding_blocks_writeback_approval(client, scheduled):
    request_id = await _seed("awaiting_writeback_approval")
    await _seed_report(request_id, blocking=True)

    response = await client.post(f"/api/requests/{request_id}/writeback/approve")

    assert response.status_code == 409
    assert "critical" in response.json()["detail"]
    assert scheduled == []


async def test_critical_qa_finding_still_allows_skip(client, scheduled):
    request_id = await _seed("awaiting_writeback_approval")
    await _seed_report(request_id, blocking=True)

    response = await client.post(f"/api/requests/{request_id}/writeback/skip")

    assert response.status_code == 202
    assert scheduled == [("writeback", request_id)]


async def test_clean_qa_allows_approval_and_exposes_flag(client, scheduled):
    request_id = await _seed("awaiting_writeback_approval")
    await _seed_report(request_id, blocking=False)

    report = await client.get(f"/api/requests/{request_id}/validation")
    response = await client.post(f"/api/requests/{request_id}/writeback/approve")

    assert report.json()["blocking"] is False
    assert response.status_code == 202

"""LLM calls made during a step are stored, summed on the run, and fallbacks show in the step's log."""
from __future__ import annotations

import json

import httpx

from app import orchestrator
from app.database import session_scope
from app.llm.chain import ProviderChain, ProviderConfig
from app.models import Run, RunStep
from app.schemas import PlannerOutput
from tests.conftest import DEMO_WORKSPACE

PLAN = json.dumps({"goal": "build revenue", "entities": ["revenue"], "summary": "planned"})


def _answers(*responses: httpx.Response) -> httpx.MockTransport:
    queue = list(responses)
    return httpx.MockTransport(lambda _request: queue.pop(0))


async def test_fallback_is_stored_summed_and_logged(client):
    async with session_scope() as db:
        run = Run(prompt="revenue", status="running", workspace_id=DEMO_WORKSPACE)
        db.add(run)
        await db.flush()
        db.add(RunStep(run_id=run.id, sequence=0, agent="planner", status="started"))
        run_id = run.id

    ok = httpx.Response(200, json={
        "choices": [{"message": {"content": PLAN}}], "usage": {"prompt_tokens": 120, "completion_tokens": 30},
    })
    chain = ProviderChain(
        [ProviderConfig("groq", "https://groq.test", "k", "llama"),
         ProviderConfig("gemini", "https://gemini.test", "k", "flash-lite")],
        transport=_answers(httpx.Response(503), ok),
        on_call=orchestrator.record_llm_call,
    )
    token = orchestrator.current_step.set((run_id, "planner"))
    try:
        await chain.complete(prompt_id="planner", user_prompt="revenue", schema=PlannerOutput)
    finally:
        orchestrator.current_step.reset(token)

    step = (await client.get(f"/api/runs/{run_id}")).json()["steps"][0]
    assert step["usage"] == {"calls": 2, "tokens_in": 120, "tokens_out": 30,
                             "latency_ms": step["usage"]["latency_ms"], "failed_calls": 1}
    assert step["logs"] == ["groq http 503", "answered by gemini (flash-lite)"]

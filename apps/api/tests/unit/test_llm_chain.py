"""ProviderChain falls back on outages, waits out short rate limits and repairs invalid JSON once."""
from __future__ import annotations

import json

import httpx
import pytest

from app.llm.chain import ProviderChain, ProviderConfig
from app.llm.provider import LLMError
from app.schemas import PlannerOutput

GROQ = ProviderConfig("groq", "https://groq.test", "k1", "llama")
GEMINI = ProviderConfig("gemini", "https://gemini.test", "k2", "flash-lite")

VALID = json.dumps({"goal": "build revenue", "entities": ["revenue"], "summary": "planned"})


def _completion(content: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "choices": [{"message": {"content": content}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 20},
        },
    )


class Script:
    """A fake transport that answers each request with the next scripted response."""

    def __init__(self, *responses: httpx.Response) -> None:
        self.responses = list(responses)
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self.responses.pop(0)

    @property
    def hosts(self) -> list[str]:
        return [r.url.host for r in self.requests]


def _chain(script: Script, sleeps: list[float] | None = None) -> ProviderChain:
    async def fake_sleep(seconds: float) -> None:
        if sleeps is not None:
            sleeps.append(seconds)

    return ProviderChain(
        [GROQ, GEMINI], transport=httpx.MockTransport(script), sleep=fake_sleep
    )


async def _plan(chain: ProviderChain) -> PlannerOutput:
    return await chain.complete(prompt_id="planner", user_prompt="revenue", schema=PlannerOutput)


async def test_rate_limit_without_retry_after_falls_back_to_next_provider():
    script = Script(httpx.Response(429), _completion(VALID))

    result = await _plan(_chain(script))

    assert result.goal == "build revenue"
    assert script.hosts == ["groq.test", "gemini.test"]


async def test_short_retry_after_waits_and_retries_same_provider():
    sleeps: list[float] = []
    script = Script(httpx.Response(429, headers={"retry-after": "2"}), _completion(VALID))

    await _plan(_chain(script, sleeps))

    assert sleeps == [2.0]
    assert script.hosts == ["groq.test", "groq.test"]


async def test_server_error_falls_back():
    script = Script(httpx.Response(503), _completion(VALID))

    await _plan(_chain(script))

    assert script.hosts == ["groq.test", "gemini.test"]


async def test_invalid_json_is_repaired_with_the_validation_error():
    script = Script(_completion('{"goal": "x"}'), _completion(VALID))

    result = await _plan(_chain(script))

    repair_messages = json.loads(script.requests[1].content)["messages"]
    assert result.entities == ["revenue"]
    assert "failed validation" in repair_messages[-1]["content"]
    assert "entities" in repair_messages[-1]["content"]


async def test_invalid_twice_fails_the_step():
    script = Script(_completion("not json"), _completion("still not json"))

    with pytest.raises(LLMError, match="after a repair attempt"):
        await _plan(_chain(script))


async def test_every_provider_down_raises():
    script = Script(httpx.Response(429), httpx.Response(500))

    with pytest.raises(LLMError, match="every LLM provider failed"):
        await _plan(_chain(script))


async def test_system_prompt_comes_from_the_prompt_file():
    script = Script(_completion(VALID))

    await _plan(_chain(script))

    system = json.loads(script.requests[0].content)["messages"][0]["content"]
    assert system.startswith("You are the Planner agent")
    assert "JSON schema" in system


async def test_every_call_is_reported_with_fallback_marked():
    records = []

    async def collect(record):
        records.append(record)

    script = Script(httpx.Response(429), _completion(VALID))
    chain = ProviderChain([GROQ, GEMINI], transport=httpx.MockTransport(script), on_call=collect)

    await _plan(chain)

    assert [(r.provider, r.outcome, r.fallback) for r in records] == [
        ("groq", "rate_limited", False),
        ("gemini", "ok", True),
    ]
    assert (records[1].tokens_in, records[1].tokens_out) == (100, 20)


async def test_groq_json_mode_rejection_goes_to_the_repair_step():
    rejected = httpx.Response(400, json={"error": {
        "code": "json_validate_failed", "message": "Failed to generate JSON", "failed_generation": '{"goal": '}})
    script = Script(rejected, _completion(VALID))

    plan = await _plan(_chain(script))

    assert plan.goal == "build revenue"
    assert script.hosts == ["groq.test", "groq.test"]  # repaired on the same provider, no fallback
    assert json.loads(script.requests[1].content)["messages"][-2]["content"] == '{"goal": '


async def test_other_400s_still_fall_back():
    script = Script(httpx.Response(400, json={"error": {"code": "model_not_found"}}), _completion(VALID))

    await _plan(_chain(script))

    assert script.hosts == ["groq.test", "gemini.test"]

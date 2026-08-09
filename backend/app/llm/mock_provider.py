"""
Mock LLM provider — returns pre-built fixture responses keyed by output
schema, with a small artificial delay so the demo still *feels* like an
LLM is thinking. This is what makes the full six-agent pipeline runnable
with zero external dependencies (no Groq key required).
"""
from __future__ import annotations

import asyncio

from pydantic import BaseModel

from app.llm.provider import LLMError, LLMProvider, T


class MockLLMProvider(LLMProvider):
    def __init__(
        self,
        fixtures: dict[str, BaseModel],
        *,
        latency_seconds: float = 0.35,
    ) -> None:
        """
        `fixtures` maps a Pydantic schema's class name (e.g.
        "PlannerOutput") to a pre-built instance of that schema. The demo
        seed data module (app/demo/seed_data.py) owns the actual content.
        """
        self._fixtures = fixtures
        self._latency = latency_seconds

    async def complete(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: type[T],
    ) -> T:
        await asyncio.sleep(self._latency)
        fixture = self._fixtures.get(schema.__name__)
        if fixture is None:
            raise LLMError(
                f"MockLLMProvider has no fixture registered for {schema.__name__}"
            )
        # Return a fresh validated copy so agents can't mutate the shared fixture.
        return schema.model_validate(fixture.model_dump())

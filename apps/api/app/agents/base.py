"""
Agent framework base — every pipeline stage implements `Agent`. Business
logic here is framework-independent: an `Agent` only knows about
`RunContext` (its inputs + a logging callback), `LLMProvider`, and
`DataHubGateway` — never about FastAPI, SQLAlchemy sessions in the ORM
sense, or how progress reaches the browser. That's what makes each agent
independently unit-testable with fakes for all three.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from app.datahub.gateway import DataHubGateway
from app.llm.provider import LLMProvider

EmitLog = Callable[[str], Awaitable[None]]


@dataclass
class RunContext:
    """
    Carries everything an agent needs for one pipeline execution.

    `results` accumulates each prior agent's output dict, keyed by agent
    name, so later agents can read earlier agents' structured output
    (e.g. the Data Engineer reads `results["metadata_analyst"]` for
    matched datasets) without a rigid positional argument chain.
    """

    run_id: str
    prompt: str
    llm: LLMProvider
    datahub: DataHubGateway
    emit_log: EmitLog
    results: dict[str, dict[str, Any]] = field(default_factory=dict)
    current_agent: str = ""

    def prior(self, agent: str) -> dict[str, Any]:
        """Fetch a prior agent's output dict, or raise a clear error if
        the pipeline was reordered/misconfigured."""
        if agent not in self.results:
            raise KeyError(
                f"RunContext has no result for '{agent}' — check pipeline order"
            )
        return self.results[agent]


@dataclass
class AgentResult:
    """Every agent returns one of these. `data` is the agent's schema-typed
    output, serialized to a dict for storage in RunStep.output and
    for downstream agents to read via RunContext.results."""

    summary: str
    data: dict[str, Any]


class Agent(ABC):
    """One pipeline stage. `name` must match a value in schemas.AgentId: it's the
    run_steps row's `agent`."""

    name: str

    @abstractmethod
    async def run(self, ctx: RunContext) -> AgentResult:
        raise NotImplementedError

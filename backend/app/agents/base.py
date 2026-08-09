"""
Agent framework base — every pipeline stage implements `Agent`. Business
logic here is framework-independent: an `Agent` only knows about
`RunContext` (its inputs + a logging callback), `LLMProvider`, and
`DataHubGateway` — never about FastAPI, SQLAlchemy sessions in the ORM
sense, or the WebSocket hub directly. That's what makes each agent
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

    request_id: str
    prompt: str
    llm: LLMProvider
    datahub: DataHubGateway
    emit_log: EmitLog
    results: dict[str, dict[str, Any]] = field(default_factory=dict)

    def prior(self, agent_name: str) -> dict[str, Any]:
        """Fetch a prior agent's output dict, or raise a clear error if
        the pipeline was reordered/misconfigured."""
        if agent_name not in self.results:
            raise KeyError(
                f"RunContext has no result for '{agent_name}' — check pipeline order"
            )
        return self.results[agent_name]


@dataclass
class AgentResult:
    """Every agent returns one of these. `data` is the agent's schema-typed
    output, serialized to a dict for storage in AgentRun.output_json and
    for downstream agents to read via RunContext.results."""

    summary: str
    data: dict[str, Any]


class Agent(ABC):
    """
    name: must exactly match a value in schemas.AgentId — it's used as
          the WebSocket event's `agent` field and the DB row's
          `agent_name`, so the frontend can map it straight to a pipeline
          stage.
    critical: if True, a failure here aborts the remaining pipeline
              (the request is marked "failed"). If False, the pipeline
              continues so later agents can still run against partial
              output — no current agent sets this to False, but the hook
              exists for future non-critical stages (e.g. an optional
              cost-estimation agent).
    """

    name: str
    critical: bool = True

    @abstractmethod
    async def run(self, ctx: RunContext) -> AgentResult:
        raise NotImplementedError

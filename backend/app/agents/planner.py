"""Planner agent — turns a free-text prompt into a structured engineering
goal plus a list of candidate entities for the Metadata Analyst to search
DataHub against."""
from __future__ import annotations

from app.agents.base import Agent, AgentResult, RunContext
from app.schemas import PlannerOutput

_SYSTEM_PROMPT = """You are the Planner agent in Atlas AI, a data engineering \
platform. Given a natural-language request, produce:
- goal: one sentence describing the concrete engineering objective
- entities: a short list of business entities/nouns (e.g. "revenue", \
"customer") that a metadata search should look for
- summary: a short, present-tense status line (max ~12 words) describing \
what you just did, for a live activity log
"""


class PlannerAgent(Agent):
    name = "planner"
    critical = True

    async def run(self, ctx: RunContext) -> AgentResult:
        await ctx.emit_log("parsing prompt into engineering goal")

        output = await ctx.llm.complete(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=ctx.prompt,
            schema=PlannerOutput,
        )

        await ctx.emit_log(
            f"identified target entities: {', '.join(output.entities)}"
        )

        return AgentResult(summary=output.summary, data=output.model_dump())

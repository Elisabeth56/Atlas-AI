"""Planner agent — turns a free-text prompt into a structured engineering
goal plus a list of candidate entities for the Metadata Analyst to search
DataHub against."""
from __future__ import annotations

from app.agents.base import Agent, AgentResult, RunContext
from app.schemas import PlannerOutput


class PlannerAgent(Agent):
    name = "planner"

    async def run(self, ctx: RunContext) -> AgentResult:
        await ctx.emit_log("parsing prompt into engineering goal")

        output = await ctx.llm.complete(
            prompt_id="planner",
            user_prompt=f"<request>\n{ctx.prompt}\n</request>",
            schema=PlannerOutput,
        )

        await ctx.emit_log(
            f"identified target entities: {', '.join(output.entities)}"
        )

        return AgentResult(summary=output.summary, data=output.model_dump())

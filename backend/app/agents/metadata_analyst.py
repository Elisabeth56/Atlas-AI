"""Metadata Analyst agent — searches DataHub for datasets matching the
Planner's target entities, pulls their schema, and explains why each was
selected. This is the agent that makes Atlas AI "metadata-grounded"
rather than hallucinating table/column names."""
from __future__ import annotations

import json

from app.agents.base import Agent, AgentResult, RunContext
from app.schemas import MetadataAnalystOutput


class MetadataAnalystAgent(Agent):
    name = "metadata_analyst"

    async def run(self, ctx: RunContext) -> AgentResult:
        planner_output = ctx.prior("planner")
        entities: list[str] = planner_output["entities"]
        goal: str = planner_output["goal"]

        await ctx.emit_log("searching DataHub for candidate datasets")

        # Ground the LLM call in real DataHub search results — one search
        # per entity, deduplicated by URN — rather than letting it guess.
        candidates: dict[str, dict] = {}
        for entity in entities:
            for ds in await ctx.datahub.search_datasets(entity, limit=5):
                if ds.get("urn"):
                    candidates[ds["urn"]] = ds

        for urn in list(candidates.keys()):
            schema = await ctx.datahub.get_schema(urn)
            candidates[urn]["schema"] = schema.get("fields", [])

        await ctx.emit_log(
            f"retrieved {len(candidates)} candidate datasets from DataHub"
        )

        user_prompt = (
            f"Goal: {goal}\n"
            f"Target entities: {json.dumps(entities)}\n"
            f"<datahub_metadata>\n{json.dumps(list(candidates.values()))}\n</datahub_metadata>"
        )

        output = await ctx.llm.complete(
            prompt_id="metadata_analyst",
            user_prompt=user_prompt,
            schema=MetadataAnalystOutput,
        )

        top = output.matched_datasets[:3]
        if top:
            names = ", ".join(d.name for d in top)
            confidences = "-".join(f"{d.confidence:.2f}" for d in top)
            await ctx.emit_log(f"matched {names} · confidence {confidences}")
        await ctx.emit_log("pulled schema, lineage, owners, contracts")

        return AgentResult(summary=output.summary, data=output.model_dump())

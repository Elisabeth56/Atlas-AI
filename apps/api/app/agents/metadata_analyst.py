"""Metadata Analyst agent — searches DataHub for datasets matching the
Planner's target entities, pulls their schema, and explains why each was
selected. This is the agent that makes Atlas AI "metadata-grounded"
rather than hallucinating table/column names."""
from __future__ import annotations

import asyncio
import json

from app.agents.base import Agent, AgentResult, RunContext
from app.datahub.gateway import is_pii
from app.schemas import MetadataAnalystOutput

# enough to overlap network waits without flooding the MCP server
MAX_CONCURRENT_LOOKUPS = 5


async def find_candidates(ctx: RunContext, entities: list[str]) -> dict[str, dict]:
    """Searches DataHub for every entity, then fetches each unique match's schema.

    Both rounds run concurrently. Results are merged in entity order, so the
    same search results always produce the same candidate list.
    """
    limit = asyncio.Semaphore(MAX_CONCURRENT_LOOKUPS)

    async def bounded(call):
        async with limit:
            return await call

    searches = await asyncio.gather(
        *(bounded(ctx.datahub.search_datasets(e, limit=5)) for e in entities)
    )
    candidates: dict[str, dict] = {}
    for results in searches:
        for ds in results:
            if ds.get("urn"):
                candidates.setdefault(ds["urn"], ds)

    schemas = await asyncio.gather(
        *(bounded(ctx.datahub.get_schema(urn)) for urn in candidates)
    )
    for ds, schema in zip(candidates.values(), schemas, strict=True):
        ds["schema"] = schema.get("fields", [])
    return candidates


class MetadataAnalystAgent(Agent):
    name = "metadata_analyst"

    async def run(self, ctx: RunContext) -> AgentResult:
        planner_output = ctx.prior("planner")
        entities: list[str] = planner_output["entities"]
        goal: str = planner_output["goal"]

        await ctx.emit_log("searching DataHub for candidate datasets")

        candidates = await find_candidates(ctx, entities)

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

        # the model picks and ranks datasets; the columns and PII flags people see come from DataHub itself
        for ds in output.matched_datasets:
            fields = [f for f in candidates.get(ds.urn, {}).get("schema", []) if f.get("name")]
            if fields:
                ds.columns = [f["name"] for f in fields]
                ds.pii_columns = [f["name"] for f in fields if is_pii(f)]

        top = output.matched_datasets[:3]
        if top:
            names = ", ".join(d.name for d in top)
            confidences = "-".join(f"{d.confidence:.2f}" for d in top)
            await ctx.emit_log(f"matched {names} · confidence {confidences}")
        await ctx.emit_log("pulled schema, lineage, owners, contracts")

        return AgentResult(summary=output.summary, data=output.model_dump())

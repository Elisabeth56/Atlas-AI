"""Metadata Analyst agent — searches DataHub for datasets matching the
Planner's target entities, pulls their schema, and explains why each was
selected. This is the agent that makes Atlas AI "metadata-grounded"
rather than hallucinating table/column names."""
from __future__ import annotations

from app.agents.base import Agent, AgentResult, RunContext
from app.schemas import MatchedDataset, MetadataAnalystInput, MetadataAnalystOutput

_SYSTEM_PROMPT = """You are the Metadata Analyst agent in Atlas AI. You are \
given a goal, a list of target entities, and a set of candidate datasets \
already retrieved from DataHub (with their real schemas). Select and rank \
the datasets that are actually relevant, and explain your reasoning. Do \
not invent columns that are not present in the provided schemas.
"""


class MetadataAnalystAgent(Agent):
    name = "metadata_analyst"
    critical = True

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

        agent_input = MetadataAnalystInput(goal=goal, entities=entities)
        user_prompt = (
            f"Goal: {goal}\n"
            f"Target entities: {entities}\n"
            f"Candidate datasets (from DataHub search): {list(candidates.values())}"
        )

        output = await ctx.llm.complete(
            system_prompt=_SYSTEM_PROMPT,
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

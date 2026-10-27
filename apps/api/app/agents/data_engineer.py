"""Data Engineer agent — generates dbt models, ad-hoc SQL, tests, and
config from the Planner's goal and the Metadata Analyst's matched
datasets. This is the agent whose output becomes the bulk of the
Artifacts view."""
from __future__ import annotations

import json

from app.agents.base import Agent, AgentResult, RunContext
from app.schemas import DataEngineerOutput, MatchedDataset


class DataEngineerAgent(Agent):
    name = "data_engineer"

    async def run(self, ctx: RunContext) -> AgentResult:
        planner_output = ctx.prior("planner")
        metadata_output = ctx.prior("metadata_analyst")
        matched_datasets = [
            MatchedDataset.model_validate(d)
            for d in metadata_output["matched_datasets"]
        ]

        await ctx.emit_log("drafting dbt model against retrieved schema")
        await ctx.emit_log("applying data contract constraints")

        datasets = json.dumps([d.model_dump() for d in matched_datasets])
        user_prompt = (
            f"Goal: {planner_output['goal']}\n"
            f"<datahub_metadata>\n{datasets}\n</datahub_metadata>"
        )

        output = await ctx.llm.complete(
            prompt_id="data_engineer",
            user_prompt=user_prompt,
            schema=DataEngineerOutput,
        )

        model_count = sum(1 for f in output.files if f.kind == "dbt_model")
        test_count = sum(1 for f in output.files if f.kind == "test")
        await ctx.emit_log(f"generated {model_count} models, {test_count} tests")

        return AgentResult(summary=output.summary, data=output.model_dump())

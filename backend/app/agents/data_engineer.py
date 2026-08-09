"""Data Engineer agent — generates dbt models, ad-hoc SQL, tests, and
config from the Planner's goal and the Metadata Analyst's matched
datasets. This is the agent whose output becomes the bulk of the
Artifacts view."""
from __future__ import annotations

from app.agents.base import Agent, AgentResult, RunContext
from app.schemas import DataEngineerOutput, MatchedDataset

_SYSTEM_PROMPT = """You are the Data Engineer agent in Atlas AI. You are \
given an engineering goal and a set of DataHub-grounded datasets (with \
real column names). Generate production-quality dbt models (staging \
models per source, one or more mart models joining them), an ad-hoc SQL \
analysis query, a dbt schema.yml test file, and a dbt_project.yml config \
excerpt. Only reference columns that actually exist in the provided \
dataset schemas. Return each file as an entry in `files` with the correct \
`kind` (dbt_model | sql | test | config), a realistic `filename`, and \
complete `content`.
"""


class DataEngineerAgent(Agent):
    name = "data_engineer"
    critical = True

    async def run(self, ctx: RunContext) -> AgentResult:
        planner_output = ctx.prior("planner")
        metadata_output = ctx.prior("metadata_analyst")
        matched_datasets = [
            MatchedDataset.model_validate(d)
            for d in metadata_output["matched_datasets"]
        ]

        await ctx.emit_log("drafting dbt model against retrieved schema")
        await ctx.emit_log("applying data contract constraints")

        user_prompt = (
            f"Goal: {planner_output['goal']}\n"
            f"Matched datasets: {[d.model_dump() for d in matched_datasets]}"
        )

        output = await ctx.llm.complete(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            schema=DataEngineerOutput,
        )

        model_count = sum(1 for f in output.files if f.kind == "dbt_model")
        test_count = sum(1 for f in output.files if f.kind == "test")
        await ctx.emit_log(f"generated {model_count} models, {test_count} tests")

        return AgentResult(summary=output.summary, data=output.model_dump())

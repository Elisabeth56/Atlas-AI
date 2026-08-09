"""Documentation agent — generates a data dictionary and README from the
generated models plus DataHub context (descriptions, ownership)."""
from __future__ import annotations

from app.agents.base import Agent, AgentResult, RunContext
from app.schemas import DocumentationOutput, GeneratedFile, MatchedDataset

_SYSTEM_PROMPT = """You are the Documentation agent in Atlas AI. Given the \
generated dbt models/files and the DataHub-grounded source datasets \
(with real owners and descriptions), write two `doc`-kind files: a data \
dictionary markdown file per mart model (column name, description, \
grain, source lineage, owner) and a top-level README summarizing the \
pipeline and any known issues. Base descriptions on the provided source \
metadata — do not invent ownership or column meaning.
"""


class DocumentationAgent(Agent):
    name = "documentation"
    critical = True

    async def run(self, ctx: RunContext) -> AgentResult:
        metadata_output = ctx.prior("metadata_analyst")
        data_engineer_output = ctx.prior("data_engineer")
        qa_output = ctx.prior("qa")

        matched_datasets = [
            MatchedDataset.model_validate(d)
            for d in metadata_output["matched_datasets"]
        ]
        files = [
            GeneratedFile.model_validate(f) for f in data_engineer_output["files"]
        ]

        await ctx.emit_log("generating data dictionary")

        user_prompt = (
            f"Generated files: {[f.model_dump() for f in files]}\n"
            f"Source datasets: {[d.model_dump() for d in matched_datasets]}\n"
            f"QA findings: {qa_output.get('checks', [])}"
        )

        output = await ctx.llm.complete(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            schema=DocumentationOutput,
        )

        await ctx.emit_log("writing README from DataHub context")

        return AgentResult(summary=output.summary, data=output.model_dump())

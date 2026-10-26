"""Documentation agent — generates a data dictionary and README from the
generated models plus DataHub context (descriptions, ownership)."""
from __future__ import annotations

import json

from app.agents.base import Agent, AgentResult, RunContext
from app.schemas import DocumentationOutput, GeneratedFile, MatchedDataset


class DocumentationAgent(Agent):
    name = "documentation"

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
            f"Generated files: {json.dumps([f.model_dump() for f in files])}\n"
            f"QA findings: {json.dumps(qa_output.get('checks', []))}\n"
            "<datahub_metadata>\n"
            f"{json.dumps([d.model_dump() for d in matched_datasets])}\n"
            "</datahub_metadata>"
        )

        output = await ctx.llm.complete(
            prompt_id="documentation",
            user_prompt=user_prompt,
            schema=DocumentationOutput,
        )

        await ctx.emit_log("writing README from DataHub context")

        return AgentResult(summary=output.summary, data=output.model_dump())

"""Writeback agent: records what Atlas built in DataHub. Deterministic, no LLM call.

The generated docs describe the mart, so they go on the mart's entity. Source
datasets only gain a lineage edge pointing at the mart; their descriptions are never touched.
"""
from __future__ import annotations

from pathlib import PurePosixPath

from app.agents.base import Agent, AgentResult, RunContext
from app.schemas import GeneratedFile, MatchedDataset, WritebackOutput

# dbt models live under DataHub's dbt platform, keyed by model name
MART_URN = "urn:li:dataset:(urn:li:dataPlatform:dbt,{name},PROD)"


def mart_names(files: list[GeneratedFile]) -> list[str]:
    """Model names of the generated marts (dbt models under a marts/ folder)."""
    return [
        PurePosixPath(f.filename).stem
        for f in files
        if f.kind == "dbt_model" and "marts" in PurePosixPath(f.filename).parts
    ]


def doc_for(mart: str, docs: list[GeneratedFile]) -> str:
    """The doc file written for this mart, falling back to all docs joined."""
    for f in docs:
        if PurePosixPath(f.filename).stem == mart:
            return f.content
    return "\n\n".join(f.content for f in docs)


class WritebackAgent(Agent):
    name = "writeback"

    async def run(self, ctx: RunContext) -> AgentResult:
        sources = [
            MatchedDataset.model_validate(d)
            for d in ctx.prior("metadata_analyst")["matched_datasets"]
        ]
        files = [GeneratedFile.model_validate(f) for f in ctx.prior("data_engineer")["files"]]
        docs = [
            GeneratedFile.model_validate(f)
            for f in ctx.prior("documentation")["files"]
            if f["kind"] == "doc"
        ]

        await ctx.emit_log("upserting mart documentation to DataHub")
        urns_updated: list[str] = []
        edges_added = 0
        for mart in mart_names(files):
            mart_urn = MART_URN.format(name=mart)
            await ctx.datahub.upsert_metadata(
                mart_urn, "institutionalMemory", {"description": doc_for(mart, docs)[:4000]}
            )
            urns_updated.append(mart_urn)

            await ctx.emit_log(f"emitting lineage into {mart}")
            for source in sources:
                await ctx.datahub.emit_lineage(source.urn, mart_urn)
                edges_added += 1

        output = WritebackOutput(
            urns_updated=urns_updated,
            lineage_edges_added=edges_added,
            summary=(
                f"run complete · {len(urns_updated)} marts documented, "
                f"{edges_added} lineage edges added"
            ),
        )
        await ctx.emit_log("run complete · artifacts ready")
        return AgentResult(summary=output.summary, data=output.model_dump())

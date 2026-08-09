"""Write-back agent — the final pipeline stage. Pushes generated
documentation and lineage edges back to DataHub, closing the loop so the
knowledge graph reflects what Atlas AI just built. This agent does not
call the LLM — it's a deterministic write step driven entirely by prior
agents' structured output."""
from __future__ import annotations

from app.agents.base import Agent, AgentResult, RunContext
from app.schemas import GeneratedFile, MatchedDataset, WritebackOutput


class WritebackAgent(Agent):
    name = "writeback"
    critical = True

    async def run(self, ctx: RunContext) -> AgentResult:
        metadata_output = ctx.prior("metadata_analyst")
        documentation_output = ctx.prior("documentation")

        matched_datasets = [
            MatchedDataset.model_validate(d)
            for d in metadata_output["matched_datasets"]
        ]
        doc_files = [
            GeneratedFile.model_validate(f) for f in documentation_output["files"]
        ]

        await ctx.emit_log("upserting metadata to DataHub")

        urns_updated: list[str] = []
        combined_docs = "\n\n".join(f.content for f in doc_files if f.kind == "doc")
        for ds in matched_datasets:
            await ctx.datahub.upsert_metadata(
                ds.urn,
                "institutionalMemory",
                {"description": combined_docs[:4000]},
            )
            urns_updated.append(ds.urn)

        await ctx.emit_log("emitting lineage edges")

        edges_added = 0
        # Chain the matched datasets into a simple upstream->downstream
        # walk (source datasets feed the mart the Data Engineer built).
        for upstream, downstream in zip(matched_datasets, matched_datasets[1:]):
            await ctx.datahub.emit_lineage(upstream.urn, downstream.urn)
            edges_added += 1

        output = WritebackOutput(
            urns_updated=urns_updated,
            lineage_edges_added=edges_added,
            summary=f"run complete · {len(urns_updated)} URNs updated, {edges_added} lineage edges added",
        )

        await ctx.emit_log("run complete · artifacts ready")

        return AgentResult(summary=output.summary, data=output.model_dump())

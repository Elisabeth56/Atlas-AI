import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const agents = [
  {
    name: "Planner",
    role: "Turns the request into a goal",
    body: "Reads your sentence and names the business entities a catalog search should look for.",
    kind: "LLM",
  },
  {
    name: "Metadata Analyst",
    role: "Finds the source datasets",
    body: "Searches DataHub for each entity, pulls the schemas and ranks the matches. You review them before any code is written.",
    kind: "DataHub + LLM",
  },
  {
    name: "Data Engineer",
    role: "Writes the models",
    body: "Generates staging and mart models, an analysis query, a schema.yml with tests and a dbt_project.yml excerpt.",
    kind: "LLM",
  },
  {
    name: "QA",
    role: "Checks the output",
    body: "Plain code, no model: SQL parsing, columns against the DataHub schema, key-column tests and PII masking.",
    kind: "Deterministic",
  },
  {
    name: "Documentation",
    role: "Writes the docs",
    body: "A data dictionary per mart and a README, built from DataHub descriptions and owners, with QA findings included.",
    kind: "LLM",
  },
  {
    name: "Writeback",
    role: "Updates the catalog",
    body: "After you approve, adds the generated docs and lineage to DataHub. Skip it and the artifacts are still yours.",
    kind: "Deterministic",
  },
];

export function AgentFleet() {
  return (
    <section id="platform" className="mx-auto max-w-[1280px] px-6 py-24 lg:px-10">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>The pipeline</Eyebrow>
          <h2 className="mt-6 max-w-xl text-[36px] font-bold leading-[1.15] tracking-tight text-text-heading sm:text-[44px]">
            Six steps, two approvals
          </h2>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-text-body">
            Each step passes structured output to the next. The run stops
            after the catalog search and again before anything is written
            back, and waits for you.
          </p>
        </div>
        <Link
          href="/agents"
          className="flex flex-shrink-0 items-center gap-1.5 text-[14px] font-medium text-accent transition-opacity hover:opacity-80"
        >
          Watch a run <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a, i) => {
          return (
            <div key={a.name} className="card-atlas flex flex-col p-6">
              <div className="flex items-start justify-between">
                <h3 className="text-[18px] font-semibold text-text-heading">
                  <span className="font-mono-atlas text-[13px] text-text-muted">0{i + 1}</span> {a.name}
                </h3>
                <span className="chip">{a.kind}</span>
              </div>
              <p className="mt-1 text-[13px] text-text-body">{a.role}</p>
              <p className="mt-4 text-[14px] leading-relaxed text-text-body">{a.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

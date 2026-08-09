import { Building2, LineChart, ScanEye, Shield } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const cards = [
  {
    icon: Building2,
    title: "Data platform teams",
    body: "Hand the on-call pager to agents. Atlas triages broken DAGs, backfills gaps and opens fixes before the morning standup.",
    tags: ["Autonomous incident triage", "Backfill orchestration", "Warehouse cost guardrails"],
  },
  {
    icon: LineChart,
    title: "Analytics engineering",
    body: "Ship models faster with agents that write dbt transformations, tests and documentation against your semantic layer.",
    tags: ["Model scaffolding", "Test & doc generation", "Semantic layer sync"],
  },
  {
    icon: ScanEye,
    title: "ML & AI platforms",
    body: "Keep feature pipelines fresh and reproducible, with drift detection wired straight into your training schedule.",
    tags: ["Feature freshness SLAs", "Drift detection", "Reproducible snapshots"],
  },
  {
    icon: Shield,
    title: "Regulated enterprises",
    body: "Every agent action is policy-checked, logged and reversible — designed for finance, health and public-sector controls.",
    tags: ["Policy-as-code review", "Immutable audit trail", "Private VPC deployment"],
  },
];

export function WhoItsFor() {
  return (
    <section id="use-cases" className="mx-auto max-w-[1280px] px-6 py-24 lg:px-10">
      <Eyebrow>Who it&apos;s for</Eyebrow>
      <h2 className="mt-6 max-w-xl text-[36px] font-bold leading-[1.15] tracking-tight text-text-heading sm:text-[44px]">
        Built for the teams that keep data trustworthy
      </h2>
      <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-text-body">
        Atlas AI slots into the stack you already run — Snowflake, BigQuery,
        Databricks, Postgres, Kafka and dbt — and takes over the repetitive
        engineering underneath it.
      </p>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.title} className="card-atlas flex flex-col p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent-dim-border bg-accent-dim text-accent">
              <c.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <h3 className="mt-5 text-[17px] font-semibold text-text-heading">{c.title}</h3>
            <p className="mt-2.5 text-[14px] leading-relaxed text-text-body">{c.body}</p>
            <ul className="mt-5 space-y-2.5 border-t border-border-hairline pt-4">
              {c.tags.map((t) => (
                <li key={t} className="flex items-start gap-2 text-[13px] text-text-body-strong">
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

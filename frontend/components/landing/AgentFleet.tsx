import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const agents = [
  {
    name: "Atlas Ingest",
    status: "running" as const,
    role: "Source connection & landing",
    body: "Connects new sources, infers schemas and lands raw data with idempotent loads and automatic replay on failure.",
    tags: ["Schema inference", "Incremental loads", "Replay on failure"],
    cadence: "continuous",
    metric: "1.4B rows / day",
  },
  {
    name: "Atlas Model",
    status: "review" as const,
    role: "Transformation authoring",
    body: "Writes and refactors SQL and dbt models from intent, complete with tests, documentation and lineage annotations.",
    tags: ["dbt model authoring", "Test generation", "Refactor proposals"],
    cadence: "on change",
    metric: "312 models managed",
  },
  {
    name: "Atlas Sentinel",
    status: "running" as const,
    role: "Quality & contracts",
    body: "Watches freshness, volume and distribution signals, enforcing data contracts before bad rows reach consumers.",
    tags: ["Anomaly detection", "Contract enforcement", "Consumer alerts"],
    cadence: "every 60s",
    metric: "2,480 checks / hour",
  },
  {
    name: "Atlas Repair",
    status: "running" as const,
    role: "Incident resolution",
    body: "Diagnoses failed runs, reproduces them in a sandbox and opens a reviewed pull request with the smallest safe fix.",
    tags: ["Root-cause analysis", "Sandbox reproduction", "Auto pull requests"],
    cadence: "event driven",
    metric: "94% auto-resolved",
  },
  {
    name: "Atlas Ledger",
    status: "scheduled" as const,
    role: "Cost & performance",
    body: "Rewrites expensive queries, tunes clustering and right-sizes warehouses against the budget your finance team set.",
    tags: ["Query rewriting", "Warehouse sizing", "Budget guardrails"],
    cadence: "nightly",
    metric: "38% spend reclaimed",
  },
  {
    name: "Atlas Warden",
    status: "review" as const,
    role: "Governance & access",
    body: "Classifies sensitive columns, applies masking policies and produces the audit evidence reviewers ask for.",
    tags: ["PII classification", "Masking policies", "Audit evidence"],
    cadence: "continuous",
    metric: "100% coverage",
  },
];

const statusMap = {
  running: { label: "Running", cls: "badge-running" },
  review: { label: "Awaiting review", cls: "badge-review" },
  scheduled: { label: "Scheduled", cls: "badge-scheduled" },
};

export function AgentFleet() {
  return (
    <section id="platform" className="mx-auto max-w-[1280px] px-6 py-24 lg:px-10">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>The agent fleet</Eyebrow>
          <h2 className="mt-6 max-w-xl text-[36px] font-bold leading-[1.15] tracking-tight text-text-heading sm:text-[44px]">
            Six specialists, one accountable system
          </h2>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-text-body">
            Each Atlas agent owns a narrow slice of the data lifecycle and
            hands off through a shared plan. You approve the boundaries; they
            do the work.
          </p>
        </div>
        <Link
          href="/agents"
          className="flex flex-shrink-0 items-center gap-1.5 text-[14px] font-medium text-accent transition-opacity hover:opacity-80"
        >
          See the live console <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const status = statusMap[a.status];
          return (
            <div key={a.name} className="card-atlas flex flex-col p-6">
              <div className="flex items-start justify-between">
                <h3 className="text-[18px] font-semibold text-text-heading">{a.name}</h3>
                <span className={`badge-status ${status.cls}`}>{status.label}</span>
              </div>
              <p className="mt-1 text-[13px] text-text-body">{a.role}</p>
              <p className="mt-4 text-[14px] leading-relaxed text-text-body">{a.body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {a.tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border-hairline pt-4 font-mono-atlas text-[13px]">
                <span className="text-text-muted">{a.cadence}</span>
                <span className="text-text-body-strong">{a.metric}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

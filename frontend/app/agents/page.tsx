import { AppSubNav } from "@/components/layout/AppSubNav";
import { AgentCard, type AgentCardData } from "@/components/agents/AgentCard";
import { ExecutionLog, type LogLine } from "@/components/agents/ExecutionLog";

const agents: AgentCardData[] = [
  {
    name: "Atlas Ingest",
    status: "running",
    role: "Source connection & landing",
    body: "Connects new sources, infers schemas and lands raw data with idempotent loads and automatic replay on failure.",
    cadence: "continuous",
    metric: "1.4B rows / day",
    progress: 62,
  },
  {
    name: "Atlas Model",
    status: "review",
    role: "Transformation authoring",
    body: "Writes and refactors SQL and dbt models from intent, complete with tests, documentation and lineage annotations.",
    cadence: "on change",
    metric: "312 models managed",
    progress: 38,
  },
  {
    name: "Atlas Sentinel",
    status: "running",
    role: "Quality & contracts",
    body: "Watches freshness, volume and distribution signals, enforcing data contracts before bad rows reach consumers.",
    cadence: "every 60s",
    metric: "2,480 checks / hour",
    progress: 81,
  },
  {
    name: "Atlas Repair",
    status: "running",
    role: "Incident resolution",
    body: "Diagnoses failed runs, reproduces them in a sandbox and opens a reviewed pull request with the smallest safe fix.",
    cadence: "event driven",
    metric: "94% auto-resolved",
    progress: 54,
  },
  {
    name: "Atlas Ledger",
    status: "scheduled",
    role: "Cost & performance",
    body: "Rewrites expensive queries, tunes clustering and right-sizes warehouses against the budget your finance team set.",
    cadence: "nightly",
    metric: "38% spend reclaimed",
    progress: 12,
  },
  {
    name: "Atlas Warden",
    status: "review",
    role: "Governance & access",
    body: "Classifies sensitive columns, applies masking policies and produces the audit evidence reviewers ask for.",
    cadence: "continuous",
    metric: "100% coverage",
    progress: 100,
  },
];

const logLines: LogLine[] = [
  { agent: "sentinel", text: "freshness check stg_events · 14m behind SLA · escalating" },
  { agent: "repair", text: "reproducing failed run 9f21c in sandbox warehouse" },
  { agent: "repair", text: "root cause: billing_country became nullable upstream" },
  { agent: "model", text: "patching fct_orders · adding coalesce + not_null test" },
  { agent: "repair", text: "dry-run passed · 412k rows · est. compute $0.38" },
  { agent: "repair", text: "opened PR #4821 · awaiting review from data-platform" },
  { agent: "ledger", text: "wh_analytics idle 22m · proposing downsize to Medium" },
];

export default function AgentsPage() {
  return (
    <>
      <AppSubNav crumb="agents" />
      <main className="flex-1 bg-bg-base">
        <div className="mx-auto max-w-[1280px] px-6 py-10 lg:px-10">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-[28px] font-bold text-text-heading">Running agents</h1>
              <p className="mt-1.5 text-[14px] text-text-body">
                Live view of the Atlas fleet operating your pipelines right now
              </p>
            </div>
            <a href="/demo" className="btn-primary">
              Run this on your stack
            </a>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_0.9fr]">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-2">
              {agents.map((a) => (
                <AgentCard key={a.name} agent={a} />
              ))}
            </div>
            <ExecutionLog lines={logLines} />
          </div>
        </div>
      </main>
    </>
  );
}

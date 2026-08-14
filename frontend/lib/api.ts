import type { ArtifactBundle, MatchedDataset, RequestSummary, ValidationReport } from "@/lib/types";
import { PIPELINE } from "@/lib/pipeline";

// The deployed Vercel build defaults to a client-side simulation so /demo
// and /new work reliably without depending on a live backend — Render's
// free tier cold-starts too slowly (30s+) for a hackathon demo. The
// simulation mirrors the real six-agent pipeline including the two
// human-in-the-loop checkpoints — see hooks/useRunStream.ts.
//
// To exercise the real FastAPI backend end to end, set BOTH
// NEXT_PUBLIC_API_URL and NEXT_PUBLIC_USE_BACKEND=true. docker-compose.yml
// sets both, so `docker compose up --build` locally still hits the real
// orchestrator; the Vercel build deliberately omits NEXT_PUBLIC_USE_BACKEND.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
export const HAS_BACKEND =
  process.env.NEXT_PUBLIC_USE_BACKEND === "true" && API_BASE.length > 0;

// --- Simulation resume signal --------------------------------------------
// When HAS_BACKEND is false, useRunStream simulates the pipeline in the
// browser and pauses at each checkpoint. The checkpoint panels still call
// acceptContext / startFresh / approveWriteback / skipWriteback — postAction
// below fires the matching resolver so the simulation advances past the
// pause, mirroring what the backend does over WS in real mode.

type ResumeSignal = () => void;
const resumeSignals = new Map<string, ResumeSignal[]>();

export function waitForSimulationResume(requestId: string): Promise<void> {
  return new Promise((resolve) => {
    const arr = resumeSignals.get(requestId) ?? [];
    arr.push(resolve);
    resumeSignals.set(requestId, arr);
  });
}

function triggerSimulationResume(requestId: string): void {
  const arr = resumeSignals.get(requestId);
  if (!arr || arr.length === 0) return;
  const next = arr.shift()!;
  if (arr.length === 0) resumeSignals.delete(requestId);
  next();
}

async function http<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json();
}

// GET /api/requests/{id}
export async function getRequest(requestId: string): Promise<RequestSummary> {
  if (HAS_BACKEND) return http(`/api/requests/${requestId}`);
  return mockRequest(requestId);
}

// GET /api/requests/{id}/artifacts
export async function getArtifacts(requestId: string): Promise<ArtifactBundle> {
  if (HAS_BACKEND) return http(`/api/requests/${requestId}/artifacts`);
  await delay(400);
  return mockArtifacts(requestId);
}

// Validation results live on the QA agent's AgentRun.output_json, surfaced
// here as a flat shape for the UI. Swap for a real endpoint if you add one.
export async function getValidationReport(requestId: string): Promise<ValidationReport> {
  if (HAS_BACKEND) return http(`/api/requests/${requestId}/validation`);
  await delay(400);
  return mockValidation(requestId);
}

// POST /api/requests  → { prompt } → { request_id }
export async function createRequest(prompt: string): Promise<{ request_id: string }> {
  if (HAS_BACKEND) {
    const res = await fetch(`${API_BASE}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }
  return { request_id: Math.random().toString(36).slice(2, 8) };
}

async function postAction(requestId: string, path: string): Promise<void> {
  if (!HAS_BACKEND) {
    // Simulation mode: fire the pending resume so useRunStream advances past
    // the current checkpoint. The panel that called this then unmounts as
    // soon as useRunStream clears pausedAt on the next stage's "started".
    triggerSimulationResume(requestId);
    return;
  }
  const res = await fetch(`${API_BASE}/api/requests/${requestId}${path}`, { method: "POST" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
}

// POST /api/requests/{id}/context/accept — use DataHub's matched datasets as context
export async function acceptContext(requestId: string): Promise<void> {
  return postAction(requestId, "/context/accept");
}

// POST /api/requests/{id}/context/start-fresh — proceed without grounding
export async function startFresh(requestId: string): Promise<void> {
  return postAction(requestId, "/context/start-fresh");
}

// POST /api/requests/{id}/writeback/approve — write results back to DataHub
export async function approveWriteback(requestId: string): Promise<void> {
  return postAction(requestId, "/writeback/approve");
}

// POST /api/requests/{id}/writeback/skip — finish without writing back
export async function skipWriteback(requestId: string): Promise<void> {
  return postAction(requestId, "/writeback/skip");
}

// WS /api/requests/{id}/stream — build a live socket URL for useRunStream.
export function streamUrl(requestId: string): string {
  const base = API_BASE.replace(/^http/, "ws") || "ws://localhost:8000";
  return `${base}/api/requests/${requestId}/stream`;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Mirrors backend/app/demo/seed_data.py's _MATCHED_DATASETS exactly so the
// ContextReviewPanel and WritebackApprovalPanel render the same three
// datasets in simulation as a real Groq + DataHub run would.
const MOCK_MATCHED_DATASETS: MatchedDataset[] = [
  {
    urn: "urn:li:dataset:(urn:li:dataPlatform:stripe,raw.stripe_payments,PROD)",
    name: "raw.stripe_payments",
    platform: "stripe",
    confidence: 0.94,
    columns: ["payment_id", "customer_id", "amount_cents", "currency", "card_last4", "created_at"],
    owners: ["data-platform@atlas.ai"],
    tags: ["pii", "finance"],
  },
  {
    urn: "urn:li:dataset:(urn:li:dataPlatform:postgres,public.customers,PROD)",
    name: "public.customers",
    platform: "postgres",
    confidence: 0.91,
    columns: ["customer_id", "customer_name", "email", "signup_at", "plan_tier"],
    owners: ["backend-team@atlas.ai"],
    tags: ["core"],
  },
  {
    urn: "urn:li:dataset:(urn:li:dataPlatform:postgres,public.orders,PROD)",
    name: "public.orders",
    platform: "postgres",
    confidence: 0.89,
    columns: ["order_id", "customer_id", "payment_id", "order_total", "created_at"],
    owners: ["backend-team@atlas.ai"],
    tags: ["core", "finance"],
  },
];

function mockRequest(requestId: string): RequestSummary {
  return {
    id: requestId,
    prompt: "Build a customer revenue pipeline from raw Stripe and Postgres events",
    status: "complete",
    trace_id: requestId,
    created_at: new Date().toISOString(),
    context_mode: "grounded",
    writeback_mode: "approved",
    agent_runs: PIPELINE.map((s) => ({
      id: `${requestId}-${s.id}`,
      request_id: requestId,
      agent_name: s.id as RequestSummary["agent_runs"][number]["agent_name"],
      status: "success",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      input_json: null,
      // metadata_analyst carries the matched_datasets the two checkpoint
      // panels read via getRequest(). All other stages leave output_json
      // null in simulation — the panels don't consume them.
      output_json:
        s.id === "metadata_analyst"
          ? ({ matched_datasets: MOCK_MATCHED_DATASETS } as Record<string, unknown>)
          : null,
      error: null,
    })),
  };
}

function mockArtifacts(requestId: string): ArtifactBundle {
  return {
    request_id: requestId,
    dbt_models: `-- models/marts/fct_revenue.sql
with orders as (
    select * from {{ ref('stg_orders') }}
),
customers as (
    select * from {{ ref('stg_customers') }}
)

select
    o.order_id,
    o.customer_id,
    c.customer_name,
    o.order_total,
    o.created_at
from orders o
left join customers c on o.customer_id = c.customer_id`,
    sql: `-- ad-hoc validation query
select
    date_trunc('day', created_at) as day,
    count(*) as orders,
    sum(order_total) as revenue
from fct_revenue
group by 1
order by 1 desc
limit 30;`,
    tests: `# tests/schema.yml
version: 2
models:
  - name: fct_revenue
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: customer_id
        tests: [not_null]
      - name: order_total
        tests:
          - dbt_utils.accepted_range:
              min_value: 0`,
    docs: `# fct_revenue

Grain: one row per order.

| Column | Description |
|---|---|
| order_id | Primary key |
| customer_id | FK to dim_customer |
| customer_name | Denormalized for reporting |
| order_total | Order value in USD |
| created_at | Order timestamp (UTC) |

Source: stg_orders (Stripe), stg_customers (Postgres).
Owner: data-platform@atlas.ai`,
    configs: `# dbt_project.yml (excerpt)
models:
  atlas:
    marts:
      +materialized: table
      +schema: analytics
      +tags: ['revenue', 'atlas-generated']`,
  };
}

function mockValidation(requestId: string): ValidationReport {
  return {
    request_id: requestId,
    passed: false,
    checks: [
      {
        name: "Schema compatibility",
        passed: true,
        message: "fct_revenue matches the registered DataHub schema.",
        severity: "info",
      },
      {
        name: "SQL lint",
        passed: true,
        message: "No syntax or style violations found.",
        severity: "info",
      },
      {
        name: "Not-null constraints",
        passed: true,
        message: "order_id and customer_id pass not-null checks on sample data.",
        severity: "info",
      },
      {
        name: "PII exposure",
        passed: false,
        message:
          "customer_name is tagged PII in DataHub and is not currently masked in this model.",
        severity: "critical",
      },
      {
        name: "Missing metadata",
        passed: true,
        message: "All columns have descriptions synced from DataHub glossary.",
        severity: "warning",
      },
    ],
  };
}

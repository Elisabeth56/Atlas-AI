import type { ArtifactBundle, RequestSummary, ValidationReport } from "@/lib/types";
import { PIPELINE } from "@/lib/pipeline";

// Set this once your backend is deployed — every function below switches
// from mock data to the real FastAPI endpoints automatically.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
export const HAS_BACKEND = API_BASE.length > 0;

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
    // Pure frontend-only mock mode has no orchestrator to resume — mockRequest
    // always returns a "complete" snapshot with no pending checkpoint, so
    // there's nothing for this to actually do. No-op rather than throw, so a
    // standalone frontend preview doesn't break if a panel somehow renders.
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
      output_json: null,
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

import type { AgentId, ArtifactFiles, MatchedDataset, Run, RunListItem, ValidationReport } from "@/lib/types";
import { PIPELINE } from "@/lib/pipeline";
import { toApiError } from "@/lib/errors";
import { accessToken } from "@/lib/supabase/client";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// The deployed Vercel build defaults to a client-side simulation so /demo
// and /new work reliably without depending on a live backend — Render's
// free tier cold-starts too slowly (30s+) for a reliable demo. The
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
// pause, mirroring what the checkpoint endpoints do in real mode.

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
  const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

// GET /api/runs — the workspace's recent runs, newest first
export async function listRuns(limit = 30): Promise<RunListItem[]> {
  if (!HAS_BACKEND) return [];
  return http(`/api/runs?limit=${limit}`);
}

// GET /api/runs/{id}
export async function getRun(requestId: string): Promise<Run> {
  if (HAS_BACKEND) return http(`/api/runs/${requestId}`);
  return mockRun(requestId);
}

// GET /api/runs/{id}/artifacts
export async function getArtifacts(requestId: string): Promise<ArtifactFiles> {
  if (HAS_BACKEND) return http(`/api/runs/${requestId}/artifacts`);
  await delay(400);
  return mockArtifacts(requestId);
}

// Validation results live on the QA agent's RunStep.output, surfaced
// here as a flat shape for the UI. Swap for a real endpoint if you add one.
export async function getValidationReport(requestId: string): Promise<ValidationReport> {
  if (HAS_BACKEND) return http(`/api/runs/${requestId}/validation`);
  await delay(400);
  return mockValidation(requestId);
}

// POST /api/runs  → { prompt } → { run_id }
export async function createRun(prompt: string): Promise<{ run_id: string }> {
  if (HAS_BACKEND) {
    const res = await fetch(`${API_BASE}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw await toApiError(res);
    return res.json();
  }
  return { run_id: Math.random().toString(36).slice(2, 8) };
}

async function postAction(requestId: string, path: string): Promise<void> {
  if (!HAS_BACKEND) {
    // Simulation mode: fire the pending resume so useRunStream advances past
    // the current checkpoint. The panel that called this then unmounts as
    // soon as useRunStream clears pausedAt on the next stage's "started".
    triggerSimulationResume(requestId);
    return;
  }
  const res = await fetch(`${API_BASE}/api/runs/${requestId}${path}`, { method: "POST", headers: await authHeaders() });
  if (!res.ok) throw await toApiError(res);
}

// POST /api/runs/{id}/context/accept — use DataHub's matched datasets as context
export async function acceptContext(requestId: string): Promise<void> {
  return postAction(requestId, "/context/accept");
}

// POST /api/runs/{id}/context/start-fresh — proceed without grounding
export async function startFresh(requestId: string): Promise<void> {
  return postAction(requestId, "/context/start-fresh");
}

// POST /api/runs/{id}/writeback/approve — write results back to DataHub
export async function approveWriteback(requestId: string): Promise<void> {
  return postAction(requestId, "/writeback/approve");
}

// POST /api/runs/{id}/writeback/skip — finish without writing back
export async function skipWriteback(requestId: string): Promise<void> {
  return postAction(requestId, "/writeback/skip");
}

// POST /api/runs/{id}/fixes/{fixId}/apply — apply a QA fix; returns the re-checked report
export async function applyFix(requestId: string, fixId: string): Promise<ValidationReport> {
  if (!HAS_BACKEND) return { ...mockValidation(requestId), passed: true, blocking: false };
  const res = await fetch(`${API_BASE}/api/runs/${requestId}/fixes/${fixId}/apply`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

// POST /api/runs/{id}/steps/{agent}/retry — continue a failed run from the step it stopped at
export async function retryStep(requestId: string, agent: AgentId): Promise<void> {
  return postAction(requestId, `/steps/${agent}/retry`);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Mirrors apps/api/app/demo/seed_data.py's _MATCHED_DATASETS exactly so the
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

function mockRun(requestId: string): Run {
  return {
    id: requestId,
    prompt: "Build a customer revenue pipeline from raw Stripe and Postgres events",
    status: "complete",
    trace_id: requestId,
    created_at: new Date().toISOString(),
    context_mode: "grounded",
    writeback_mode: "approved",
    steps: PIPELINE.map((s) => ({
      id: `${requestId}-${s.id}`,
      run_id: requestId,
      agent: s.id as Run["steps"][number]["agent"],
      status: "success",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      input: null,
      // only the stages the checkpoint panels read carry output in simulation
      output:
        s.id === "metadata_analyst"
          ? ({ matched_datasets: MOCK_MATCHED_DATASETS } as Record<string, unknown>)
          : s.id === "data_engineer"
            ? ({
                files: [{ kind: "dbt_model", filename: "models/marts/fct_revenue.sql" }],
              } as Record<string, unknown>)
            : null,
      error: null,
      logs: [],
      usage: null,
    })),
  };
}

function mockArtifacts(requestId: string): ArtifactFiles {
  const file = (filename: string, kind: ArtifactFiles["files"][number]["kind"], source_agent: string, content: string) => ({
    filename, kind, source_agent, content,
  });
  return {
    run_id: requestId,
    files: [
      file("models/staging/stg_stripe_payments.sql", "dbt_model", "data_engineer",
        "with source as (\n    select * from {{ source('raw', 'stripe_payments') }}\n)\n\nselect\n    payment_id,\n    customer_id,\n    amount_cents / 100.0 as amount_usd,\n    currency,\n    card_last4,\n    created_at\nfrom source\n"),
      file("models/marts/fct_customer_revenue.sql", "dbt_model", "data_engineer",
        "select\n    o.order_id,\n    o.customer_id,\n    p.amount_usd,\n    o.created_at\nfrom {{ source('public', 'orders') }} o\nleft join {{ ref('stg_stripe_payments') }} p on o.payment_id = p.payment_id\n"),
      file("models/marts/schema.yml", "test", "data_engineer",
        "version: 2\nmodels:\n  - name: fct_customer_revenue\n    columns:\n      - name: order_id\n        tests: [unique, not_null]\n"),
      file("docs/fct_customer_revenue.md", "doc", "documentation", "# fct_customer_revenue\n\nOne row per order.\n"),
      file("dbt_project.yml", "config", "data_engineer", "models:\n  atlas:\n    marts:\n      +materialized: table\n"),
    ],
  };
}

function mockValidation(requestId: string): ValidationReport {
  return {
    run_id: requestId,
    passed: false,
    blocking: true,
    fixes: [],
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

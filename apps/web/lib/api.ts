import type { AgentId, ArtifactFiles, Run, RunListItem, ValidationReport } from "@/lib/types";
import { toApiError } from "@/lib/errors";
import { accessToken } from "@/lib/supabase/client";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// The FastAPI backend. Local development runs it with docker compose; production points at the VM (ADR 007).
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function http<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

// GET /api/runs — the workspace's recent runs, newest first
export async function listRuns(limit = 30): Promise<RunListItem[]> {
  return http(`/api/runs?limit=${limit}`);
}

// GET /api/runs/{id}
export async function getRun(requestId: string): Promise<Run> {
  return http(`/api/runs/${requestId}`);
}

// GET /api/runs/{id}/artifacts
export async function getArtifacts(requestId: string): Promise<ArtifactFiles> {
  return http(`/api/runs/${requestId}/artifacts`);
}

// GET /api/runs/{id}/validation — QA's checks, whether they block writeback, and suggested fixes
export async function getValidationReport(requestId: string): Promise<ValidationReport> {
  return http(`/api/runs/${requestId}/validation`);
}

// POST /api/runs  → { prompt } → { run_id }
export async function createRun(prompt: string): Promise<{ run_id: string }> {
  const res = await fetch(`${API_BASE}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}

async function postAction(requestId: string, path: string): Promise<void> {
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

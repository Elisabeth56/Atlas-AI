// Mirrors apps/api/app/schemas.py and models.py. Keep these in sync with the
// FastAPI Pydantic contracts so the frontend never has to guess shapes.

export type AgentId =
  | "planner"
  | "metadata_analyst"
  | "data_engineer"
  | "qa"
  | "documentation"
  | "writeback";

export type AgentRunStatus = "pending" | "started" | "success" | "failed";

export interface RunStep {
  id: string;
  run_id: string;
  agent: AgentId;
  status: AgentRunStatus;
  started_at: string | null;
  finished_at: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  logs: string[]; // appended live by the worker
}

export type RequestStatus =
  | "pending"
  | "running"
  | "awaiting_context_approval"
  | "awaiting_writeback_approval"
  | "complete"
  | "failed";

export type ContextMode = "grounded" | "fresh";
export type WritebackMode = "approved" | "skipped";

export interface Run {
  id: string;
  prompt: string;
  status: RequestStatus;
  trace_id: string;
  created_at: string;
  context_mode: ContextMode | null;
  writeback_mode: WritebackMode | null;
  steps: RunStep[];
}

// Shape of each entry in metadata_analyst's RunStep.output.matched_datasets —
// mirrors apps/api/app/schemas.py's MatchedDataset exactly.
export interface MatchedDataset {
  urn: string;
  name: string;
  platform: string;
  confidence: number;
  columns: string[];
  owners: string[];
  tags: string[];
}

export type ArtifactKind = "dbt_model" | "sql" | "test" | "doc" | "config";

export interface ArtifactBundle {
  run_id: string;
  dbt_models: string;
  sql: string;
  tests: string;
  docs: string;
  configs: string;
}

export type ValidationSeverity = "info" | "warning" | "critical";

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: ValidationSeverity;
}

export interface ValidationReport {
  run_id: string;
  checks: ValidationCheck[];
  passed: boolean;
  blocking: boolean;
}

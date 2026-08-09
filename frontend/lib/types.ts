// Mirrors backend/app/schemas.py and models.py. Keep these in sync with the
// FastAPI Pydantic contracts so the frontend never has to guess shapes.

export type AgentId =
  | "planner"
  | "metadata_analyst"
  | "data_engineer"
  | "qa"
  | "documentation"
  | "writeback";

export type AgentRunStatus = "pending" | "started" | "success" | "failed";

// "awaiting_approval" is a genuine pause signal, not a stage outcome — it
// fires once for the checkpoint agent ("metadata_analyst" for the context
// checkpoint, "writeback" for the writeback checkpoint) and nothing else
// happens until the corresponding accept/start-fresh or approve/skip
// endpoint is called.
export interface AgentRunEvent {
  agent: AgentId;
  status: "started" | "done" | "failed" | "awaiting_approval";
  result?: { summary: string };
  error?: string;
}

export interface AgentRun {
  id: string;
  request_id: string;
  agent_name: AgentId;
  status: AgentRunStatus;
  started_at: string | null;
  finished_at: string | null;
  input_json: Record<string, unknown> | null;
  output_json: Record<string, unknown> | null;
  error: string | null;
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

export interface RequestSummary {
  id: string;
  prompt: string;
  status: RequestStatus;
  trace_id: string;
  created_at: string;
  context_mode: ContextMode | null;
  writeback_mode: WritebackMode | null;
  agent_runs: AgentRun[];
}

// Shape of each entry in metadata_analyst's AgentRun.output_json.matched_datasets —
// mirrors backend/app/schemas.py's MatchedDataset exactly.
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
  request_id: string;
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
  request_id: string;
  checks: ValidationCheck[];
  passed: boolean;
}

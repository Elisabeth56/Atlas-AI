"""
Pydantic v2 API contracts.

CRITICAL: every shape in this file must stay byte-for-byte compatible with
`frontend/lib/types.ts`. That file is the source of truth for the wire
format (it was reviewed directly, not assumed) — if you change a field
here, mirror it there in the same commit, or the frontend will silently
mis-parse responses.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# --- Shared literals ---------------------------------------------------

AgentId = Literal[
    "planner",
    "metadata_analyst",
    "data_engineer",
    "qa",
    "documentation",
    "writeback",
]

AGENT_SEQUENCE: list[AgentId] = [
    "planner",
    "metadata_analyst",
    "data_engineer",
    "qa",
    "documentation",
    "writeback",
]

# DB / REST vocabulary for an individual agent run.
AgentRunStatus = Literal["pending", "started", "success", "failed"]

# WebSocket event vocabulary. "awaiting_approval" is a genuine pause signal,
# not a stage outcome — it fires once for the checkpoint agent
# ("metadata_analyst" for the context checkpoint, "writeback" for the
# writeback checkpoint) and the frontend must call the corresponding
# approve/skip endpoint before anything else happens.
WSAgentStatus = Literal["started", "done", "failed", "awaiting_approval"]

RequestStatus = Literal[
    "pending",
    "running",
    "awaiting_context_approval",
    "awaiting_writeback_approval",
    "complete",
    "failed",
]

ContextMode = Literal["grounded", "fresh"]
WritebackMode = Literal["approved", "skipped"]

ArtifactKind = Literal["dbt_model", "sql", "test", "doc", "config"]

ValidationSeverity = Literal["info", "warning", "critical"]


# --- WebSocket event ------------------------------------------------

class WSResult(BaseModel):
    summary: str


class AgentRunEvent(BaseModel):
    """
    Exact shape consumed by `hooks/useRunStream.ts`. Sent as raw JSON text
    over the `/api/requests/{id}/stream` socket — one event per stage
    transition (started -> done|failed).
    """

    model_config = ConfigDict(populate_by_name=True)

    agent: AgentId
    status: WSAgentStatus
    result: WSResult | None = None
    error: str | None = None


# --- REST: agent runs -----------------------------------------------

class AgentRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    request_id: str
    agent_name: AgentId
    status: AgentRunStatus
    started_at: datetime | None
    finished_at: datetime | None
    input_json: dict | None
    output_json: dict | None
    error: str | None


# --- REST: requests ---------------------------------------------------

class CreateRequestIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)


class CreateRequestOut(BaseModel):
    request_id: str


class RequestSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    prompt: str
    status: RequestStatus
    trace_id: str
    created_at: datetime
    context_mode: ContextMode | None
    writeback_mode: WritebackMode | None
    agent_runs: list[AgentRunOut]


# --- REST: artifacts ----------------------------------------------------

class ArtifactBundleOut(BaseModel):
    """
    Flattened bundle — each field is the newline-joined content of every
    artifact of that kind, matching `ArtifactBundle` in lib/types.ts
    exactly (the frontend renders these as single code blocks, not a file
    list, so we concatenate server-side rather than pushing that logic
    into the UI).
    """

    request_id: str
    dbt_models: str
    sql: str
    tests: str
    docs: str
    configs: str


# --- REST: validation ----------------------------------------------------

class ValidationCheckOut(BaseModel):
    name: str
    passed: bool
    message: str
    severity: ValidationSeverity


class ValidationReportOut(BaseModel):
    request_id: str
    checks: list[ValidationCheckOut]
    passed: bool


# --- Internal: agent I/O schemas ----------------------------------------
# These are NOT sent to the frontend directly — they're the typed contract
# between orchestrator <-> agents, persisted into AgentRun.input_json /
# output_json as dicts. Keeping them as real Pydantic models (rather than
# loose dicts) means every agent is independently unit-testable against a
# concrete schema.


class PlannerInput(BaseModel):
    prompt: str


class PlannerOutput(BaseModel):
    goal: str
    entities: list[str]
    summary: str


class MetadataAnalystInput(BaseModel):
    goal: str
    entities: list[str]


class MatchedDataset(BaseModel):
    urn: str
    name: str
    platform: str
    confidence: float
    columns: list[str]
    owners: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class MetadataAnalystOutput(BaseModel):
    matched_datasets: list[MatchedDataset]
    reasoning: str
    summary: str


class DataEngineerInput(BaseModel):
    goal: str
    matched_datasets: list[MatchedDataset]


class GeneratedFile(BaseModel):
    kind: ArtifactKind
    filename: str
    content: str


class DataEngineerOutput(BaseModel):
    files: list[GeneratedFile]
    summary: str


class QAInput(BaseModel):
    files: list[GeneratedFile]
    matched_datasets: list[MatchedDataset]


class QAOutput(BaseModel):
    checks: list[ValidationCheckOut]
    passed: bool
    summary: str


class DocumentationInput(BaseModel):
    files: list[GeneratedFile]
    matched_datasets: list[MatchedDataset]


class DocumentationOutput(BaseModel):
    files: list[GeneratedFile]  # doc-kind GeneratedFile entries
    summary: str


class WritebackInput(BaseModel):
    request_id: str
    matched_datasets: list[MatchedDataset]
    files: list[GeneratedFile]
    checks: list[ValidationCheckOut]


class WritebackOutput(BaseModel):
    urns_updated: list[str]
    lineage_edges_added: int
    summary: str

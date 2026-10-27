"""
Pydantic v2 API contracts.

CRITICAL: every shape in this file must stay byte-for-byte compatible with
`apps/web/lib/types.ts`. That file is the source of truth for the wire
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


# --- REST: agent runs -----------------------------------------------

class RunStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    agent: AgentId
    status: AgentRunStatus
    started_at: datetime | None
    finished_at: datetime | None
    input: dict | None
    output: dict | None
    error: str | None
    logs: list[str]


# --- REST: requests ---------------------------------------------------

class CreateRunIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)


class CreateRunOut(BaseModel):
    run_id: str


class RunListItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    prompt: str
    status: RequestStatus
    created_at: datetime


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    prompt: str
    status: RequestStatus
    trace_id: str
    created_at: datetime
    context_mode: ContextMode | None
    writeback_mode: WritebackMode | None
    steps: list[RunStepOut]


# --- REST: artifacts ----------------------------------------------------

class ArtifactBundleOut(BaseModel):
    """
    Flattened bundle — each field is the newline-joined content of every
    artifact of that kind, matching `ArtifactBundle` in lib/types.ts
    exactly (the frontend renders these as single code blocks, not a file
    list, so we concatenate server-side rather than pushing that logic
    into the UI).
    """

    run_id: str
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
    run_id: str
    checks: list[ValidationCheckOut]
    passed: bool
    blocking: bool


# --- Internal: agent I/O schemas ----------------------------------------
# These are NOT sent to the frontend directly — they're the typed contract
# between orchestrator <-> agents, persisted into RunStep.input /
# output as dicts. Keeping them as real Pydantic models (rather than
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
    run_id: str
    matched_datasets: list[MatchedDataset]
    files: list[GeneratedFile]
    checks: list[ValidationCheckOut]


class WritebackOutput(BaseModel):
    urns_updated: list[str]
    lineage_edges_added: int
    summary: str

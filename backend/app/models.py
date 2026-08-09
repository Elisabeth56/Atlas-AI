"""
SQLAlchemy ORM models.

Table design mirrors the domain 1:1 with the frontend's `lib/types.ts`
contract:
  - `requests`            -> RequestSummary (minus nested agent_runs)
  - `agent_runs`          -> AgentRun[]
  - `artifacts`           -> flattened into ArtifactBundle at the API layer
  - `validation_reports`  -> ValidationReport

Primary keys are string UUIDs (uuid4, stored as native Postgres UUID) —
easy to pass around as opaque route params, no auto-increment leakage.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Request(Base):
    """A single natural-language request submitted to Atlas AI."""

    __tablename__ = "requests"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    # pending | running | awaiting_context_approval | awaiting_writeback_approval
    # | complete | failed  (matches RequestSummary["status"])
    #
    # The two "awaiting_*" states are genuine pauses, not just UI labels: the
    # orchestrator stops executing and returns after persisting each one —
    # see orchestrator.py's run_context_phase / resume_generation_phase /
    # resume_writeback_phase split. Nothing proceeds past a checkpoint
    # without an explicit POST to the corresponding approve/skip endpoint.
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    # Correlation ID for tracing/logging across agents + external calls.
    # Distinct from `id` so we can rotate/redact it without touching the PK.
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    # Audit trail of what the human actually chose at each checkpoint —
    # null until that checkpoint is reached. "grounded" means the user
    # accepted DataHub's matched datasets as context; "fresh" means they
    # explicitly chose to proceed without them (including the case where
    # DataHub had nothing to match). "approved"/"skipped" mirrors the same
    # idea for the writeback checkpoint.
    context_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    writeback_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)

    agent_runs: Mapped[list["AgentRun"]] = relationship(
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="AgentRun.sequence",
    )
    artifacts: Mapped[list["Artifact"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )
    validation_report: Mapped["ValidationReport | None"] = relationship(
        back_populates="request", cascade="all, delete-orphan", uselist=False
    )


class AgentRun(Base):
    """One pipeline stage's execution record for a given request."""

    __tablename__ = "agent_runs"
    __table_args__ = (
        Index("ix_agent_runs_request_id", "request_id"),
    )

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    request_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("requests.id", ondelete="CASCADE")
    )
    # Fixed pipeline order (0=planner .. 5=writeback). Lets us ORDER BY
    # deterministically without relying on insertion order guarantees.
    sequence: Mapped[int] = mapped_column(nullable=False)
    # planner | metadata_analyst | data_engineer | qa | documentation | writeback
    agent_name: Mapped[str] = mapped_column(String(32), nullable=False)
    # pending | started | success | failed  (matches AgentRun["status"])
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    input_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    output_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    request: Mapped["Request"] = relationship(back_populates="agent_runs")


class Artifact(Base):
    """A single generated file (dbt model, SQL, test, doc, or config)."""

    __tablename__ = "artifacts"
    __table_args__ = (
        Index("ix_artifacts_request_id", "request_id"),
    )

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    request_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("requests.id", ondelete="CASCADE")
    )
    # dbt_model | sql | test | doc | config  (matches ArtifactKind)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    request: Mapped["Request"] = relationship(back_populates="artifacts")


class ValidationReport(Base):
    """QA agent's structured validation output for a request."""

    __tablename__ = "validation_reports"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    request_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("requests.id", ondelete="CASCADE"),
        unique=True,
    )
    # list[ValidationCheck] serialized as JSONB
    checks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    request: Mapped["Request"] = relationship(back_populates="validation_report")

"""ORM models. Tables mirror the frontend contract in apps/web/lib/types.ts."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Request(Base):
    """A single natural-language request submitted to Atlas AI."""

    __tablename__ = "requests"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=_uuid
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    # pending | running | awaiting_context_approval | awaiting_writeback_approval | complete | failed
    # The awaiting_* states are real pauses: nothing runs until a checkpoint endpoint claims the run.
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    # Correlation ID for tracing/logging across agents + external calls.
    # Distinct from `id` so we can rotate/redact it without touching the PK.
    trace_id: Mapped[str] = mapped_column(String(64), nullable=False, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    # what the human chose at each checkpoint: grounded | fresh, approved | skipped
    context_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    writeback_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)

    agent_runs: Mapped[list[AgentRun]] = relationship(
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="AgentRun.sequence",
    )
    artifacts: Mapped[list[Artifact]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )
    validation_report: Mapped[ValidationReport | None] = relationship(
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

    request: Mapped[Request] = relationship(back_populates="agent_runs")


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
    # the stage that produced this file; a re-run of that stage replaces its files
    source_agent: Mapped[str] = mapped_column(String(32), nullable=False)
    # dbt_model | sql | test | doc | config  (matches ArtifactKind)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    request: Mapped[Request] = relationship(back_populates="artifacts")


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
    # true when any check failed with severity "critical"; blocks writeback approval
    blocking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    request: Mapped[Request] = relationship(back_populates="validation_report")

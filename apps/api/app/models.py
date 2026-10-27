"""ORM mappings for the tables in supabase/migrations. The migrations own the schema and its constraints."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Run(Base):
    """One natural-language request and everything Atlas did with it."""

    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("workspaces.id"))
    created_by: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    prompt: Mapped[str] = mapped_column(Text)
    # pending | running | awaiting_context_approval | awaiting_writeback_approval | complete | failed
    # The awaiting_* states are real pauses: nothing runs until a checkpoint endpoint claims the run.
    status: Mapped[str] = mapped_column(String(32), default="pending")
    # what the human chose at each checkpoint: grounded | fresh, approved | skipped
    context_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    writeback_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    trace_id: Mapped[str] = mapped_column(UUID(as_uuid=False), default=_uuid)
    # work owed to the worker (context | generation | writeback); null when nothing is queued
    phase: Mapped[str | None] = mapped_column(String(16), nullable=True)
    locked_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(SmallInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    steps: Mapped[list[RunStep]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="RunStep.sequence"
    )
    artifacts: Mapped[list[Artifact]] = relationship(back_populates="run", cascade="all, delete-orphan")
    validation_report: Mapped[ValidationReport | None] = relationship(
        back_populates="run", cascade="all, delete-orphan", uselist=False
    )


class RunStep(Base):
    """One pipeline stage's execution record for a run."""

    __tablename__ = "run_steps"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("runs.id", ondelete="CASCADE"))
    sequence: Mapped[int] = mapped_column(SmallInteger)  # 0=planner .. 5=writeback
    agent: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | started | success | failed
    input: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    output: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    logs: Mapped[list[str]] = mapped_column(JSONB, default=list)  # appended live by the worker
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    run: Mapped[Run] = relationship(back_populates="steps")


class Artifact(Base):
    """One generated file (dbt model, SQL, test, doc or config)."""

    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("runs.id", ondelete="CASCADE"))
    # the stage that produced this file; a re-run of that stage replaces its files
    source_agent: Mapped[str] = mapped_column(String(32))
    kind: Mapped[str] = mapped_column(String(16))  # dbt_model | sql | test | doc | config
    filename: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    run: Mapped[Run] = relationship(back_populates="artifacts")


class ValidationReport(Base):
    """The QA agent's checks for a run."""

    __tablename__ = "validation_reports"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("runs.id", ondelete="CASCADE"), unique=True)
    checks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    passed: Mapped[bool] = mapped_column(Boolean)
    # true when any check failed with severity "critical"; blocks writeback approval
    blocking: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    run: Mapped[Run] = relationship(back_populates="validation_report")


class LlmCall(Base):
    """One HTTP call to an LLM provider, failed ones included."""

    __tablename__ = "llm_calls"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("runs.id", ondelete="CASCADE"))
    agent: Mapped[str] = mapped_column(String(32))
    provider: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(Text)
    prompt_id: Mapped[str] = mapped_column(Text)
    tokens_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer)
    outcome: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    workspace_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("workspaces.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    role: Mapped[str] = mapped_column(String(16), default="owner")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class DatahubConnection(Base):
    __tablename__ = "datahub_connections"

    workspace_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("workspaces.id"), primary_key=True)
    mode: Mapped[str] = mapped_column(String(16), default="sample")  # sample | mcp
    gms_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)

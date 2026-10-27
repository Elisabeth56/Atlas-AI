"""Run routes. Endpoints only record decisions and queue work; app/worker.py runs it.
Every route is scoped to the caller's workspace; a run in another workspace is a 404.

  GET  /api/runs                          recent runs, newest first
  POST /api/runs                          start a run
  GET  /api/runs/{id}                     the run and its steps
  GET  /api/runs/{id}/artifacts           generated files, grouped by kind
  GET  /api/runs/{id}/validation          the QA report
  POST /api/runs/{id}/context/accept      checkpoint 1: keep the matched sources
  POST /api/runs/{id}/context/start-fresh checkpoint 1: continue without grounding
  POST /api/runs/{id}/writeback/approve   checkpoint 2: write docs and lineage to DataHub
  POST /api/runs/{id}/writeback/skip      checkpoint 2: finish without writing back
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import Caller, current_caller
from app.config import get_settings
from app.database import get_db
from app.errors import AppError
from app.models import Artifact, LlmCall, Run, ValidationReport
from app.schemas import (
    ArtifactBundleOut,
    CreateRunIn,
    CreateRunOut,
    RunListItemOut,
    RunOut,
    StepUsageOut,
    ValidationCheckOut,
    ValidationReportOut,
)

logger = logging.getLogger("atlas.routers.runs")

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("", response_model=list[RunListItemOut])
async def list_runs(
    limit: int = Query(default=20, ge=1, le=100),
    caller: Caller = Depends(current_caller),
    db: AsyncSession = Depends(get_db),
) -> list[Run]:
    result = await db.execute(
        select(Run).where(Run.workspace_id == caller.workspace_id).order_by(Run.created_at.desc()).limit(limit)
    )
    return list(result.scalars())


@router.post("", response_model=CreateRunOut, status_code=201)
async def create_run(
    body: CreateRunIn,
    caller: Caller = Depends(current_caller),
    db: AsyncSession = Depends(get_db),
) -> CreateRunOut:
    await _check_rate_limit(db, caller)
    run = Run(
        prompt=body.prompt, status="pending", phase="context",  # queued for the worker
        workspace_id=caller.workspace_id, created_by=caller.user_id,
    )
    db.add(run)
    await db.commit()
    return CreateRunOut(run_id=run.id)


@router.get("/{run_id}", response_model=RunOut)
async def get_run(run_id: str, caller: Caller = Depends(current_caller), db: AsyncSession = Depends(get_db)) -> RunOut:
    run = await db.scalar(
        select(Run).where(Run.id == run_id, Run.workspace_id == caller.workspace_id).options(selectinload(Run.steps))
    )
    if run is None:
        raise _not_found()
    out = RunOut.model_validate(run)
    usage = await _usage_by_agent(db, run_id)
    for step in out.steps:
        step.usage = usage.get(step.agent)
    return out


@router.get("/{run_id}/artifacts", response_model=ArtifactBundleOut)
async def get_artifacts(
    run_id: str, caller: Caller = Depends(current_caller), db: AsyncSession = Depends(get_db)
) -> ArtifactBundleOut:
    await _owned_run(db, run_id, caller)
    result = await db.execute(select(Artifact).where(Artifact.run_id == run_id).order_by(Artifact.created_at))
    artifacts = result.scalars().all()

    def joined(kind: str) -> str:
        return "\n\n".join(f"-- {a.filename}\n{a.content}" for a in artifacts if a.kind == kind)

    return ArtifactBundleOut(
        run_id=run_id, dbt_models=joined("dbt_model"), sql=joined("sql"),
        tests=joined("test"), docs=joined("doc"), configs=joined("config"),
    )


@router.get("/{run_id}/validation", response_model=ValidationReportOut)
async def get_validation(
    run_id: str, caller: Caller = Depends(current_caller), db: AsyncSession = Depends(get_db)
) -> ValidationReportOut:
    await _owned_run(db, run_id, caller)
    report = await db.scalar(select(ValidationReport).where(ValidationReport.run_id == run_id))
    if report is None:
        raise AppError(404, "report_not_ready", "QA hasn’t finished for this run yet.")
    return ValidationReportOut(
        run_id=run_id,
        checks=[ValidationCheckOut.model_validate(c) for c in report.checks],
        passed=report.passed,
        blocking=report.blocking,
    )


@router.post("/{run_id}/context/accept", status_code=202)
async def accept_context(
    run_id: str,
    caller: Caller = Depends(current_caller), db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await _claim(db, run_id, caller, "awaiting_context_approval", phase="generation", context_mode="grounded")
    return {"status": "resuming"}


@router.post("/{run_id}/context/start-fresh", status_code=202)
async def start_fresh(
    run_id: str,
    caller: Caller = Depends(current_caller), db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await _claim(db, run_id, caller, "awaiting_context_approval", phase="generation", context_mode="fresh")
    return {"status": "resuming"}


@router.post("/{run_id}/writeback/approve", status_code=202)
async def approve_writeback(
    run_id: str,
    caller: Caller = Depends(current_caller), db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await _owned_run(db, run_id, caller)
    report = await db.scalar(select(ValidationReport).where(ValidationReport.run_id == run_id))
    if report is not None and report.blocking:
        raise AppError(409, "qa_blocking", "QA found critical issues. Fix them or skip writeback.")
    await _claim(db, run_id, caller, "awaiting_writeback_approval", phase="writeback", writeback_mode="approved")
    return {"status": "resuming"}


@router.post("/{run_id}/writeback/skip", status_code=202)
async def skip_writeback(
    run_id: str,
    caller: Caller = Depends(current_caller), db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await _claim(db, run_id, caller, "awaiting_writeback_approval", phase="writeback", writeback_mode="skipped")
    return {"status": "resuming"}


async def _check_rate_limit(db: AsyncSession, caller: Caller) -> None:
    """Counts the caller's runs in the last hour; the LLM providers' free quotas are shared."""
    if caller.user_id is None:
        return
    limit = get_settings().RUNS_PER_HOUR
    since = datetime.now(UTC) - timedelta(hours=1)
    recent = await db.scalar(
        select(func.count()).select_from(Run).where(Run.created_by == caller.user_id, Run.created_at > since)
    )
    if recent >= limit:
        raise AppError(429, "rate_limited", f"You can start {limit} runs an hour. Try again a little later.")


async def _usage_by_agent(db: AsyncSession, run_id: str) -> dict[str, StepUsageOut]:
    rows = await db.execute(
        select(
            LlmCall.agent,
            func.count(),
            func.coalesce(func.sum(LlmCall.tokens_in), 0),
            func.coalesce(func.sum(LlmCall.tokens_out), 0),
            func.sum(LlmCall.latency_ms),
            func.count().filter(LlmCall.outcome != "ok"),
        )
        .where(LlmCall.run_id == run_id)
        .group_by(LlmCall.agent)
    )
    return {
        agent: StepUsageOut(calls=n, tokens_in=t_in, tokens_out=t_out, latency_ms=ms, failed_calls=failed)
        for agent, n, t_in, t_out, ms, failed in rows.all()
    }


async def _owned_run(db: AsyncSession, run_id: str, caller: Caller) -> Run:
    run = await db.scalar(select(Run).where(Run.id == run_id, Run.workspace_id == caller.workspace_id))
    if run is None:
        raise _not_found()
    return run


async def _claim(db: AsyncSession, run_id: str, caller: Caller, expected: str, **changes: str) -> None:
    """Moves a run out of a checkpoint and queues its next phase in one statement.

    Two concurrent clicks can't both win, and the job starts unlocked with a fresh attempt count.
    """
    result = await db.execute(
        update(Run)
        .where(Run.id == run_id, Run.workspace_id == caller.workspace_id, Run.status == expected)
        .values(status="running", locked_by=None, locked_until=None, attempts=0, **changes)
        .returning(Run.id)
    )
    if result.scalar_one_or_none() is not None:
        await db.commit()
        return
    current = await _owned_run(db, run_id, caller)
    raise AppError(
        409, "checkpoint_conflict",
        "This run has already moved past that step. Refresh to see where it is.",
        {"status": current.status, "expected": expected},
    )


def _not_found() -> AppError:
    return AppError(404, "run_not_found", "That run doesn’t exist.")

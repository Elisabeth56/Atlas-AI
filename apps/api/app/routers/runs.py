"""
REST routes under /api/runs — matches apps/web/lib/api.ts, extended
with the two human-in-the-loop checkpoints:

  POST /api/runs                         -> { run_id }
  GET  /api/runs/{id}                     -> RequestSummary
  GET  /api/runs/{id}/artifacts            -> ArtifactBundle
  GET  /api/runs/{id}/validation           -> ValidationReport
  POST /api/runs/{id}/context/accept       -> use DataHub's matched datasets as context
  POST /api/runs/{id}/context/start-fresh  -> proceed without grounding
  POST /api/runs/{id}/writeback/approve    -> write results back to DataHub
  POST /api/runs/{id}/writeback/skip       -> finish without writing back
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.errors import AppError
from app.models import Artifact, Run, ValidationReport
from app.orchestrator import resume_generation_phase, resume_writeback_phase, run_context_phase
from app.schemas import (
    ArtifactBundleOut,
    CreateRunIn,
    CreateRunOut,
    RunOut,
    ValidationCheckOut,
    ValidationReportOut,
)

logger = logging.getLogger("atlas.routers.runs")

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.post("", response_model=CreateRunOut, status_code=201)
async def create_run(
    body: CreateRunIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> CreateRunOut:
    run = Run(prompt=body.prompt, status="pending", workspace_id=get_settings().DEMO_WORKSPACE_ID)
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # BackgroundTasks runs *after* the response is sent. Passing an async
    # function here means FastAPI awaits it directly on the main event
    # loop (sync functions instead get punted to a worker thread via
    # anyio, which has no running event loop — asyncio.create_task() would
    # fail there, which is exactly the bug this comment used to paper
    # over). This only launches the context phase — it pauses itself at
    # the context checkpoint; the generation and writeback phases are
    # launched by the checkpoint endpoints below, never automatically.
    background_tasks.add_task(_run_and_log_errors, run_context_phase, run.id, body.prompt)

    return CreateRunOut(run_id=run.id)


async def _run_and_log_errors(phase_fn, *args, **kwargs) -> None:
    try:
        await phase_fn(*args, **kwargs)
    except Exception:
        logger.exception(
            "orchestrator phase %s crashed for args=%s", getattr(phase_fn, "__name__", phase_fn), args
        )


async def _claim(db: AsyncSession, run_id: str, expected: str, **changes: str) -> None:
    """Moves a run out of a checkpoint in one statement, so two concurrent clicks can't both win.

    Raises 404 if the run doesn't exist and 409 if it isn't at `expected` (including when a
    concurrent call claimed it first).
    """
    result = await db.execute(
        update(Run)
        .where(Run.id == run_id, Run.status == expected)
        .values(status="running", **changes)
        .returning(Run.id)
    )
    if result.scalar_one_or_none() is not None:
        await db.commit()
        return

    current = await db.get(Run, run_id)
    if current is None:
        raise AppError(404, "run_not_found", "That run doesn’t exist.")
    raise AppError(
        409, "checkpoint_conflict",
        "This run has already moved past that step. Refresh to see where it is.",
        {"status": current.status, "expected": expected},
    )


@router.post("/{run_id}/context/accept", status_code=202)
async def accept_context(
    run_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Human accepts DataHub's matched datasets as context. Resumes into
    the generation phase (Data Engineer -> QA -> Documentation)."""
    await _claim(db, run_id, "awaiting_context_approval", context_mode="grounded")
    background_tasks.add_task(_run_and_log_errors, resume_generation_phase, run_id)
    return {"status": "resuming"}


@router.post("/{run_id}/context/start-fresh", status_code=202)
async def start_fresh(
    run_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Human explicitly declines DataHub's matched context (or none was
    found) and proceeds without grounding. Still resumes the same
    generation phase — the distinction is recorded via context_mode, and
    (in real/Groq mode) changes what the Data Engineer's prompt contains."""
    await _claim(db, run_id, "awaiting_context_approval", context_mode="fresh")
    background_tasks.add_task(_run_and_log_errors, resume_generation_phase, run_id)
    return {"status": "resuming"}


@router.post("/{run_id}/writeback/approve", status_code=202)
async def approve_writeback(
    run_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Human approves writing generated documentation + lineage back to
    DataHub. Resumes into the writeback phase. Refused while QA has a critical finding."""
    report = await db.scalar(
        select(ValidationReport).where(ValidationReport.run_id == run_id)
    )
    if report is not None and report.blocking:
        raise AppError(409, "qa_blocking", "QA found critical issues. Fix them or skip writeback.")
    await _claim(db, run_id, "awaiting_writeback_approval", writeback_mode="approved")
    background_tasks.add_task(_run_and_log_errors, resume_writeback_phase, run_id)
    return {"status": "resuming"}


@router.post("/{run_id}/writeback/skip", status_code=202)
async def skip_writeback(
    run_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Human declines writing back to DataHub. The run still
    completes — generated artifacts already exist from the generation
    phase; only DataHub itself is left untouched."""
    await _claim(db, run_id, "awaiting_writeback_approval", writeback_mode="skipped")
    background_tasks.add_task(_run_and_log_errors, resume_writeback_phase, run_id)
    return {"status": "resuming"}


@router.get("/{run_id}", response_model=RunOut)
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)) -> Run:
    result = await db.execute(
        select(Run)
        .where(Run.id == run_id)
        .options(selectinload(Run.steps))
    )
    run = result.scalar_one_or_none()
    if run is None:
        raise AppError(404, "run_not_found", "That run doesn’t exist.")
    return run


@router.get("/{run_id}/artifacts", response_model=ArtifactBundleOut)
async def get_artifacts(run_id: str, db: AsyncSession = Depends(get_db)) -> ArtifactBundleOut:
    run = await db.get(Run, run_id)
    if run is None:
        raise AppError(404, "run_not_found", "That run doesn’t exist.")

    result = await db.execute(
        select(Artifact).where(Artifact.run_id == run_id).order_by(Artifact.created_at)
    )
    artifacts = result.scalars().all()

    def _join(kind: str) -> str:
        matching = [a for a in artifacts if a.kind == kind]
        return "\n\n".join(f"-- {a.filename}\n{a.content}" for a in matching)

    return ArtifactBundleOut(
        run_id=run_id,
        dbt_models=_join("dbt_model"),
        sql=_join("sql"),
        tests=_join("test"),
        docs=_join("doc"),
        configs=_join("config"),
    )


@router.get("/{run_id}/validation", response_model=ValidationReportOut)
async def get_validation(run_id: str, db: AsyncSession = Depends(get_db)) -> ValidationReportOut:
    run = await db.get(Run, run_id)
    if run is None:
        raise AppError(404, "run_not_found", "That run doesn’t exist.")

    result = await db.execute(
        select(ValidationReport).where(ValidationReport.run_id == run_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise AppError(404, "report_not_ready", "QA hasn’t finished for this run yet.")

    return ValidationReportOut(
        run_id=run_id,
        checks=[ValidationCheckOut.model_validate(c) for c in report.checks],
        passed=report.passed,
        blocking=report.blocking,
    )

"""
REST routes under /api/requests — matches frontend/lib/api.ts, extended
with the two human-in-the-loop checkpoints:

  POST /api/requests                         -> { request_id }
  GET  /api/requests/{id}                     -> RequestSummary
  GET  /api/requests/{id}/artifacts            -> ArtifactBundle
  GET  /api/requests/{id}/validation           -> ValidationReport
  POST /api/requests/{id}/context/accept       -> use DataHub's matched datasets as context
  POST /api/requests/{id}/context/start-fresh  -> proceed without grounding
  POST /api/requests/{id}/writeback/approve    -> write results back to DataHub
  POST /api/requests/{id}/writeback/skip       -> finish without writing back
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Artifact, Request, ValidationReport
from app.orchestrator import resume_generation_phase, resume_writeback_phase, run_context_phase
from app.schemas import (
    ArtifactBundleOut,
    CreateRequestIn,
    CreateRequestOut,
    RequestSummaryOut,
    ValidationCheckOut,
    ValidationReportOut,
)

logger = logging.getLogger("atlas.routers.requests")

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.post("", response_model=CreateRequestOut, status_code=201)
async def create_request(
    body: CreateRequestIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> CreateRequestOut:
    request = Request(prompt=body.prompt, status="pending")
    db.add(request)
    await db.commit()
    await db.refresh(request)

    # BackgroundTasks runs *after* the response is sent. Passing an async
    # function here means FastAPI awaits it directly on the main event
    # loop (sync functions instead get punted to a worker thread via
    # anyio, which has no running event loop — asyncio.create_task() would
    # fail there, which is exactly the bug this comment used to paper
    # over). This only launches the context phase — it pauses itself at
    # the context checkpoint; the generation and writeback phases are
    # launched by the checkpoint endpoints below, never automatically.
    background_tasks.add_task(_run_and_log_errors, run_context_phase, request.id, body.prompt)

    return CreateRequestOut(request_id=request.id)


async def _run_and_log_errors(phase_fn, *args, **kwargs) -> None:
    try:
        await phase_fn(*args, **kwargs)
    except Exception:
        logger.exception(
            "orchestrator phase %s crashed for args=%s", getattr(phase_fn, "__name__", phase_fn), args
        )


async def _claim(db: AsyncSession, request_id: str, expected: str, **changes: str) -> None:
    """Moves a run out of a checkpoint in one statement, so two concurrent clicks can't both win.

    Raises 404 if the run doesn't exist and 409 if it isn't at `expected` (including when a
    concurrent call claimed it first).
    """
    result = await db.execute(
        update(Request)
        .where(Request.id == request_id, Request.status == expected)
        .values(status="running", **changes)
        .returning(Request.id)
    )
    if result.scalar_one_or_none() is not None:
        await db.commit()
        return

    current = await db.get(Request, request_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Request not found")
    raise HTTPException(
        status_code=409,
        detail=f"Request is '{current.status}', expected '{expected}' for this action.",
    )


@router.post("/{request_id}/context/accept", status_code=202)
async def accept_context(
    request_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Human accepts DataHub's matched datasets as context. Resumes into
    the generation phase (Data Engineer -> QA -> Documentation)."""
    await _claim(db, request_id, "awaiting_context_approval", context_mode="grounded")
    background_tasks.add_task(_run_and_log_errors, resume_generation_phase, request_id)
    return {"status": "resuming"}


@router.post("/{request_id}/context/start-fresh", status_code=202)
async def start_fresh(
    request_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Human explicitly declines DataHub's matched context (or none was
    found) and proceeds without grounding. Still resumes the same
    generation phase — the distinction is recorded via context_mode, and
    (in real/Groq mode) changes what the Data Engineer's prompt contains."""
    await _claim(db, request_id, "awaiting_context_approval", context_mode="fresh")
    background_tasks.add_task(_run_and_log_errors, resume_generation_phase, request_id)
    return {"status": "resuming"}


@router.post("/{request_id}/writeback/approve", status_code=202)
async def approve_writeback(
    request_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Human approves writing generated documentation + lineage back to
    DataHub. Resumes into the writeback phase. Refused while QA has a critical finding."""
    report = await db.scalar(
        select(ValidationReport).where(ValidationReport.request_id == request_id)
    )
    if report is not None and report.blocking:
        raise HTTPException(
            status_code=409,
            detail="QA found critical issues. Fix them or skip writeback.",
        )
    await _claim(db, request_id, "awaiting_writeback_approval", writeback_mode="approved")
    background_tasks.add_task(_run_and_log_errors, resume_writeback_phase, request_id)
    return {"status": "resuming"}


@router.post("/{request_id}/writeback/skip", status_code=202)
async def skip_writeback(
    request_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Human declines writing back to DataHub. The request still
    completes — generated artifacts already exist from the generation
    phase; only DataHub itself is left untouched."""
    await _claim(db, request_id, "awaiting_writeback_approval", writeback_mode="skipped")
    background_tasks.add_task(_run_and_log_errors, resume_writeback_phase, request_id)
    return {"status": "resuming"}


@router.get("/{request_id}", response_model=RequestSummaryOut)
async def get_request(request_id: str, db: AsyncSession = Depends(get_db)) -> Request:
    result = await db.execute(
        select(Request)
        .where(Request.id == request_id)
        .options(selectinload(Request.agent_runs))
    )
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")
    return request


@router.get("/{request_id}/artifacts", response_model=ArtifactBundleOut)
async def get_artifacts(request_id: str, db: AsyncSession = Depends(get_db)) -> ArtifactBundleOut:
    request = await db.get(Request, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")

    result = await db.execute(
        select(Artifact).where(Artifact.request_id == request_id).order_by(Artifact.created_at)
    )
    artifacts = result.scalars().all()

    def _join(kind: str) -> str:
        matching = [a for a in artifacts if a.kind == kind]
        return "\n\n".join(f"-- {a.filename}\n{a.content}" for a in matching)

    return ArtifactBundleOut(
        request_id=request_id,
        dbt_models=_join("dbt_model"),
        sql=_join("sql"),
        tests=_join("test"),
        docs=_join("doc"),
        configs=_join("config"),
    )


@router.get("/{request_id}/validation", response_model=ValidationReportOut)
async def get_validation(request_id: str, db: AsyncSession = Depends(get_db)) -> ValidationReportOut:
    request = await db.get(Request, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")

    result = await db.execute(
        select(ValidationReport).where(ValidationReport.request_id == request_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(
            status_code=404,
            detail="Validation report not yet available — the QA stage hasn't completed.",
        )

    return ValidationReportOut(
        request_id=request_id,
        checks=[ValidationCheckOut.model_validate(c) for c in report.checks],
        passed=report.passed,
        blocking=report.blocking,
    )

"""Runs the phases that runs are owed (ADR 001).

A run with `phase` set is waiting for work. A worker claims the oldest one with
`FOR UPDATE SKIP LOCKED`, so two workers never take the same run, and holds a lease it
renews while the phase runs. If the process dies, renewals stop, the lease expires and
any worker picks the run up again; finished steps are skipped, so it resumes, not restarts.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import socket
from dataclasses import dataclass

from sqlalchemy import text

from app.database import session_scope
from app.orchestrator import PHASES

logger = logging.getLogger("atlas.worker")

LEASE_SECONDS = 60
RENEW_EVERY = 15
POLL_SECONDS = 1.0
MAX_ATTEMPTS = 3  # a phase that keeps killing its worker is failed instead of retried forever

WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"


@dataclass(frozen=True)
class Job:
    run_id: str
    phase: str
    attempts: int


async def claim(worker_id: str = WORKER_ID) -> Job | None:
    """Takes the oldest run that's owed work and isn't leased by a live worker."""
    async with session_scope() as db:
        row = (await db.execute(text("""
            update runs
               set locked_by = :worker, locked_until = now() + make_interval(secs => :lease),
                   attempts = attempts + 1
             where id = (
                   select id from runs
                    where phase is not null and (locked_until is null or locked_until < now())
                    order by created_at
                      for update skip locked
                    limit 1)
         returning id::text, phase, attempts
        """), {"worker": worker_id, "lease": LEASE_SECONDS})).first()
    return Job(*row) if row else None


async def execute(job: Job, worker_id: str = WORKER_ID) -> None:
    """Runs the claimed phase while renewing its lease, then releases the job."""
    if job.attempts > MAX_ATTEMPTS:
        logger.error("run %s: phase %s failed %s times, giving up", job.run_id, job.phase, MAX_ATTEMPTS)
        await _release(job, worker_id, status="failed")
        return

    renewer = asyncio.create_task(_renew(job, worker_id))
    status = None
    try:
        await PHASES[job.phase](job.run_id)
    except Exception:
        logger.exception("run %s: phase %s crashed", job.run_id, job.phase)
        status = "failed"
    finally:
        renewer.cancel()
    await _release(job, worker_id, status=status)


async def run_forever(stop: asyncio.Event, worker_id: str = WORKER_ID) -> None:
    logger.info("worker %s started", worker_id)
    while not stop.is_set():
        try:
            job = await claim(worker_id)
        except Exception:
            logger.exception("claim failed; retrying")
            job = None
        if job:
            await execute(job, worker_id)
            continue
        with contextlib.suppress(TimeoutError):  # idle: sleep until the next poll or shutdown
            await asyncio.wait_for(stop.wait(), timeout=POLL_SECONDS)


async def _renew(job: Job, worker_id: str) -> None:
    while True:
        await asyncio.sleep(RENEW_EVERY)
        async with session_scope() as db:
            await db.execute(
                text("update runs set locked_until = now() + make_interval(secs => :lease) "
                     "where id = :id and locked_by = :worker"),
                {"lease": LEASE_SECONDS, "id": job.run_id, "worker": worker_id},
            )


async def _release(job: Job, worker_id: str, *, status: str | None) -> None:
    """Clears the job. Matching on phase means a checkpoint that already queued the next phase is left alone."""
    async with session_scope() as db:
        await db.execute(
            text("""
                update runs
                   set phase = null, locked_by = null, locked_until = null,
                       status = coalesce(:status, status)
                 where id = :id and phase = :phase and locked_by = :worker
            """),
            {"status": status, "id": job.run_id, "phase": job.phase, "worker": worker_id},
        )

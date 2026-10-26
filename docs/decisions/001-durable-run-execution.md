# 001. Durable run execution with a Postgres job table

Status: accepted · 2026-10-26

## Context
A run is 4 LLM calls plus DataHub lookups and takes 2–4 minutes. Phases ran as FastAPI `BackgroundTasks` inside the API process. If the process died mid-phase, the run stayed `running` forever: nothing recorded that work was owed, so nothing could resume it. Checkpoint endpoints also checked status and changed it in separate steps, so a double-click started the same phase twice.

## Decision
- Runs are claimed from Postgres with a lease: `SELECT ... FOR UPDATE SKIP LOCKED`, then set `locked_by` and `locked_until`.
- A worker loop in the same container claims runs, executes the next phase, and renews the lease after each step.
- An expired lease means the worker died. Any worker reclaims the run and resumes from the last successful `run_steps` row.
- Checkpoint endpoints move status with one compare-and-set `UPDATE ... WHERE status = <expected> RETURNING id`. No row back means 409.
- A step is safe to re-run: its row is keyed by `(run_id, sequence)` and overwritten, never duplicated.

## Alternatives rejected
- **Keep BackgroundTasks and mark stuck runs failed on startup.** Hides the problem but never resumes work.
- **Redis queue (arq / RQ) with a separate worker service.** Adds Redis and a second deploy with no measured need. Postgres already holds the state.
- **Managed durable workflows (Inngest, Temporal).** Strong guarantees, but adds vendor lock-in and a learning cost that don't fit a 4-day remodel.

## Consequences
- No new infrastructure. Restarts and deploys no longer lose runs.
- Workers poll the database (every 2 s). That cost is negligible at this scale.

## At 10x (500 runs/day, ~10 concurrent)
One worker processes runs one at a time, so the queue backs up. Fix: run worker replicas. `SKIP LOCKED` already makes concurrent claiming safe. LLM rate limits break before the database does (see 004).

## Revisit when
Sustained queue wait goes past 1 minute, or runs need fan-out or scheduling that a job table handles badly.

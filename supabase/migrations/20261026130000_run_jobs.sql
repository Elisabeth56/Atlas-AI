-- Durable execution (ADR 001): a run with a non-null `phase` is owed work. A worker claims it with a
-- lease; if the worker dies the lease expires and another worker resumes from the last finished step.

alter table public.runs
  add column phase text check (phase in ('context', 'generation', 'writeback')),
  add column locked_by text,
  add column locked_until timestamptz,
  add column attempts smallint not null default 0;

-- the claim query scans only runs that are owed work, oldest first
create index runs_claimable_idx on public.runs (created_at) where phase is not null;

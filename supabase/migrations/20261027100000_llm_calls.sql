-- One row per HTTP call to an LLM provider, including the ones that failed over (ADR 004).
create table public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  agent text not null,
  provider text not null,
  model text not null,
  prompt_id text not null,
  tokens_in integer,
  tokens_out integer,
  latency_ms integer not null check (latency_ms >= 0),
  outcome text not null, -- ok | rate_limited | network_error | http_<status>
  created_at timestamptz not null default now()
);

create index llm_calls_run_idx on public.llm_calls (run_id, agent);

alter table public.llm_calls enable row level security;
create policy "members read llm calls" on public.llm_calls
  for select using (exists (select 1 from public.runs r where r.id = run_id and public.is_member(r.workspace_id)));

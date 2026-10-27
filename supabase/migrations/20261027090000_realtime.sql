-- Run progress reaches the browser as Postgres changes through Supabase Realtime (ADR 003).
-- RLS still applies: a subscriber only receives rows from runs in their own workspace.

-- the live log for each step; the worker appends a line per agent message
alter table public.run_steps add column logs jsonb not null default '[]'::jsonb;

-- plain Postgres (CI, docker compose) has no Realtime publication, so this is skipped there
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.runs, public.run_steps;
  end if;
end $$;

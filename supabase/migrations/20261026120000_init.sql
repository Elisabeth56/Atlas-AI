-- Atlas schema: a workspace owns runs; a run is six steps that produce artifacts and one QA report.
-- Clients read through RLS (members of the workspace only). The API writes with the service role,
-- which bypasses RLS, so there are no client insert/update policies.

create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
-- every RLS check asks "is this user in that workspace"
create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.datahub_connections (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  mode text not null default 'sample' check (mode in ('sample', 'mcp')),
  gms_url text,
  token_encrypted text, -- encrypted by the API before storage; no client policy reads this table
  updated_at timestamptz not null default now(),
  check (mode = 'sample' or gms_url is not null)
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  prompt text not null check (length(prompt) between 1 and 4000),
  status text not null default 'pending' check (status in (
    'pending', 'running', 'awaiting_context_approval', 'awaiting_writeback_approval', 'complete', 'failed'
  )),
  context_mode text check (context_mode in ('grounded', 'fresh')),
  writeback_mode text check (writeback_mode in ('approved', 'skipped')),
  trace_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- run history: newest first within a workspace
create index runs_workspace_created_idx on public.runs (workspace_id, created_at desc);

create table public.run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  sequence smallint not null check (sequence between 0 and 5),
  agent text not null check (agent in (
    'planner', 'metadata_analyst', 'data_engineer', 'qa', 'documentation', 'writeback'
  )),
  status text not null default 'pending' check (status in ('pending', 'started', 'success', 'failed')),
  input jsonb,
  output jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  -- one row per stage: a retried stage overwrites its row instead of adding one
  unique (run_id, sequence)
);

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  source_agent text not null,
  kind text not null check (kind in ('dbt_model', 'sql', 'test', 'doc', 'config')),
  filename text not null,
  content text not null,
  created_at timestamptz not null default now()
);
create index artifacts_run_idx on public.artifacts (run_id);

create table public.validation_reports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.runs (id) on delete cascade,
  checks jsonb not null,
  passed boolean not null,
  blocking boolean not null default false,
  created_at timestamptz not null default now()
);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger runs_touch_updated_at before update on public.runs
for each row execute function public.touch_updated_at();

-- security definer so policies can check membership without exposing workspace_members rows
create function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = ws and user_id = auth.uid())
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.datahub_connections enable row level security;
alter table public.runs enable row level security;
alter table public.run_steps enable row level security;
alter table public.artifacts enable row level security;
alter table public.validation_reports enable row level security;

create policy "members read their workspace" on public.workspaces
  for select using (public.is_member(id));
create policy "users read their own memberships" on public.workspace_members
  for select using (user_id = auth.uid());
create policy "members read runs" on public.runs
  for select using (public.is_member(workspace_id));
create policy "members read run steps" on public.run_steps
  for select using (exists (select 1 from public.runs r where r.id = run_id and public.is_member(r.workspace_id)));
create policy "members read artifacts" on public.artifacts
  for select using (exists (select 1 from public.runs r where r.id = run_id and public.is_member(r.workspace_id)));
create policy "members read validation reports" on public.validation_reports
  for select using (exists (select 1 from public.runs r where r.id = run_id and public.is_member(r.workspace_id)));
-- datahub_connections: deliberately no client policy (it holds the encrypted token)

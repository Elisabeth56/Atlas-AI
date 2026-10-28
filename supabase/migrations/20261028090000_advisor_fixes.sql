-- Fixes from the Supabase database advisor on the first hosted deploy.

-- a trigger function should not resolve names through whatever search_path the caller has
alter function public.touch_updated_at() set search_path = public;

-- is_member no longer needs definer rights: the membership policy already lets a user read their own rows.
-- As invoker it can't be used through /rest/v1/rpc to probe other users' memberships.
create or replace function public.is_member(ws uuid) returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = ws and user_id = (select auth.uid()))
$$;

-- (select auth.uid()) is evaluated once per query instead of once per row
drop policy "users read their own memberships" on public.workspace_members;
create policy "users read their own memberships" on public.workspace_members
  for select using (user_id = (select auth.uid()));

-- deleting a user nulls runs.created_by; without an index that's a full scan of runs
create index runs_created_by_idx on public.runs (created_by);

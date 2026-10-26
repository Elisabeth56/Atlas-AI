-- Demo data: the shared demo workspace, wired to the sample catalog.
insert into public.workspaces (id, name)
values ('00000000-0000-0000-0000-0000000000d0', 'Demo workspace')
on conflict (id) do nothing;

insert into public.datahub_connections (workspace_id, mode)
values ('00000000-0000-0000-0000-0000000000d0', 'sample')
on conflict (workspace_id) do nothing;

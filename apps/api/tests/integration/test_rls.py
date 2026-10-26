"""Row level security: a signed-in user reads their own workspace's runs and nothing else."""
from __future__ import annotations

from app.database import get_engine

ALICE = "00000000-0000-0000-0000-00000000a11c"
BOB = "00000000-0000-0000-0000-0000000000b0"
ALICE_WS = "00000000-0000-0000-0000-0000000000a1"
BOB_WS = "00000000-0000-0000-0000-0000000000b1"

SETUP = f"""
insert into auth.users (id) values ('{ALICE}'), ('{BOB}');
insert into public.workspaces (id, name) values ('{ALICE_WS}', 'alice'), ('{BOB_WS}', 'bob');
insert into public.workspace_members (workspace_id, user_id) values ('{ALICE_WS}', '{ALICE}'), ('{BOB_WS}', '{BOB}');
insert into public.runs (workspace_id, prompt) values ('{ALICE_WS}', 'alice run'), ('{BOB_WS}', 'bob run');
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
"""


async def _visible_prompts(user: str) -> list[str]:
    async with get_engine().connect() as conn:
        raw = (await conn.get_raw_connection()).driver_connection
        async with raw.transaction():
            await raw.execute("set local role authenticated")
            await raw.execute(f"set local request.jwt.claim.sub = '{user}'")
            rows = await raw.fetch("select prompt from public.runs order by prompt")
        return [r["prompt"] for r in rows]


async def test_members_only_see_their_workspace(db_ready):
    async with get_engine().connect() as conn:
        raw = (await conn.get_raw_connection()).driver_connection
        await raw.execute(SETUP)

    assert await _visible_prompts(ALICE) == ["alice run"]
    assert await _visible_prompts(BOB) == ["bob run"]


async def test_anonymous_sees_nothing(db_ready):
    async with get_engine().connect() as conn:
        raw = (await conn.get_raw_connection()).driver_connection
        await raw.execute(SETUP)

    assert await _visible_prompts("") == []

# 002. Supabase for Postgres, auth and workspace-scoped access

Status: accepted · 2026-10-26

## Context
The data is relational: workspaces have members, runs have steps, and steps produce artifacts and a validation report. The parts shaped like documents (agent outputs, QA checks) fit in JSONB. The old schema had no users, ran `create_all` instead of migrations, and left a Groq-spending endpoint open to anyone.

## Decision
- Supabase Postgres with SQL migrations in `supabase/migrations`.
- Supabase Auth. FastAPI verifies the Supabase JWT in one `current_user` dependency.
- Tables: `workspaces`, `workspace_members(workspace_id, user_id, role)`, `datahub_connections`, `runs`, `run_steps`, `artifacts`, `validation_reports`, `llm_calls`.
- Row Level Security scopes every client-readable table through workspace membership.
- Seed data includes a demo account and a sample workspace.

## Alternatives rejected
- **Neon with Clerk.** Polished auth UI, but two vendors, and access rules would live in app code instead of next to the data.
- **MongoDB.** Reads cross the relations (a run's steps, a workspace's runs), and JSONB already covers the flexible parts.
- **Self-managed Postgres in Docker.** Leaves backups, auth and hosting to us.

## Consequences
- Auth, RLS and Realtime (003) come from one service with one set of credentials.
- Free projects pause after a period of inactivity. The demo needs to wake it, or live with a slow first load.
- The backend uses the service-role key for worker writes. That key never reaches the browser.

## At 10x
Storage reaches about 10 GB a year, past the free tier's 500 MB, at roughly 50 KB of artifacts per run. Fix: the paid tier, or moving artifact content to Supabase Storage with references kept in rows.

## Revisit when
Artifact storage passes about 300 MB, or a customer needs data residency that Supabase regions can't meet.

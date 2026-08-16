# Atlas AI

Atlas AI turns a natural-language request — *"build a customer revenue
pipeline from raw Stripe and Postgres events"* — into production-ready
data engineering artifacts: dbt models, SQL, tests, and documentation.
It's grounded in your organization's actual metadata (via DataHub), asks
for your explicit approval before generating anything and before writing
anything back, and works through a six-agent pipeline you can watch run
live.

```
Prompt → Planner → Metadata Analyst → [ pause: review context ] →
Data Engineer → QA → Documentation → [ pause: approve writeback ] →
Writeback → done
```

Nothing generates without you seeing what Atlas found in DataHub first.
Nothing writes back to DataHub without your explicit approval. Either
checkpoint can be skipped in favor of "start fresh" / "skip write-back" —
this isn't a rigid gate, it's informed consent at the two points that
actually matter.

## See it working

**Demo video (2:45):** https://youtu.be/K9MFoQhIqpo

**DataHub MCP integration, verified against a live instance:**

`scripts/inspect_mcp_tools.py` connects `mcp-server-datahub` to a local
DataHub (`datahub docker quickstart`) and prints every tool's real input
schema — the same tools `app/datahub/mcp_gateway.py` calls into:

![mcp tool schemas](docs/screenshots/mcp-tool-schemas.png)

A live `search` call through MCP returns real DataHub results, confirming
the gateway's call shapes match the server's actual contract:

![mcp live search](docs/screenshots/mcp-live-search.png)

DataHub UI at `localhost:9002` after `datahub docker quickstart`, which
`mcp-server-datahub` and Atlas both talk to:

![datahub ui](docs/screenshots/datahub-ui.png)

> The deployed Vercel URL runs the pipeline as a client-side simulation
> against the same fixture data the backend uses in `DEMO_MODE`, so it
> works reliably without an always-on backend host. The full Groq +
> DataHub MCP path shown above runs with `docker compose up --build`
> locally — setup below.
---

## Table of contents

- [Architecture](#architecture)
- [DataHub integration](#datahub-integration)
- [Folder structure](#folder-structure)
- [Tech stack](#tech-stack)
- [Domain models](#domain-models)
- [API reference](#api-reference)
- [Execution flow](#execution-flow)
- [Local setup](#local-setup)
- [Deployment](#deployment)
- [Testing](#testing)
- [Examples](#examples)
- [Security notes](#security-notes)
- [Known limitations & future work](#known-limitations--future-work)
- [License](#license)

---

## Architecture

Modular monolith: one FastAPI backend, one Postgres database, in-process
async orchestration, WebSocket streaming from the same process, one
Next.js frontend. Every external integration sits behind an abstract
interface (`LLMProvider`, `DataHubGateway`) so pieces can be extracted
into independent services later without touching agent logic — but
nothing is over-built for a scale this project doesn't need yet.

```
┌──────────────┐   POST /api/requests    ┌───────────────────┐
│   Next.js     │────────────────────────▶│     FastAPI        │
│   frontend    │                          │   (routers/)        │
│               │◀── WS /stream ──────────│                     │
└──────────────┘                          └─────────┬───────────┘
                                                       │ background task
                                                       ▼
                                            ┌─────────────────────┐
                                            │    Orchestrator       │
                                            │  (3 resumable phases) │
                                            └─────────┬─────────────┘
        ┌───────────────────────────────────────────┼───────────────────────────────────────┐
        ▼                    ▼                       │                                       ▼
   Planner          Metadata Analyst         [ PAUSE: context ]                          Writeback
        │                    │                       │                                       │
        └──────────┬─────────┘              user: accept / start fresh              [ PAUSE: writeback ]
                    ▼                                 │                                       │
              LLMProvider                    Data Engineer → QA → Documentation      user: approve / skip
             (Groq / Mock)                             │
                                                        ▼
                                                DataHubGateway
                                          (MCP / direct REST / Mock)
```

**Why plain async/await, not a graph framework:** the pipeline is three
fixed, non-cyclic phases. LangGraph or similar would add indirection
without buying anything here. If a future agent needs to loop back (QA
rejecting and re-triggering Data Engineer, say), that's the point to
revisit this decision — the `Agent` interface doesn't need to change for
that.

**Why a modular monolith, not microservices:** every agent, the
orchestrator, and the API all run in one process on purpose. The
interfaces (`Agent`, `LLMProvider`, `DataHubGateway`) are the extraction
seams for later — nothing here assumes it'll stay this way forever, but
building distributed infrastructure before there's a reason to needs
justifying, and there isn't one yet.

---

## DataHub integration

DataHub is the grounding layer, not a bolted-on feature. Every generated
column name traces back to a real schema DataHub returned; every write is
something DataHub actually stores; the human-in-the-loop checkpoints
exist specifically so a user can see that grounding before Atlas acts on
it, not just trust that it happened.

```
Atlas AI Agent
      │
 MCP tool calls
      │
      ▼
DataHub MCP Server  (search · schema · lineage · profile · mutations)
      │
      ▼
Your DataHub instance — which one depends on workspace mode:

  demo mode  →  a pre-seeded demo DataHub instance
  existing   →  your own DataHub, via DATAHUB_GMS_URL + DATAHUB_TOKEN
  fresh      →  same mechanism as "existing" — point at an instance
                you've started with nothing ingested yet
```

**Every DataHub read and write goes through MCP tool calls** to
`mcp-server-datahub` — search, schema, lineage reads, and description
writes all map onto real MCP tools. The one exception: `mcp-server-datahub`
has no lineage-*writing* tool as of its current tool list (lineage reads
are supported, writes aren't), so `WritebackAgent`'s lineage-edge emission
falls back to a direct GraphQL call for that one operation specifically —
documented in `app/datahub/mcp_gateway.py`. Everything else is MCP.

A direct-REST gateway (`app/datahub/datahub_gateway.py`) and a
zero-dependency mock gateway (`app/datahub/mock_gateway.py`) both still
exist behind the same `DataHubGateway` interface — `direct` mode as a
fallback if MCP isn't available, `mock` automatically whenever no
`DATAHUB_GMS_URL` is configured at all, so the pipeline stays fully
demoable without any external DataHub dependency.

**Current scope: single-tenant.** `DATAHUB_GMS_URL`/`DATAHUB_TOKEN` are
backend-level configuration — one DataHub connection, shared across every
request. That's a deliberate hackathon-scoped simplification, not an
architectural ceiling: today it's assumed to be *this* project's DataHub
instance, configured once by whoever runs the backend. In production,
different users/orgs would bring their own DataHub instance, which means
moving connection details from environment variables into per-user/
per-workspace storage — a `workspaces` table holding each user's
`gms_url` + encrypted token, `DataHubMCPGateway` instantiated per-workspace
rather than as a single global singleton (see `orchestrator.py`'s
`init_datahub_mcp_gateway`), and a connection UI on the frontend (the
"existing" vs. "fresh" distinction in workspace mode is exactly where that
UI would live — see `DATAHUB_WORKSPACE_MODE` above, currently a labeling
concept with no onboarding flow built around it yet).

See `backend/scripts/inspect_mcp_tools.py` — run it once your DataHub +
MCP setup is live to print every real tool's input schema and verify it
against what `mcp_gateway.py` actually calls.

---

## Folder structure

```
Atlas AI/
├── docker-compose.yml
├── LICENSE
├── README.md                    ← you are here
├── examples/                    ← real generated pipeline output,see below
├── backend/
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── .env.example
│   ├── scripts/
│   │   └── inspect_mcp_tools.py
│   ├── app/
│   │   ├── main.py                # FastAPI app, lifespan, CORS
│   │   ├── config.py               # Settings — LLM mode, DataHub mode, DB, CORS
│   │   ├── database.py              # Async SQLAlchemy engine/session
│   │   ├── models.py                 # Request, AgentRun, Artifact, ValidationReport
│   │   ├── schemas.py                 # Pydantic wire contracts (mirrors frontend/lib/types.ts)
│   │   ├── ws_hub.py                   # Room-based WebSocket broadcaster
│   │   ├── orchestrator.py              # 3-phase pipeline runner, 2 checkpoints
│   │   ├── agents/                       # Planner, Metadata Analyst, Data Engineer,
│   │   │                                    QA, Documentation, Writeback
│   │   ├── llm/                           # LLMProvider: Groq (real) + Mock
│   │   └── datahub/                        # DataHubGateway: MCP (real) + direct REST + Mock
│   └── tests/
│       ├── unit/                            # QA agent's deterministic checks
│       └── contract/                         # fixture ⟷ schema validation, pipeline order
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── app/
    │   ├── new/page.tsx                       # real prompt input → live run
    │   ├── demo/page.tsx                        # one-tap canned scenario
    │   ├── dashboard/page.tsx
    │   └── agents/[runId]/page.tsx               # live run view, renders checkpoint panels
    ├── components/
    │   └── agents/
    │       ├── ContextReviewPanel.tsx              # context checkpoint UI
    │       └── WritebackApprovalPanel.tsx           # writeback checkpoint UI
    ├── hooks/useRunStream.ts                          # WS client, drives the live run view
    └── lib/
        ├── types.ts                                    # mirrors backend/app/schemas.py
        └── api.ts                                        # REST client
```

---

## Tech stack

**Backend:** Python, FastAPI, PostgreSQL (asyncpg + SQLAlchemy 2.x
async), Groq (OpenAI-compatible LLM API), DataHub OSS via MCP
(`mcp-server-datahub`) with direct-REST and mock fallbacks, `sqlparse`
for deterministic SQL linting.

**Frontend:** Next.js 16, React 19, TypeScript, Tailwind v4, Motion,
Recharts, React Hook Form + Zod.

**Infra:** Docker Compose (Postgres + backend + frontend).

---

## Domain models

| Table | Purpose | Key columns |
|---|---|---|
| `requests` | One row per submitted prompt | `id`, `prompt`, `status`, `trace_id`, `context_mode`, `writeback_mode`, `created_at` |
| `agent_runs` | One row per pipeline stage per request | `id`, `request_id`, `sequence`, `agent_name`, `status`, `started_at`, `finished_at`, `input_json`, `output_json`, `error` |
| `artifacts` | One row per generated file | `id`, `request_id`, `kind`, `filename`, `content` |
| `validation_reports` | One row per request (QA output) | `id`, `request_id`, `checks` (JSONB), `passed` |

`requests.status` is one of `pending | running | awaiting_context_approval
| awaiting_writeback_approval | complete | failed` — the two `awaiting_*`
states are genuine pauses, not UI labels; the orchestrator stops
executing and returns after persisting each one.

---

## API reference

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/requests` | Create a request, launches the context phase only |
| `GET` | `/api/requests/{id}` | Full status + all agent runs |
| `GET` | `/api/requests/{id}/artifacts` | Generated files, flattened by kind |
| `GET` | `/api/requests/{id}/validation` | QA's validation report |
| `POST` | `/api/requests/{id}/context/accept` | Use DataHub's matched datasets as context |
| `POST` | `/api/requests/{id}/context/start-fresh` | Proceed without grounding |
| `POST` | `/api/requests/{id}/writeback/approve` | Write results back to DataHub |
| `POST` | `/api/requests/{id}/writeback/skip` | Finish without writing back |
| `WS` | `/api/requests/{id}/stream` | Live agent events, incl. checkpoint pause signals |
| `GET` | `/health` | Service status, active LLM/DataHub modes |

---

## Execution flow

1. `POST /api/requests` creates a `Request` row and launches **only** the
   context phase (Planner → Metadata Analyst) as a background task.
2. The phase pauses itself — always, even if DataHub matched nothing —
   and the request sits at `awaiting_context_approval` until the frontend
   calls `context/accept` or `context/start-fresh`.
3. That call launches the generation phase (Data Engineer → QA →
   Documentation), which reconstructs its context from what's already
   persisted in `agent_runs.output_json` — nothing is held in memory
   across the pause, since nothing guarantees the same process resumes it.
4. Generation pauses again at `awaiting_writeback_approval` with a
   preview of exactly what would be written to DataHub.
5. `writeback/approve` runs the Writeback agent for real; `writeback/skip`
   marks the request complete without touching DataHub — generated
   artifacts exist either way, only DataHub itself is gated.

---

## Local setup

### Docker (recommended — one command)

```bash
docker compose up --build
```
Backend on `:8000`, frontend on `:3000`, Postgres on `:5432`. Runs in
demo mode by default — no Groq key or DataHub instance required to see
the full flow work end-to-end.

### Manual

```bash
# Postgres
createdb atlas

# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Open `http://localhost:3000/new`, submit a prompt, watch it pause for
your input twice.

### Going beyond demo mode

- **Groq:** set `GROQ_API_KEY` in `backend/.env` — get one at
  console.groq.com/keys.
- **DataHub:** set `DATAHUB_GMS_URL` (and `DATAHUB_TOKEN` if your instance
  has auth enabled), then `pip install mcp-server-datahub` so
  `mcp_gateway.py` has something to spawn. Run
  `python scripts/inspect_mcp_tools.py` once it's live to verify the tool
  contracts before trusting them.

Both are independent — a real Groq key with no DataHub instance still
works, and vice versa.

---

## Deployment

Two realistic paths for a hackathon submission. Pick based on time
remaining.

### Option A — single VM, Docker Compose (fastest to get a real URL)

The whole stack (Postgres + backend + frontend) already runs via
`docker-compose.yml` — the least new surface area is putting that exact
setup on one cloud VM rather than juggling three separate hosting
accounts.

1. Spin up a VM (DigitalOcean Droplet, AWS EC2, GCP Compute Engine — 4GB+
   RAM, more if you're also running DataHub on the same box).
2. Install Docker, clone the repo, `docker compose up --build -d`.
3. Put a reverse proxy in front for HTTPS + a real domain — **Caddy** is
   the least-config option:
   ```bash
   # Caddyfile
   your-domain.com {
       reverse_proxy /api/* localhost:8000
       reverse_proxy /* localhost:3000
   }
   ```
   Caddy handles Let's Encrypt certs automatically.
4. Update `NEXT_PUBLIC_API_URL` in `docker-compose.yml`'s frontend
   `build.args` to your real domain (it must be a **build** arg, not a
   runtime env var — Next.js inlines `NEXT_PUBLIC_*` values into the
   client bundle at build time) and rebuild.
5. Set real `GROQ_API_KEY` / `DATAHUB_GMS_URL` as environment variables on
   the VM before `docker compose up`.

### Option B — split hosting (more moving parts, each piece scales independently)

- **Frontend → Vercel.** Natural fit for Next.js — connect the repo,
  set `NEXT_PUBLIC_API_URL` to your deployed backend's URL as a build-time
  environment variable in Vercel's project settings.
- **Backend → Railway / Render / Fly.io.** Needs a host that supports
  long-running processes and WebSockets — not a serverless/edge platform,
  since the orchestrator's background tasks and the WS stream both need a
  persistent process. All three support Docker deploys directly from the
  `backend/Dockerfile`.
- **Postgres → the same platform's managed Postgres**, or Supabase/Neon.
  Update `DATABASE_URL` accordingly.
- **CORS:** set `CORS_ORIGINS` on the backend to your actual Vercel
  domain, not `localhost:3000`.
- **DataHub:** same cloud-VM approach as discussed for local RAM
  constraints — a dedicated small VM running `datahub docker quickstart`,
  `DATAHUB_GMS_URL` pointed at its public IP (secure the port — see
  Security notes below).

---

## Testing

```bash
cd backend
source .venv/bin/activate
python -m pytest tests/unit tests/contract -v
```

No Postgres or external services needed for these — pure logic and
schema tests. `tests/unit/test_qa_agent.py` covers the QA agent's
deterministic checks (SQL lint, PII detection, not-null coverage) against
fake context, no LLM involved. `tests/contract/test_agent_schemas.py`
validates every demo fixture round-trips through its Pydantic schema
exactly like `MockLLMProvider` does at runtime, and asserts the pipeline
order matches what the frontend expects.

---

## Examples

`backend/examples/` contains real pipeline output — generated directly
from the same fixture objects `MockLLMProvider` returns at runtime, not
hand-written to look good. See `backend/examples/README.md` for what
each file is and why the QA report in there shows a genuine failure
(unmasked PII), not a cherry-picked clean run.

---

## Known limitations & future work

- **Single-tenant DataHub connection.** One `DATAHUB_GMS_URL`/`DATAHUB_TOKEN`
  configured backend-wide, shared across every request — assumed to be
  the project's own DataHub instance. Multi-tenant support (each user/org
  bringing their own DataHub) would need per-workspace connection storage
  and a per-workspace `DataHubMCPGateway` instance instead of the current
  singleton, plus a connection-setup UI — see the DataHub integration
  section above for where that fits into the existing workspace-mode
  concept.
- `mcp_gateway.py`'s tool call shapes are built from documentation, not
  verified against a live `mcp-server-datahub` instance — run
  `scripts/inspect_mcp_tools.py` first thing once yours is up.
- No MCP mutation tool exists for lineage writes — `emit_lineage()` falls
  back to direct GraphQL for that one operation.
- `DATAHUB_WORKSPACE_MODE=fresh` doesn't auto-provision a new DataHub
  instance — it's a labeling distinction from `existing`, both connect to
  whatever `DATAHUB_GMS_URL` points at.
- Only the QA agent has unit tests; Planner, Metadata Analyst, Data
  Engineer, Documentation, and Writeback don't yet.
- No Alembic migrations — `Base.metadata.create_all()` on startup, fine
  for a hackathon, not for a real deploy with existing data.
- Demo-mode content is fixture-based (`MockLLMProvider` ignores prompt
  content), so "start fresh" vs. "grounded" context only changes actual
  generated output in real (Groq) mode, not demo mode — documented in
  `orchestrator.py`.

---

## License

Apache License 2.0 — see [`LICENSE`](./LICENSE).
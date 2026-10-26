# 003. Run progress streams through Supabase Realtime

Status: accepted · 2026-10-26

## Context
The old WebSocket hub kept a dict of sockets in one process. Events were lost on restart, only one instance could serve them, and the browser could drift from the database because the stream and the REST endpoints were separate sources.

## Decision
- The browser subscribes to Postgres changes on `runs` and `run_steps` for one `run_id` through Supabase Realtime.
- The worker writes rows. Each change to a row is the event. There is no separate broadcast path.
- On reconnect, the client fetches the current rows once, then resumes the subscription.
- `ws_hub.py` and `routers/ws.py` are deleted.

## Alternatives rejected
- **Keep the FastAPI WebSocket.** Single-instance only, and events are lost on restart.
- **Server-Sent Events from FastAPI.** A simpler protocol with the same single-instance and restart problems.

## Consequences
- The UI can't show a state the database doesn't hold.
- The backend no longer needs to keep connections open, which widens the hosting options (007).
- RLS must allow members to read their own workspace's runs, or subscriptions get nothing back.

## At 10x
The free tier allows about 200 concurrent Realtime connections. Each viewer of a live run uses one, so a portfolio audience stays well under the limit.

## Revisit when
Events are needed that don't map to a row change, such as token-by-token streaming. That needs SSE from the worker.

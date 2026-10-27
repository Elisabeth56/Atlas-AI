# 007. Backend hosting: Render

Status: accepted · 2026-10-27 (revised; the first version chose an Oracle Cloud VM)

## Context
The backend runs a worker loop (001) that claims runs and drives the agents for minutes at a time, and it can hold a long-lived MCP subprocess. Serverless hosts like Vercel only run code while answering a request and cap how long it can run, so the worker would never run there. The API needs a host that keeps a process running.

## Decision
- **Render web service**, built from `apps/api/Dockerfile` by Render itself (`render.yaml`), in Frankfurt.
- Plan: **Free**. It sleeps after 15 minutes without traffic and takes about a minute to wake. Starter (about $7/month) keeps it always on and is a one-word change in `render.yaml`.
- A GitHub workflow applies Supabase migrations first, then calls Render's deploy hook, waits for `/health` to report the new commit, and runs a smoke run.
- The frontend stays on Vercel; the database, auth and Realtime stay on Supabase (002, 003).

## Alternatives rejected
- **Oracle Cloud Always Free VM** (the first choice). Free and always on, but it makes the owner the system administrator (OS updates, Docker, firewall, TLS), Oracle cut the free Arm allowance in June 2026, and it may reclaim instances that stay under 20% CPU for a week, which an idle portfolio API would be.
- **Vercel for the API.** Serverless can't host the worker loop or runs that take minutes.
- **Railway / Fly.io.** Similar cost to Render Starter, without a reason to prefer them.

## Consequences
- No server to maintain: Render builds, runs, restarts and serves TLS.
- The first visit after a quiet spell waits about a minute while the service wakes. The landing page pings `/health` on load to start that early, the run view shows "waking the engine", and a run interrupted by a sleep resumes from its last step when the service wakes (001's lease).
- Moving hosts is cheap: it's one Docker image with configuration in environment variables.

## At 10x
One instance (512 MB on Free or Starter) handles a few concurrent runs, since they mostly wait on model calls. Model provider rate limits break before the instance does (004). Past that, a bigger instance or a second one: `FOR UPDATE SKIP LOCKED` already makes several workers safe.

## Revisit when
Visitors regularly hit the wake-up wait (switch to Starter), or runs need more memory than the instance has.

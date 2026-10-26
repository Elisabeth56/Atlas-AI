# 007. Backend hosting: Oracle Always Free VM, with Render free as the fallback

Status: accepted · 2026-10-26

## Context
The backend runs a worker loop (001) and a long-lived MCP subprocess, so serverless hosts don't fit. As of late 2026, no free host is always on without a catch. Hugging Face Docker Spaces need a paid plan for new accounts. Fly.io has no free tier. Railway's free credit covers about 100 MB of RAM.

## Decision
- **Primary:** an Oracle Cloud Always Free Ampere A1 VM (2 OCPU, 12 GB RAM, always on), running the backend image with Docker Compose behind Caddy for TLS.
- **Fallback:** Render's free web service, if Oracle signup or A1 capacity fails. It's the same image.
- The frontend stays on Vercel and points at the backend over HTTPS.

## Alternatives rejected
- **Railway Hobby (about $5/month).** The simplest reliable option, but not free.
- **Hugging Face Spaces.** Free Docker Spaces aren't available to new accounts.
- **Fly.io.** Trial only.

## Consequences
- Oracle means VM upkeep: OS updates, Docker, TLS renewal (Caddy automates TLS). Signup needs a phone number and a card for verification.
- On Render, the instance sleeps after 15 minutes idle and takes about a minute to wake. The landing page sends a warm-up request, and the UI shows a "starting" state. A sleep that interrupts a run is recovered by the job lease (001).
- The 12 GB on the Oracle VM leaves room to self-host DataHub later (006).

## At 10x
One VM with 2 OCPU handles several concurrent runs, because the work waits on LLM calls rather than using CPU. Provider rate limits break first (004).

## Revisit when
Oracle reclaims the instance or capacity is unavailable, or uptime matters enough to pay for Railway or Fly.

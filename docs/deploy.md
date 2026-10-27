# Deploying Atlas

The web app runs on Vercel. The API, including its worker, runs on an Oracle Cloud Always Free VM behind Caddy. The database, auth and Realtime are Supabase. ADR 007 explains the choice; Render's free tier is the fallback.

## 1. Supabase

1. Create a project (free tier). Under Authentication → Providers, enable **Anonymous sign-ins**; the demo signs every visitor in anonymously, with a private workspace.
2. Apply the schema: `supabase link --project-ref <ref>` then `supabase db push`. This runs `supabase/migrations/*`, which create the tables, the RLS policies and the Realtime publication. Load `supabase/seed.sql` once for the sample catalog connection.
3. Note the project URL, the anon key and the **session pooler** connection string (Project Settings → Database). The session pooler is IPv4 and keeps prepared statements, which asyncpg needs.

## 2. The VM (Oracle Always Free)

1. Create an Ampere A1 instance (Ubuntu, 2 OCPU / 12 GB is within the free allowance). In the VCN's security list, open ports 80 and 443. On the instance, also open them in iptables, since Oracle's Ubuntu image blocks them by default:
   `sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT && sudo netfilter-persistent save`
2. Install Docker: `curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER`.
3. Point a DNS A record (for example `api.your-domain`) at the instance's public IP.
4. `mkdir ~/atlas`, copy `deploy/.env.example` to `~/atlas/.env` and fill it in.
5. The deploy workflow copies `docker-compose.yml` and the `Caddyfile` and starts them. The first start gets a TLS certificate.

If Oracle signup or A1 capacity fails, use **Render**: create a Blueprint from `render.yaml` and set the secret values in the dashboard. It runs the same image.

## 3. GitHub

Repository **variables**: `DEPLOY_ENABLED=true`, `API_URL` (`https://api.your-domain`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
Repository **secrets**: `VM_HOST`, `VM_USER`, `VM_SSH_KEY` (a key the VM accepts), `SUPABASE_DB_URL` (direct connection string, for migrations).

Each push to `main` that touches the API:
- builds the image for arm64 and amd64 and pushes it to GHCR;
- applies migrations;
- rolls it out on the VM;
- waits for `/health`;
- runs `scripts/smoke.py`, which signs in anonymously, starts a run and waits for the sources checkpoint.

The GHCR package must be public, or the VM needs `docker login ghcr.io`.

## 4. Vercel

Project root directory: `apps/web`. Environment variables, for Production and Preview:
- `NEXT_PUBLIC_API_URL` = the API URL
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

In Supabase Auth → URL Configuration, add the Vercel production URL and `https://*-elisabeth-nnamanis-projects.vercel.app/**` as redirect URLs.

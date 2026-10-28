# Deploying Atlas

Three services, each doing what it's good at:
- **Vercel** serves the web app;
- **Render** runs the API and its worker, which has to stay running (ADR 007);
- **Supabase** holds the database, sign-in and live updates.

## 1. Supabase

1. Create a project on the free tier. Under Authentication → Providers, enable **Anonymous sign-ins**; the demo signs every visitor in anonymously, with a private workspace.
2. Apply the schema from the repo root: `supabase link --project-ref <ref>` then `supabase db push`. This creates the tables, the RLS policies and the Realtime publication. Run `supabase/seed.sql` once (SQL editor) for the sample catalog connection.
3. Note three things from Project Settings:
   - the project URL;
   - the anon key;
   - under Database, the **session pooler** connection string. It's IPv4, and it keeps the prepared statements asyncpg needs.

## 2. Render

1. In the Render dashboard, choose **New → Blueprint** and pick this repository. Render reads `render.yaml` and creates `atlas-api`. It uses the **Free** plan: the API sleeps after 15 idle minutes and the next visitor waits about a minute while it wakes. Choose Starter instead if that wait matters.
2. Fill in the values marked as secret:
   - `DATABASE_URL`: the session pooler string, with the scheme changed to `postgresql+asyncpg://`;
   - `SUPABASE_URL`;
   - `CORS_ORIGINS`: the Vercel production URL;
   - `GROQ_API_KEY` and `GEMINI_API_KEY`.
3. Copy the service URL (`https://atlas-api-….onrender.com`). Under Settings, copy the **Deploy Hook** URL.

## 3. GitHub

Repository **variables**:
- `DEPLOY_ENABLED=true`;
- `API_URL` (the Render URL);
- `SUPABASE_URL`;
- `SUPABASE_ANON_KEY`.

Repository **secrets**:
- `RENDER_DEPLOY_HOOK`;
- `SUPABASE_DB_URL` (the direct connection string, for migrations).

Each push to `main` that touches the API:
1. applies migrations;
2. triggers the Render deploy;
3. waits until `/health` reports the new commit;
4. runs `scripts/smoke.py`, which signs in anonymously, starts a run and waits for the sources checkpoint. It never approves anything.

## 4. Vercel

The project root directory is `apps/web`. Set these for Production and Preview:
- `NEXT_PUBLIC_API_URL`: the Render URL;
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

In Supabase, under Authentication → URL Configuration, add the Vercel production URL and `https://*-elisabeth-nnamanis-projects.vercel.app/**` as redirect URLs.

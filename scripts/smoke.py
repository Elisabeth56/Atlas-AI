"""Smoke test for a deployed API: sign in anonymously, start a run, wait for the first checkpoint.

    API_URL=https://api.example.com SUPABASE_URL=https://ref.supabase.co SUPABASE_ANON_KEY=... python scripts/smoke.py

Exits non-zero if the API is down, auth is misconfigured, or the run doesn't reach the sources checkpoint
within the time limit. It never approves anything, so it can't write to DataHub.
"""
from __future__ import annotations

import os
import sys
import time

import httpx

TIMEOUT_S = 180


def main() -> int:
    api, supabase, anon = os.environ["API_URL"].rstrip("/"), os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_ANON_KEY"]
    with httpx.Client(timeout=30) as http:
        health = http.get(f"{api}/health")
        health.raise_for_status()
        print("health:", health.json())

        # the same anonymous sign-in the demo uses; each smoke run gets its own throwaway workspace
        auth = http.post(f"{supabase}/auth/v1/signup", headers={"apikey": anon}, json={"data": {}})
        auth.raise_for_status()
        headers = {"Authorization": f"Bearer {auth.json()['access_token']}"}

        run_id = http.post(f"{api}/api/runs", headers=headers, json={"prompt": "Customer revenue from Stripe and Postgres events"}).raise_for_status().json()["run_id"]
        print("run:", run_id)

        deadline = time.monotonic() + TIMEOUT_S
        while time.monotonic() < deadline:
            status = http.get(f"{api}/api/runs/{run_id}", headers=headers).raise_for_status().json()["status"]
            if status == "awaiting_context_approval":
                print("reached the sources checkpoint")
                return 0
            if status == "failed":
                print("run failed", file=sys.stderr)
                return 1
            time.sleep(3)
    print(f"no checkpoint after {TIMEOUT_S}s (last status: {status})", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())

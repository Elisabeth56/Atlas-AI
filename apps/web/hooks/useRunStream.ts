"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRun } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Run } from "@/lib/types";

const POLL_MS = 1500;
const TERMINAL = new Set(["complete", "failed"]);

/**
 * One run, kept current. The database is the only source of truth (ADR 003): the worker writes
 * `runs` and `run_steps`, Supabase Realtime says a row changed, and we refetch the run.
 * Without Supabase (local, AUTH_MODE=off), or if the channel fails, it polls instead.
 */
export function useRunStream(runId: string) {
  const [run, setRun] = useState<Run | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  // lets an action (a checkpoint click) pull fresh state without waiting for Realtime
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | null = null;
    let poller: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const next = await getRun(runId);
        if (cancelled) return;
        setRun(next);
        setConnectionError(null);
        if (TERMINAL.has(next.status) && poller) clearInterval(poller);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.code === "run_not_found") setNotFound(true);
        else setConnectionError(e instanceof Error ? e.message : "Couldn’t load this run.");
      }
    };
    refreshRef.current = load;
    // one burst of row changes (a stage finishing writes several) becomes one fetch
    const loadSoon = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(load, 150);
    };
    const startPolling = () => {
      poller ??= setInterval(load, POLL_MS);
    };

    load();
    const supabase = supabaseBrowser();
    if (!supabase) {
      startPolling();
      return () => {
        cancelled = true;
        if (poller) clearInterval(poller);
      };
    }

    const channel = supabase
      .channel(`run:${runId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "runs", filter: `id=eq.${runId}` }, loadSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "run_steps", filter: `run_id=eq.${runId}` }, loadSoon)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") loadSoon(); // catch up on anything missed while (re)connecting
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") startPolling();
      });

    return () => {
      cancelled = true;
      if (pending) clearTimeout(pending);
      if (poller) clearInterval(poller);
      supabase.removeChannel(channel);
    };
  }, [runId]);

  return { run, connectionError, notFound, refresh };
}

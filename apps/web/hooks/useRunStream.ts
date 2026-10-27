"use client";

import { useEffect, useState } from "react";
import { PIPELINE } from "@/lib/pipeline";
import { HAS_BACKEND, getRun, waitForSimulationResume } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Run, RunStep } from "@/lib/types";

export type StageStatus = "pending" | "running" | "done" | "failed";
export type PauseState = "context" | "writeback" | null;
export interface LogLine {
  agent: string;
  text: string;
}

const STAGE_MS = 1600;
const POLL_MS = 1500;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const TERMINAL = new Set(["complete", "failed"]);

/**
 * The live run view. The database is the only source of truth (ADR 003): the worker writes
 * `runs` and `run_steps`, Supabase Realtime tells us a row changed, and we refetch the run.
 * Without Supabase configured (local, AUTH_MODE=off) it polls instead. With no backend at all
 * it simulates the pipeline in the browser.
 */
export function useRunStream(runId: string) {
  const [run, setRun] = useState<Run | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const sim = useSimulation(runId, !HAS_BACKEND);

  useEffect(() => {
    if (!HAS_BACKEND) return;
    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | null = null;
    let poller: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      try {
        const next = await getRun(runId);
        if (cancelled) return;
        setRun(next);
        setConnectionError(null);
        if (TERMINAL.has(next.status) && poller) clearInterval(poller);
      } catch (e) {
        if (!cancelled) setConnectionError(e instanceof Error ? e.message : "Couldn’t load this run.");
      }
    };
    // one burst of row changes (a stage finishing writes several) becomes one fetch
    const refreshSoon = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(refresh, 150);
    };
    const startPolling = () => {
      poller ??= setInterval(refresh, POLL_MS);
    };

    refresh();
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
      .on("postgres_changes", { event: "*", schema: "public", table: "runs", filter: `id=eq.${runId}` }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "run_steps", filter: `run_id=eq.${runId}` }, refreshSoon)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refreshSoon(); // catch up on anything missed while (re)connecting
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") startPolling();
      });

    return () => {
      cancelled = true;
      if (pending) clearTimeout(pending);
      if (poller) clearInterval(poller);
      supabase.removeChannel(channel);
    };
  }, [runId]);

  if (!HAS_BACKEND) return { ...sim, run: null, failed: false, connectionError: null, live: false };
  return { ...fromRun(run), run, connectionError, live: true };
}

function fromRun(run: Run | null) {
  const byAgent = new Map<string, RunStep>((run?.steps ?? []).map((s) => [s.agent, s]));
  const statuses: StageStatus[] = PIPELINE.map((stage) => {
    const step = byAgent.get(stage.id);
    if (!step) return "pending";
    return step.status === "started" ? "running" : step.status === "success" ? "done" : step.status === "failed" ? "failed" : "pending";
  });
  const logs: LogLine[] = PIPELINE.flatMap((stage) => {
    const step = byAgent.get(stage.id);
    if (!step) return [];
    const lines = step.logs.map((text) => ({ agent: stage.id, text }));
    return step.error ? [...lines, { agent: stage.id, text: `failed: ${step.error}` }] : lines;
  });
  const pausedAt: PauseState =
    run?.status === "awaiting_context_approval" ? "context" : run?.status === "awaiting_writeback_approval" ? "writeback" : null;
  return { statuses, logs, pausedAt, complete: run?.status === "complete", failed: run?.status === "failed" };
}

/** Browser-only stand-in for the pipeline, used when no backend is configured. */
function useSimulation(runId: string, enabled: boolean) {
  const [statuses, setStatuses] = useState<StageStatus[]>(PIPELINE.map(() => "pending"));
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [complete, setComplete] = useState(false);
  const [pausedAt, setPausedAt] = useState<PauseState>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function simulate() {
      for (let i = 0; i < PIPELINE.length; i++) {
        if (cancelled) return;
        const stage = PIPELINE[i];

        setStatuses((prev) => {
          const next = [...prev];
          next[i] = "running";
          return next;
        });

        const perLogDelay = STAGE_MS / (stage.logs.length + 1);
        for (const line of stage.logs) {
          await wait(perLogDelay);
          if (cancelled) return;
          setLogs((prev) => [...prev, { agent: stage.id, text: line }]);
        }
        await wait(perLogDelay);
        if (cancelled) return;

        setStatuses((prev) => {
          const next = [...prev];
          next[i] = "done";
          return next;
        });

        // Mirror the real orchestrator's two checkpoints in simulation so
        // the human-in-the-loop panels render here too. See
        // apps/api/app/orchestrator.py — CONTEXT_PHASE ends at index 1
        // (Metadata Analyst); GENERATION_PHASE ends at index 4
        // (Documentation). The panels' accept/skip actions call postAction
        // in lib/api.ts, which fires the resume signal we're awaiting here.
        if (i === 1) {
          setPausedAt("context");
          await waitForSimulationResume(runId);
          if (cancelled) return;
          setPausedAt(null);
        } else if (i === 4) {
          setPausedAt("writeback");
          await waitForSimulationResume(runId);
          if (cancelled) return;
          setPausedAt(null);
        }
      }
      if (!cancelled) setComplete(true);
    }

    simulate();
    return () => {
      cancelled = true;
    };
  }, [runId, enabled]);

  return { statuses, logs, complete, pausedAt };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { PIPELINE } from "@/lib/pipeline";
import { HAS_BACKEND, streamUrl, waitForSimulationResume } from "@/lib/api";
import type { AgentId } from "@/lib/types";

export type StageStatus = "pending" | "running" | "done" | "failed";
export type PauseState = "context" | "writeback" | null;
export interface LogLine {
  agent: string;
  text: string;
}

const STAGE_MS = 1600;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drives the live run UI. With NEXT_PUBLIC_API_URL unset, it simulates the
 * pipeline locally so the frontend is fully demoable without a backend.
 * Once NEXT_PUBLIC_API_URL is set, it connects to
 * WS /api/requests/{id}/stream and consumes real {agent, status} events —
 * no other component needs to change.
 *
 * `pausedAt` reflects the two human-in-the-loop checkpoints: "context"
 * after Metadata Analyst (before Data Engineer runs) and "writeback"
 * after Documentation (before Writeback runs). The run genuinely stops
 * server-side at each — see backend/app/orchestrator.py — this hook just
 * surfaces that stop so a panel can render and call the accept/start-fresh
 * or approve/skip actions in lib/api.ts.
 */
export function useRunStream(runId: string) {
  const [statuses, setStatuses] = useState<StageStatus[]>(
    PIPELINE.map(() => "pending")
  );
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [complete, setComplete] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pausedAt, setPausedAt] = useState<PauseState>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (HAS_BACKEND) {
      const ws = new WebSocket(streamUrl(runId));
      socketRef.current = ws;

      ws.onmessage = (event) => {
        if (cancelled) return;
        const data = JSON.parse(event.data) as {
          agent: AgentId;
          status: "started" | "done" | "failed" | "awaiting_approval";
          result?: { summary: string };
          error?: string;
        };

        if (data.status === "awaiting_approval") {
          // Pause signal only — doesn't touch the stepper. The paused
          // agent's own started/done events (if any ran) already fired
          // separately and are what the stepper reflects.
          setPausedAt(data.agent === "metadata_analyst" ? "context" : "writeback");
          return;
        }

        const idx = PIPELINE.findIndex((s) => s.id === data.agent);
        if (idx === -1) return;

        setStatuses((prev) => {
          const next = [...prev];
          next[idx] = data.status === "started" ? "running" : data.status === "failed" ? "failed" : "done";
          return next;
        });

        if (data.status === "started") {
          setPausedAt(null); // resuming clears whichever checkpoint we were at
          setLogs((prev) => [...prev, { agent: data.agent, text: "started" }]);
        } else if (data.status === "done") {
          setLogs((prev) => [
            ...prev,
            { agent: data.agent, text: data.result?.summary ?? "done" },
          ]);
          if (idx === PIPELINE.length - 1) setComplete(true);
        } else if (data.status === "failed") {
          setLogs((prev) => [...prev, { agent: data.agent, text: `failed: ${data.error}` }]);
        }
      };

      ws.onerror = () => {
        if (!cancelled) setConnectionError("Lost connection to the run stream.");
      };

      return () => {
        cancelled = true;
        ws.close();
      };
    }

    // --- Local simulation fallback (no backend configured) ---
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
        // backend/app/orchestrator.py — CONTEXT_PHASE ends at index 1
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
  }, [runId]);

  return { statuses, logs, complete, connectionError, pausedAt, live: HAS_BACKEND };
}

"use client";

import { useEffect, useRef } from "react";
import type { Run } from "@/lib/types";

const AGENT_NAMES: Record<string, string> = {
  planner: "planner",
  metadata_analyst: "analyst",
  data_engineer: "engineer",
  qa: "qa",
  documentation: "docs",
  writeback: "writeback",
};

function clock(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "";
}

/** What each agent did, in its own words, with what its model calls cost. Read straight from the run's steps. */
export function DarkroomLog({ run }: { run: Run | null }) {
  const list = useRef<HTMLOListElement>(null);
  const lines: { time: string; text: string; tone?: "wait" | "fail" }[] = [];
  for (const step of [...(run?.steps ?? [])]) {
    const name = AGENT_NAMES[step.agent] ?? step.agent;
    for (const text of step.logs) lines.push({ time: clock(step.started_at), text: `${name} · ${text}` });
    if (step.usage) {
      const u = step.usage;
      const failed = u.failed_calls ? ` · ${u.failed_calls} failed` : "";
      lines.push({
        time: clock(step.finished_at ?? step.started_at),
        text: `${name} · ${u.calls} call${u.calls === 1 ? "" : "s"} · ${(u.tokens_in + u.tokens_out).toLocaleString()} tok · ${u.latency_ms}ms${failed}`,
      });
    }
    if (step.error) lines.push({ time: clock(step.finished_at), text: `${name} · ${step.error}`, tone: "fail" });
  }
  if (run?.status.startsWith("awaiting")) lines.push({ time: "", text: "paused · waiting for you", tone: "wait" });

  // follow the newest line, like a terminal
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <aside
      aria-label="Darkroom log"
      className="flex flex-col gap-2.5 rounded-lg bg-sidebar p-[22px] font-mono text-[12px] leading-[1.6] text-ink-3 shadow-[inset_0_0_0_1px_var(--line)]"
    >
      <span className="tracking-[0.12em] text-ink-3/80 uppercase">Darkroom log</span>
      {lines.length === 0 && <span>Waiting for the first agent…</span>}
      <ol ref={list} className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto" aria-live="polite">
        {lines.map((l, i) => (
          <li key={i} className={l.tone === "wait" ? "text-amber" : l.tone === "fail" ? "text-critical" : undefined}>
            {l.time && <span className="mr-2 text-ink-3/60">{l.time}</span>}
            {l.text}
          </li>
        ))}
      </ol>
    </aside>
  );
}

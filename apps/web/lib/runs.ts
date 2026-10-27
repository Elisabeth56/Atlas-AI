import type { RunListItem } from "@/lib/types";

export type RunTone = "waiting" | "running" | "done" | "failed";

/** What the runs list says about a run: a dot colour and a few words. */
export function describeRun(run: Pick<RunListItem, "status" | "writeback_mode">): { tone: RunTone; label: string } {
  switch (run.status) {
    case "awaiting_context_approval":
    case "awaiting_writeback_approval":
      return { tone: "waiting", label: "waiting for you" };
    case "failed":
      return { tone: "failed", label: "step failed" };
    case "complete":
      return { tone: "done", label: run.writeback_mode === "approved" ? "written back" : "skipped writeback" };
    default:
      return { tone: "running", label: "running" };
  }
}

export const TONE_DOT: Record<RunTone, string> = {
  waiting: "bg-amber",
  running: "bg-live motion-safe:animate-[breathe_1.6s_ease-in-out_infinite]",
  done: "bg-moss",
  failed: "bg-critical",
};

export const TONE_TEXT: Record<RunTone, string> = {
  waiting: "text-amber",
  running: "text-ink-3",
  done: "text-ink-3",
  failed: "text-critical",
};

/** "now", "12m", "2h", "3d", then a date. */
export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / 1440)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** A prompt shortened to a run title: first clause, sentence case, no trailing punctuation. */
export function runTitle(prompt: string): string {
  const first = prompt.trim().split(/[.\n]/)[0].replace(/^(build|create|make)\s+(me\s+)?(a|an)\s+/i, "");
  return first.charAt(0).toUpperCase() + first.slice(1);
}

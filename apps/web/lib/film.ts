import type { Run, RunStep } from "@/lib/types";

/** The eight frames of a run: six agents plus the two places a person decides. */
export type FrameState = "developed" | "undeveloped" | "developing" | "waiting" | "decided" | "critical" | "failed";

export interface Frame {
  number: string;
  name: string;
  meta: string;
  state: FrameState;
  checkpoint: boolean;
}

const AGENT_FRAMES = [
  { agent: "planner", name: "Plan" },
  { agent: "metadata_analyst", name: "Match" },
  null, // you: which sources
  { agent: "data_engineer", name: "Build" },
  { agent: "qa", name: "Check" },
  { agent: "documentation", name: "Docs" },
  null, // you: write back?
  { agent: "writeback", name: "Write" },
] as const;

function seconds(step: RunStep): string {
  if (!step.started_at || !step.finished_at) return "";
  const s = (new Date(step.finished_at).getTime() - new Date(step.started_at).getTime()) / 1000;
  return ` · ${s.toFixed(1)}s`;
}

function agentMeta(agent: string, step: RunStep): { meta: string; critical?: boolean } {
  const out = (step.output ?? {}) as Record<string, unknown>;
  if (agent === "metadata_analyst") {
    const n = (out.matched_datasets as unknown[] | undefined)?.length ?? 0;
    return { meta: `${n} source${n === 1 ? "" : "s"}${seconds(step)}` };
  }
  if (agent === "data_engineer") {
    const n = (out.files as unknown[] | undefined)?.length ?? 0;
    return { meta: `${n} files${seconds(step)}` };
  }
  if (agent === "qa") {
    const checks = (out.checks as { passed: boolean; severity: string }[] | undefined) ?? [];
    const critical = checks.filter((c) => !c.passed && c.severity === "critical").length;
    if (critical) return { meta: `${critical} critical`, critical: true };
    const warnings = checks.filter((c) => !c.passed).length;
    return { meta: warnings ? `${warnings} warning${warnings === 1 ? "" : "s"}` : "all passed" };
  }
  return { meta: `done${seconds(step)}` };
}

/** Frames from the run as the database has it. Nothing here advances on a timer. */
export function framesFromRun(run: Run): Frame[] {
  const steps = new Map(run.steps.map((s) => [s.agent, s]));
  const kept = ((steps.get("metadata_analyst")?.output as { matched_datasets?: unknown[] } | null)?.matched_datasets ?? []).length;

  return AGENT_FRAMES.map((slot, i) => {
    const number = `${String(i + 1).padStart(2, "0")}A`;
    if (slot === null) {
      const first = i === 2;
      const waiting = run.status === (first ? "awaiting_context_approval" : "awaiting_writeback_approval");
      const mode = first ? run.context_mode : run.writeback_mode;
      const decided = first
        ? mode === "grounded" ? `kept all ${kept}` : mode === "fresh" ? "started fresh" : null
        : mode === "approved" ? "approved" : mode === "skipped" ? "skipped" : null;
      return {
        number,
        name: "you",
        checkpoint: true,
        state: waiting ? "waiting" : decided ? "decided" : "undeveloped",
        meta: waiting ? (first ? "which sources?" : "write back?") : decided ?? (first ? "which sources?" : "write back?"),
      };
    }
    const step = steps.get(slot.agent);
    if (slot.agent === "writeback" && run.writeback_mode === "skipped" && run.status === "complete") {
      return { number, name: slot.name, checkpoint: false, state: "undeveloped", meta: "skipped" };
    }
    if (!step || step.status === "pending") {
      return { number, name: slot.name, checkpoint: false, state: "undeveloped", meta: "not developed" };
    }
    if (step.status === "started") {
      return { number, name: slot.name, checkpoint: false, state: "developing", meta: "developing…" };
    }
    if (step.status === "failed") {
      return { number, name: slot.name, checkpoint: false, state: "failed", meta: "failed" };
    }
    const { meta, critical } = agentMeta(slot.agent, step);
    return { number, name: slot.name, checkpoint: false, state: critical ? "critical" : "developed", meta };
  });
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { retryStep } from "@/lib/api";
import type { AgentId, Run, RunStep } from "@/lib/types";

const STEP_NAMES: Record<string, string> = {
  planner: "planning",
  metadata_analyst: "catalog search",
  data_engineer: "data engineer",
  qa: "QA",
  documentation: "documentation",
  writeback: "writeback",
};
const PROVIDERS: Record<string, string> = { groq: "Groq", cerebras: "Cerebras", gemini: "Gemini" };

/**
 * What went wrong and what Atlas did about it, in plain words: a model provider that failed over,
 * a catalog that didn't answer, or a step that failed outright (with a retry).
 */
export function RunNotices({ run, onChange }: { run: Run; onChange: () => void }) {
  const recovered = run.steps.map(recovery).filter(Boolean).slice(0, 2) as string[];
  const failed = run.status === "failed" ? run.steps.find((s) => s.status === "failed" || s.status === "started") : undefined;

  if (!recovered.length && !failed) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {recovered.map((text) => (
        <div key={text} role="status" className="flex flex-col gap-1.5 rounded-[14px] bg-surface-2 px-4 py-3.5">
          <span className="font-mono text-[12px] text-moss">recovered</span>
          <span className="text-small text-ink">{text}</span>
        </div>
      ))}
      {failed && <Failure run={run} step={failed} onChange={onChange} />}
    </div>
  );
}

/** "Groq rate-limited the data engineer step. Atlas retried on Cerebras and it passed." from the step's own log. */
function recovery(step: RunStep): string | null {
  if (step.status !== "success") return null;
  const answered = step.logs.find((l) => l.startsWith("answered by "));
  if (!answered) return null;
  const by = PROVIDERS[answered.split(" ")[2]] ?? answered.split(" ")[2];
  const failure = step.logs.find((l) => / (rate limited|http \d+|network error)$/.test(l));
  const [who, ...what] = (failure ?? "").split(" ");
  const how = what.join(" ") === "rate limited" ? "rate-limited" : what.join(" ").startsWith("http") ? "returned an error on" : "couldn’t be reached for";
  const name = STEP_NAMES[step.agent] ?? step.agent;
  return `${PROVIDERS[who] ?? "A provider"} ${how} the ${name} step. Atlas retried on ${by} and it passed.`;
}

function Failure({ run, step, onChange }: { run: Run; step: RunStep; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = STEP_NAMES[step.agent] ?? step.agent;
  const raw = step.error ?? "";
  const catalog = /datahub|mcp/i.test(raw);
  const providers = /every LLM provider failed/i.test(raw);
  const kept = step.agent === "documentation" || step.agent === "writeback" ? "Your models and QA report are saved" : "Everything before this step is saved";

  const retry = async () => {
    setBusy(true);
    setError(null);
    try {
      await retryStep(run.id, step.agent as AgentId);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The retry didn’t start. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2.5 rounded-[14px] px-4 py-3.5 ${catalog ? "bg-surface-2" : "bg-critical-wash"}`}>
      <span className={`font-mono text-[12px] ${catalog ? "text-amber" : "text-critical"}`}>
        {catalog ? "DataHub unreachable" : "step failed"}
      </span>
      <span className="text-small text-ink">
        {catalog
          ? "Atlas couldn’t get an answer from your catalog. You can retry, or start a new run once it’s back."
          : providers
            ? `Every model provider declined the ${name} step. ${kept}; retry this step when a provider frees up.`
            : `The ${name} step failed. ${kept}; retry it, or start a new run.`}
      </span>
      {raw && <code className="font-mono text-[12px] break-words text-ink-3">{raw.slice(0, 240)}</code>}
      {error && <span role="alert" className="text-small text-critical">{error}</span>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={catalog ? "primary" : "secondary"} onClick={retry} disabled={busy} className="h-10 px-4 text-[14px]">
          {busy ? "Retrying…" : catalog ? "Retry" : `Retry ${name}`}
        </Button>
        {catalog && (
          <Link href="/new" className={`${buttonStyles("secondary", "sm")} h-10 px-4 text-[14px]`}>
            New run
          </Link>
        )}
      </div>
    </div>
  );
}

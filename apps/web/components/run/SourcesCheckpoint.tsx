"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Develop } from "@/components/ui/Develop";
import { CheckpointPanel } from "@/components/run/CheckpointPanel";
import { acceptContext, startFresh } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import type { MatchedDataset, Run } from "@/lib/types";

type Choice = "keep" | "fresh";

/** Checkpoint 1: which matched datasets the data engineer may build from. */
export function SourcesCheckpoint({ run, onDecided }: { run: Run; onDecided: () => void }) {
  const analyst = run.steps.find((s) => s.agent === "metadata_analyst")?.output as
    | { matched_datasets?: MatchedDataset[] }
    | null;
  const planner = run.steps.find((s) => s.agent === "planner")?.output as { entities?: string[] } | null;
  const datasets = analyst?.matched_datasets ?? [];
  const entities = planner?.entities ?? [];

  const [open, setOpen] = useState<string | null>(datasets[0]?.urn ?? null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(c: Choice) {
    if (choice) return;
    setChoice(c); // optimistic: the buttons lock and say what's happening straight away
    setError(null);
    try {
      await (c === "keep" ? acceptContext(run.id) : startFresh(run.id));
      onDecided();
    } catch (e) {
      setChoice(null);
      setError(
        e instanceof ApiError && e.code === "checkpoint_conflict"
          ? "This run already moved past this step, maybe from another tab. Showing where it is now."
          : e instanceof Error ? e.message : "That didn’t go through. Try again.",
      );
      onDecided();
    }
  }

  // Enter keeps the sources, unless focus is on something Enter already means something for
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (e.key !== "Enter" || !datasets.length || (el && el !== document.body && el.matches("button,a,input,textarea,select"))) return;
      e.preventDefault();
      decide("keep");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <CheckpointPanel title={datasets.length ? "Which sources should Atlas trust?" : "Nothing in the catalog fits"} frame="03A">
      <p className="mt-2 mb-[22px] max-w-[600px] text-[15px] leading-[1.55] text-ink-2">
        {datasets.length
          ? `Matched from the sample catalog${entities.length ? ` for ${list(entities)}` : ""}. The data engineer only uses columns from the ones you keep.`
          : "Atlas searched the catalog and found no dataset that matches this request. Start fresh to build without grounding, or rephrase it as a new run."}
      </p>

      <Develop
        className="flex flex-col gap-2"
        stagger={0.08}
        items={datasets.map((d) => (
          <DatasetRow key={d.urn} dataset={d} open={open === d.urn} onToggle={() => setOpen(open === d.urn ? null : d.urn)} />
        ))}
      />

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-critical-wash px-4 py-3 text-small text-ink">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {datasets.length > 0 && (
          <Button size="lg" onClick={() => decide("keep")} disabled={!!choice}>
            {choice === "keep" ? "Keeping…" : `Keep ${datasets.length} source${datasets.length === 1 ? "" : "s"}`}
            {!choice && <span className="font-mono text-[12px]" aria-hidden>↵</span>}
          </Button>
        )}
        <Button size="lg" variant="secondary" onClick={() => decide("fresh")} disabled={!!choice}>
          {choice === "fresh" ? "Starting fresh…" : "Start fresh"}
        </Button>
        <span className="text-[13px] text-ink-3">Starting fresh skips grounding; QA marks the output ungrounded.</span>
      </div>
    </CheckpointPanel>
  );
}

function DatasetRow({ dataset, open, onToggle }: { dataset: MatchedDataset; open: boolean; onToggle: () => void }) {
  const pii = new Set(dataset.pii_columns ?? []);
  const id = `cols-${dataset.urn.replace(/\W/g, "")}`;
  return (
    <div className="rounded-[16px] bg-surface-2">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-[16px] px-[18px] py-4 text-left"
      >
        <span aria-hidden className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-moss text-[13px] font-semibold text-surface-0">
          ✓
        </span>
        <span className="grow font-mono text-[14px] text-ink">{dataset.name}</span>
        {pii.size > 0 && (
          <span className="rounded-full bg-critical-wash px-2.5 py-0.5 text-[12px] text-critical">
            {pii.size} PII column{pii.size === 1 ? "" : "s"}
          </span>
        )}
        <span className="font-mono text-[12px] text-ink-3">{dataset.confidence.toFixed(2)} match</span>
      </button>
      {open && (
        <ul id={id} aria-label={`Columns in ${dataset.name}`} className="flex flex-wrap gap-1.5 px-[18px] pb-4 pl-[54px]">
          {dataset.columns.map((c) => (
            <li
              key={c}
              className={`rounded-sm px-2 py-1 font-mono text-[12px] ${pii.has(c) ? "bg-critical-wash text-critical" : "bg-surface-1 text-ink-2"}`}
            >
              {c}
              {pii.has(c) && " · PII"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function list(words: string[]) {
  return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

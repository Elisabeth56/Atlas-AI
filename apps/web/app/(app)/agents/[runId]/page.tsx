"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FilmStrip } from "@/components/agents/FilmStrip";
import { DarkroomLog } from "@/components/run/DarkroomLog";
import { SourcesCheckpoint } from "@/components/run/SourcesCheckpoint";
import { WritebackStage } from "@/components/run/WritebackStage";
import { buttonStyles } from "@/components/ui/Button";
import { useRunStream } from "@/hooks/useRunStream";
import { getRun } from "@/lib/api";
import { framesFromRun, framesFromStatuses, type Frame } from "@/lib/film";
import { DEMO_PROMPT } from "@/lib/pipeline";
import { runTitle } from "@/lib/runs";
import type { Run } from "@/lib/types";

export default function RunPage() {
  const { runId } = useParams<{ runId: string }>();
  const search = useSearchParams();
  const stream = useRunStream(runId);
  const run = useSimulatedRun(runId, stream) ?? stream.run;
  const frames = stream.run ? framesFromRun(stream.run) : framesFromStatuses(stream.statuses, stream.pausedAt);
  const prompt = run?.prompt ?? search.get("prompt") ?? DEMO_PROMPT;

  useTabTitle(frames, run);

  return (
    <div className="flex flex-col gap-[22px] px-4 pt-5 pb-[60vh] sm:px-7 md:pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-ink-3">
          Runs <span className="text-ink-3/50">/</span> <span className="text-ink">{runTitle(prompt)}</span>
        </span>
        <span className="font-mono text-[12px] text-ink-3/80">
          {runId.slice(0, 8)}
          {run && ` · started ${new Date(run.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`}
        </span>
      </div>

      <h1 className="max-w-[820px] text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink md:text-[34px]">{prompt}</h1>

      {stream.connectionError && (
        <p role="status" className="rounded-md bg-surface-2 px-4 py-3 text-small text-ink-2">
          {stream.connectionError} Atlas keeps working; this page catches up when it reconnects.
        </p>
      )}

      <FilmStrip frames={frames} />

      {run && atWriteback(run) ? (
        <>
          <WritebackStage run={run} onChange={stream.refresh} />
          <DarkroomLog run={run} />
        </>
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 flex-[999_1_520px]">
            <Panel run={run} frames={frames} onChange={stream.refresh} />
          </div>
          <div className="min-w-0 flex-[1_1_280px]">
            <DarkroomLog run={run} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Checkpoint 2, and the writeback phase that follows an approval, share one layout so the lineage light can play. */
function atWriteback(run: Run) {
  return run.status === "awaiting_writeback_approval" || (run.status === "running" && run.writeback_mode === "approved");
}

function Panel({ run, frames, onChange }: { run: Run | null; frames: Frame[]; onChange: () => void }) {
  if (!run) return null;
  switch (run.status) {
    case "awaiting_context_approval":
      return <SourcesCheckpoint run={run} onDecided={onChange} />;
    case "complete":
      return (
        <section className="flex flex-col gap-4 rounded-lg bg-surface-1 p-7 hairline">
          <h2 className="text-heading text-ink">{run.writeback_mode === "approved" ? "Developed and written back" : "Developed"}</h2>
          <p className="max-w-[60ch] text-body text-ink-2">
            {run.writeback_mode === "approved"
              ? "The models, tests and docs are ready, and DataHub now has their documentation and lineage."
              : "The models, tests and docs are ready. Nothing was written to DataHub."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/agents/${run.id}/artifacts`} className={buttonStyles("primary", "lg")}>
              Open the files
            </Link>
            <Link href={`/agents/${run.id}/validation`} className={buttonStyles("secondary", "lg")}>
              QA report
            </Link>
          </div>
        </section>
      );
    case "failed":
      return (
        <section className="rounded-lg bg-critical-wash p-7">
          <h2 className="text-heading text-ink">A step failed</h2>
          <p className="mt-2 max-w-[60ch] text-body text-ink-2">The darkroom log shows what went wrong. Everything before that step is saved.</p>
        </section>
      );
    default: {
      const now = frames.find((f) => f.state === "developing");
      return (
        <section className="rounded-lg bg-surface-1 p-7 hairline">
          <h2 className="text-heading text-ink">{now ? `Developing: ${now.name.toLowerCase()}` : "Starting the run"}</h2>
          <p className="mt-2 max-w-[60ch] text-body text-ink-2">
            You can leave this page. The run keeps going and stops at the next decision for you.
          </p>
        </section>
      );
    }
  }
}

/** The browser simulation has no database row, so it borrows the mock run and takes its status from the pause. */
function useSimulatedRun(runId: string, stream: ReturnType<typeof useRunStream>): Run | null {
  const [mock, setMock] = useState<Run | null>(null);
  useEffect(() => {
    if (!stream.live) getRun(runId).then(setMock);
  }, [runId, stream.live]);
  if (stream.live || !mock) return null;
  const status: Run["status"] =
    stream.pausedAt === "context" ? "awaiting_context_approval"
    : stream.pausedAt === "writeback" ? "awaiting_writeback_approval"
    : stream.complete ? "complete" : "running";
  return { ...mock, status, steps: status === "awaiting_context_approval" ? mock.steps.slice(0, 2) : mock.steps };
}

/** Long runs go on in the background; the tab says where they are. */
function useTabTitle(frames: Frame[], run: Run | null) {
  useEffect(() => {
    const waiting = frames.some((f) => f.state === "waiting");
    const developing = frames.find((f) => f.state === "developing");
    const label = waiting ? "Waiting for you" : developing ? developing.name : run?.status === "complete" ? "Developed" : run?.status === "failed" ? "Step failed" : "Run";
    document.title = `${label} · Atlas`;
    return () => {
      document.title = "Atlas";
    };
  }, [frames, run?.status]);
}

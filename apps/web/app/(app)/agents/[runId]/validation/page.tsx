"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { QaReport } from "@/components/run/WritebackStage";
import { getRun, getValidationReport } from "@/lib/api";
import { runTitle } from "@/lib/runs";
import type { Run, ValidationReport } from "@/lib/types";

/** The QA report on its own page, for after the run. Fixes only apply at the writeback checkpoint, so it's read-only. */
export default function ValidationPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRun(runId).then(setRun).catch(() => {});
    getValidationReport(runId).then(setReport, (e) => setError(e instanceof Error ? e.message : "QA report unavailable."));
  }, [runId]);

  return (
    <div className="flex max-w-[960px] flex-col gap-5 px-4 pt-5 pb-10 sm:px-7">
      <span className="text-[13px] text-ink-3">
        Runs <span className="text-ink-3/50">/</span>{" "}
        <Link href={`/agents/${runId}`} className="hover:text-ink">
          {run ? runTitle(run.prompt) : "Run"}
        </Link>{" "}
        <span className="text-ink-3/50">/</span> <span className="text-ink">QA report</span>
      </span>
      {run && (
        <QaReport
          run={run}
          report={report}
          error={error}
          onReport={setReport}
          onChange={() => {}}
          canApply={run.status === "awaiting_writeback_approval"}
        />
      )}
    </div>
  );
}

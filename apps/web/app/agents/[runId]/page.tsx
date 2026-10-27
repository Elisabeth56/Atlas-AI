"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, FileText, ShieldAlert, WifiOff } from "lucide-react";
import { AppSubNav } from "@/components/layout/AppSubNav";
import { RunStepper } from "@/components/agents/RunStepper";
import { ExecutionLog } from "@/components/agents/ExecutionLog";
import { ContextReviewPanel } from "@/components/agents/ContextReviewPanel";
import { WritebackApprovalPanel } from "@/components/agents/WritebackApprovalPanel";
import { PIPELINE, DEMO_PROMPT } from "@/lib/pipeline";
import { useRunStream } from "@/hooks/useRunStream";

export default function RunPage() {
  const params = useParams<{ runId: string }>();
  const search = useSearchParams();
  const prompt = search.get("prompt") ?? DEMO_PROMPT;

  const { statuses, logs, complete, connectionError, pausedAt, live } = useRunStream(params.runId);

  return (
    <>
      <AppSubNav crumb={`agents/${params.runId}`} />
      <main className="flex-1 bg-bg-base">
        <div className="mx-auto max-w-[1280px] px-6 py-10 lg:px-10">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <p className="font-mono-atlas text-[12px] text-text-muted">
                run · {params.runId}
              </p>
              {live && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  Live backend
                </span>
              )}
            </div>
            <h1 className="text-[22px] font-semibold leading-snug text-text-heading">
              &ldquo;{prompt}&rdquo;
            </h1>
          </div>

          {connectionError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-accent-dim-border bg-accent-dim px-4 py-3 text-[13px] text-text-heading">
              <WifiOff className="h-4 w-4 text-accent" />
              {connectionError}
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <RunStepper stages={PIPELINE} statuses={statuses} />
            <div className="h-[460px]">
              <ExecutionLog lines={logs} />
            </div>
          </div>

          {pausedAt === "context" && <ContextReviewPanel requestId={params.runId} />}
          {pausedAt === "writeback" && <WritebackApprovalPanel requestId={params.runId} />}

          {complete && (
            <div className="mt-5 card-atlas flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-accent" />
                <div>
                  <p className="text-[15px] font-semibold text-text-heading">
                    Run complete
                  </p>
                  <p className="text-[13px] text-text-body">
                    3 models, 2 tests, 1 doc generated · 1 PII column flagged
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Link href={`/agents/${params.runId}/validation`} className="btn-secondary">
                  <ShieldAlert className="h-3.5 w-3.5" /> View validation report
                </Link>
                <Link href={`/agents/${params.runId}/artifacts`} className="btn-primary">
                  <FileText className="h-3.5 w-3.5" /> View artifacts
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { GitBranch, Check, X } from "lucide-react";
import { getRequest, approveWriteback, skipWriteback } from "@/lib/api";
import type { MatchedDataset } from "@/lib/types";

export function WritebackApprovalPanel({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState<MatchedDataset[]>([]);
  const [submitting, setSubmitting] = useState<"approve" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRequest(requestId)
      .then((req) => {
        if (cancelled) return;
        const run = req.agent_runs.find((r) => r.agent_name === "metadata_analyst");
        const matched = (run?.output_json?.matched_datasets as MatchedDataset[] | undefined) ?? [];
        setDatasets(matched);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load preview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  async function handleApprove() {
    setSubmitting("approve");
    setError(null);
    try {
      await approveWriteback(requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue.");
      setSubmitting(null);
    }
  }

  async function handleSkip() {
    setSubmitting("skip");
    setError(null);
    try {
      await skipWriteback(requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue.");
      setSubmitting(null);
    }
  }

  // Mirrors WritebackAgent's own logic (backend/app/agents/writeback_agent.py):
  // it chains matched datasets upstream->downstream, so N datasets produce
  // N-1 lineage edges. Computed here for preview purposes only — the actual
  // write happens server-side after approval.
  const lineageEdgeCount = Math.max(datasets.length - 1, 0);

  return (
    <div className="card-atlas mt-5 p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-dim">
          <GitBranch className="h-4 w-4 text-accent" />
        </span>
        <div>
          <p className="text-[15px] font-semibold text-text-heading">
            Generated. Nothing has been written to DataHub yet.
          </p>
          <p className="text-[13px] text-text-body">
            Review what Atlas wants to write back before it commits anything.
          </p>
        </div>
      </div>

      {loading && (
        <p className="mt-5 text-[13px] text-text-muted">Loading writeback preview…</p>
      )}

      {!loading && datasets.length > 0 && (
        <div className="mt-5 rounded-lg border border-border-hairline bg-bg-card px-4 py-4">
          <p className="text-[13px] font-medium text-text-heading">This will:</p>
          <ul className="mt-2.5 flex flex-col gap-1.5 text-[13px] text-text-body">
            <li>
              • Write documentation to{" "}
              <span className="font-mono-atlas text-text-heading">
                {datasets.map((d) => d.name).join(", ")}
              </span>
            </li>
            <li>
              • Add {lineageEdgeCount} lineage edge{lineageEdgeCount === 1 ? "" : "s"} between
              them
            </li>
          </ul>
        </div>
      )}

      {!loading && datasets.length === 0 && (
        <div className="mt-5 rounded-lg border border-border-hairline bg-bg-card px-4 py-4">
          <p className="text-[13px] text-text-body">
            This run started fresh with no matched DataHub datasets, so
            there&apos;s nothing to write back to. You can still finish the
            run — it just won&apos;t touch DataHub.
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-[13px] text-red-400">{error}</p>}

      <div className="mt-6 flex flex-col gap-3 border-t border-border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-text-muted">
          Skipping still keeps your generated artifacts — only DataHub is affected.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            disabled={submitting !== null || loading}
            className="btn-secondary disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            {submitting === "skip" ? "Finishing…" : "Skip write-back"}
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting !== null || loading || datasets.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {submitting === "approve" ? "Writing back…" : "Approve & write back"}
          </button>
        </div>
      </div>
    </div>
  );
}

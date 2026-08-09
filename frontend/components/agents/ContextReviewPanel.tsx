"use client";

import { useEffect, useState } from "react";
import { Database, Sparkles, ArrowRight, Tag, User } from "lucide-react";
import { getRequest, acceptContext, startFresh } from "@/lib/api";
import type { MatchedDataset } from "@/lib/types";

export function ContextReviewPanel({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState<MatchedDataset[] | null>(null);
  const [submitting, setSubmitting] = useState<"accept" | "fresh" | null>(null);
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
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load context.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  async function handleAccept() {
    setSubmitting("accept");
    setError(null);
    try {
      await acceptContext(requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue.");
      setSubmitting(null);
    }
  }

  async function handleStartFresh() {
    setSubmitting("fresh");
    setError(null);
    try {
      await startFresh(requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue.");
      setSubmitting(null);
    }
  }

  const hasDatasets = (datasets?.length ?? 0) > 0;

  return (
    <div className="card-atlas mt-5 p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-dim">
          <Database className="h-4 w-4 text-accent" />
        </span>
        <div>
          <p className="text-[15px] font-semibold text-text-heading">
            Atlas paused to check its work
          </p>
          <p className="text-[13px] text-text-body">
            Here&apos;s what it found in DataHub before generating anything.
          </p>
        </div>
      </div>

      {loading && (
        <p className="mt-5 text-[13px] text-text-muted">Loading matched context…</p>
      )}

      {!loading && !hasDatasets && (
        <div className="mt-5 rounded-lg border border-border-hairline bg-bg-card px-4 py-4">
          <p className="text-[13px] text-text-body">
            No existing datasets matched this request in DataHub — this looks
            like new ground. You can still continue; Atlas will generate
            without grounding in existing structure.
          </p>
        </div>
      )}

      {!loading && hasDatasets && (
        <div className="mt-5 flex flex-col gap-3">
          {datasets!.map((ds) => (
            <div
              key={ds.urn}
              className="rounded-lg border border-border-hairline bg-bg-card px-4 py-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono-atlas text-[13px] font-medium text-text-heading">
                    {ds.name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-text-muted">{ds.platform}</p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-accent-dim px-2.5 py-1 text-[11px] font-medium text-accent">
                  {Math.round(ds.confidence * 100)}% match
                </span>
              </div>

              <p className="mt-3 font-mono-atlas text-[12px] leading-relaxed text-text-body">
                {ds.columns.join(", ")}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {ds.owners.length > 0 && (
                  <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
                    <User className="h-3 w-3" /> {ds.owners.join(", ")}
                  </span>
                )}
                {ds.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full border border-border-hairline-strong px-2 py-0.5 text-[11px] text-text-muted"
                  >
                    <Tag className="h-3 w-3" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-[13px] text-red-400">{error}</p>}

      <div className="mt-6 flex flex-col gap-3 border-t border-border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-text-muted">
          Nothing has been generated yet — this is read-only context.
        </p>
        <div className="flex gap-3">
          {hasDatasets && (
            <button
              onClick={handleStartFresh}
              disabled={submitting !== null || loading}
              className="btn-secondary disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {submitting === "fresh" ? "Starting…" : "Start fresh instead"}
            </button>
          )}
          <button
            onClick={hasDatasets ? handleAccept : handleStartFresh}
            disabled={submitting !== null || loading}
            className="btn-primary disabled:opacity-50"
          >
            {submitting !== null
              ? "Continuing…"
              : hasDatasets
                ? "Use this context"
                : "Continue without existing context"}
            {submitting === null && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

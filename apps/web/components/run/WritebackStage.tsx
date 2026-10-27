"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Develop } from "@/components/ui/Develop";
import { Finding, type Severity } from "@/components/ui/Finding";
import { CheckpointPanel } from "@/components/run/CheckpointPanel";
import { applyFix, approveWriteback, getValidationReport, skipWriteback } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import type { MatchedDataset, QaFix, Run, ValidationCheck, ValidationReport } from "@/lib/types";

const ORDER: Record<Severity, number> = { critical: 0, warning: 1, passed: 2 };

function severityOf(c: ValidationCheck): Severity {
  return c.passed ? "passed" : c.severity === "critical" ? "critical" : "warning";
}

/** Checkpoint 2: QA's findings on the left, the write-back decision on the right. */
export function WritebackStage({ run, onChange }: { run: Run; onChange: () => void }) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qaFinished = run.steps.find((s) => s.agent === "qa")?.finished_at;

  useEffect(() => {
    getValidationReport(run.id).then(setReport, (e) => setError(e instanceof Error ? e.message : "QA report unavailable."));
  }, [run.id, qaFinished]);

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="min-w-0 flex-[999_1_480px]">
        <QaReport run={run} report={report} error={error} onReport={setReport} onChange={onChange} />
      </div>
      <div className="min-w-0 flex-[1_1_340px]">
        <WritebackDecision run={run} blocking={report?.blocking ?? true} ready={!!report} onChange={onChange} />
      </div>
    </div>
  );
}

export function QaReport({
  run,
  report,
  error,
  onReport,
  onChange,
  canApply = true,
}: {
  canApply?: boolean;
  run: Run;
  report: ValidationReport | null;
  error: string | null;
  onReport: (r: ValidationReport) => void;
  onChange: () => void;
}) {
  const [applying, setApplying] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  if (error) return <p className="rounded-lg bg-surface-1 p-7 text-body text-ink-2">{error}</p>;
  if (!report) {
    return (
      <section aria-busy className="flex flex-col gap-2.5 rounded-lg bg-surface-1 p-7 hairline">
        <span className="h-7 w-2/3 rounded-full bg-surface-2" />
        {[0, 1, 2].map((i) => <span key={i} className="h-14 rounded-md bg-surface-2" />)}
      </section>
    );
  }

  const checks = [...report.checks].sort((a, b) => ORDER[severityOf(a)] - ORDER[severityOf(b)]);
  const failing = checks.filter((c) => !c.passed);
  const passed = checks.filter((c) => c.passed);
  const critical = failing.filter((c) => c.severity === "critical").length;
  const pending = report.fixes.filter((f) => !f.applied);
  const applied = report.fixes.filter((f) => f.applied);

  async function apply(fix: QaFix) {
    setApplying(fix.id);
    setApplyError(null);
    try {
      onReport(await applyFix(run.id, fix.id));
      onChange();
    } catch (e) {
      setApplyError(
        e instanceof ApiError && e.code === "fix_stale"
          ? "The file changed since QA suggested this. Open it to fix the line by hand."
          : e instanceof Error ? e.message : "The fix didn’t apply. Try again.",
      );
    } finally {
      setApplying(null);
    }
  }

  const title = critical ? (critical === 1 ? "One thing to fix first" : `${critical} things to fix first`) : failing.length ? "Ready, with notes" : "Every check passed";

  return (
    <section className="flex flex-col gap-2.5 rounded-lg bg-surface-1 p-5 hairline md:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[22px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink md:text-[26px]">{title}</h2>
        <span className="font-mono text-[12px] text-ink-3">QA · {checks.length} checks · code, not a model</span>
      </div>

      <Develop
        className="mt-2.5 flex flex-col gap-2.5"
        items={[
          ...failing.map((c) => (
            <Finding key={c.name} severity={severityOf(c)} name={c.name}>
              {c.message}
              {c.name === "PII stays masked" &&
                canApply &&
                pending.map((fix) => (
                  <FixPreview key={fix.id} run={run} fix={fix} busy={applying === fix.id} onApply={() => apply(fix)} />
                ))}
            </Finding>
          )),
          ...applied.map((fix) => (
            <Finding key={fix.id} severity="passed" name="Fixed">
              <code>{fix.column}</code> is now hashed in <code>{fix.file.split("/").at(-1)}</code> line {fix.line}. QA re-ran on the change; the docs keep the old column name until the next run.
            </Finding>
          )),
          passed.length > 0 && (
            <Finding key="passed" severity="passed">
              {passed.map((c) => c.name).join(" · ")}
            </Finding>
          ),
        ].filter(Boolean)}
      />

      {applyError && (
        <p role="alert" className="rounded-md bg-critical-wash px-4 py-3 text-small text-ink">
          {applyError}
        </p>
      )}
    </section>
  );
}

function FixPreview({ run, fix, busy, onApply }: { run: Run; fix: QaFix; busy: boolean; onApply: () => void }) {
  const href = `/agents/${run.id}/artifacts?file=${encodeURIComponent(fix.file)}&line=${fix.line}`;
  return (
    <span className="mt-3 block">
      <span className="block rounded-[10px] bg-surface-0 px-3 py-2.5 font-mono text-[12px] leading-[1.7] whitespace-pre-wrap">
        <span className="block text-critical">−{fix.before}</span>
        <span className="block text-moss">+{fix.after}</span>
      </span>
      <span className="mt-3 flex flex-wrap gap-2">
        <Link href={href} className="inline-flex h-9 items-center rounded-full bg-surface-2 px-3.5 text-[13px] text-ink">
          Open line {fix.line}
        </Link>
        <Button variant="suggest" size="sm" onClick={onApply} disabled={busy}>
          {busy ? "Re-checking…" : "Apply this fix and re-check"}
        </Button>
      </span>
    </span>
  );
}

function WritebackDecision({
  run,
  blocking,
  ready,
  onChange,
}: {
  run: Run;
  blocking: boolean;
  ready: boolean;
  onChange: () => void;
}) {
  const datasets =
    ((run.steps.find((s) => s.agent === "metadata_analyst")?.output as { matched_datasets?: MatchedDataset[] } | null)
      ?.matched_datasets ?? []);
  const files = ((run.steps.find((s) => s.agent === "data_engineer")?.output as { files?: { kind: string; filename: string }[] } | null)
    ?.files ?? []);
  // mirrors the writeback agent: one edge from every kept source into every generated mart
  const marts = files.filter((f) => f.kind === "dbt_model" && f.filename.includes("/marts/")).map((f) => f.filename.split("/").at(-1)!.replace(/\.sql$/, ""));
  const sources = run.context_mode === "fresh" ? [] : datasets.map((d) => d.name);
  const writing = run.writeback_mode === "approved";

  const [choice, setChoice] = useState<"approve" | "skip" | null>(writing ? "approve" : null);
  const [error, setError] = useState<string | null>(null);

  async function decide(c: "approve" | "skip") {
    setChoice(c);
    setError(null);
    try {
      await (c === "approve" ? approveWriteback(run.id) : skipWriteback(run.id));
      onChange();
    } catch (e) {
      setChoice(null);
      setError(
        e instanceof ApiError && e.code === "qa_blocking" ? "QA still has a critical finding. Fix it, or skip writeback."
        : e instanceof ApiError && e.code === "checkpoint_conflict" ? "This run already moved past this step."
        : e instanceof Error ? e.message : "That didn’t go through. Try again.",
      );
      onChange();
    }
  }

  return (
    <CheckpointPanel title="write back?" frame="07A" hand startFolded={blocking} key={String(blocking)}>
      <div className="mt-4 flex flex-col gap-4">
        <Lineage sources={sources} mart={marts[0] ?? "your mart"} lit={choice === "approve"} />
        <ul className="flex flex-col gap-2 text-small leading-[1.5] text-ink-2">
          {marts.map((m) => (
            <li key={m}>
              <span className="text-moss">+</span> Document <code className="font-mono text-[13px] text-ink">{m}</code>
            </li>
          ))}
          <li>
            <span className="text-moss">+</span> {sources.length * marts.length} lineage edge{sources.length * marts.length === 1 ? "" : "s"} into {marts.length === 1 ? "it" : "them"}
          </li>
          <li>
            <span className="text-ink-3">=</span> Source descriptions stay as they are
          </li>
        </ul>

        {ready && blocking && !choice && (
          <p className="rounded-[14px] bg-critical-wash px-3.5 py-3 text-[13px] leading-[1.5] text-ink">
            Locked until the critical finding is fixed. Skipping keeps every file.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-[14px] bg-critical-wash px-3.5 py-3 text-[13px] text-ink">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2.5">
          <Button size="lg" className="flex-[1_1_150px]" onClick={() => decide("approve")} disabled={!ready || blocking || !!choice}>
            {choice === "approve" ? "Writing to DataHub…" : "Approve"}
          </Button>
          <Button size="lg" variant="secondary" className="flex-[1_1_130px]" onClick={() => decide("skip")} disabled={!!choice}>
            {choice === "skip" ? "Skipping…" : "Skip"}
          </Button>
        </div>
      </div>
    </CheckpointPanel>
  );
}

/** Sources on the left, the mart on the right. On approval a moss light travels each edge, source to mart. */
function Lineage({ sources, mart, lit }: { sources: string[]; mart: string; lit: boolean }) {
  const reduced = useReducedMotion();
  const shown = sources.slice(0, 4);
  const ys = shown.map((_, i) => (shown.length === 1 ? 75 : 24 + (i * 102) / (shown.length - 1)));
  const paths = ys.map((y) => (y === 75 ? `M24 75 L 246 75` : `M24 ${y} C 120 ${y}, 160 75, 246 75`));
  const label =
    shown.length === 0
      ? `No lineage: this run started fresh, so only ${mart}'s documentation is written`
      : `Lineage that will be added: ${shown.map((s) => s.split(".").at(-1)).join(", ")} into ${mart}`;

  return (
    <div className="h-[150px] overflow-hidden rounded-[16px] bg-surface-0">
      <svg role="img" aria-label={label} width="100%" height="150" viewBox="0 0 320 150">
        <g fill="none" stroke="var(--moss-deep)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="5 6">
          {paths.map((d) => <path key={d} d={d} />)}
        </g>
        {lit && !reduced &&
          paths.map((d, i) => (
            <motion.circle
              key={`light-${d}`}
              r={3.5}
              fill="var(--moss)"
              style={{ offsetPath: `path("${d}")` }}
              initial={{ offsetDistance: "0%", opacity: 0 }}
              animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: i * 0.12, repeat: Infinity, repeatDelay: 0.6 }}
            />
          ))}
        <g fill="var(--surface-0)" stroke="var(--moss)" strokeWidth={1.5}>
          {ys.map((y) => <circle key={y} cx={24} cy={y} r={4} />)}
        </g>
        <circle cx={256} cy={75} r={10} fill="var(--surface-1)" stroke="var(--safelight)" strokeWidth={1.5} strokeDasharray={lit ? undefined : "3 3"} />
        <g fontFamily="var(--font-mono)" fontSize={10} fill="var(--ink-3)">
          {shown.map((s, i) => <text key={s} x={36} y={ys[i] - 6}>{s.split(".").at(-1)}</text>)}
          <text x={300} y={104} textAnchor="end">{mart}</text>
        </g>
      </svg>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CodeView } from "@/components/run/CodeView";
import { Button } from "@/components/ui/Button";
import { applyFix, getArtifacts, getRun, getValidationReport } from "@/lib/api";
import { basename, fixFor, GROUPS, groupOf, marksFor, projectZip } from "@/lib/files";
import { runTitle } from "@/lib/runs";
import type { ArtifactFile, QaFix, Run, ValidationReport } from "@/lib/types";

const lastFileKey = (runId: string) => `atlas.file.${runId}`;

export default function ArtifactsPage() {
  const { runId } = useParams<{ runId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [files, setFiles] = useState<ArtifactFile[] | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([getRun(runId), getArtifacts(runId)]);
      setRun(r);
      setFiles(a.files);
      setReport(await getValidationReport(runId).catch(() => null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t load this run’s files.");
    }
  }, [runId]);
  useEffect(() => {
    load();
  }, [load]);

  // ?file= wins (a deep link from a finding), then the file you last had open on this run, then the first flagged one
  const marks = useMemo(() => marksFor(files ?? [], report), [files, report]);
  const selected = useMemo(() => {
    if (!files?.length) return null;
    const wanted = search.get("file") ?? readLast(runId);
    return files.find((f) => f.filename === wanted) ?? files.find((f) => marks.get(f.filename) === "critical") ?? files[0];
  }, [files, marks, search, runId]);

  const open = (f: ArtifactFile) => {
    try {
      localStorage.setItem(lastFileKey(runId), f.filename);
    } catch {}
    router.replace(`/agents/${runId}/artifacts?file=${encodeURIComponent(f.filename)}`, { scroll: false });
  };

  const apply = async (fix: QaFix) => {
    setReport(await applyFix(runId, fix.id));
    const a = await getArtifacts(runId);
    setFiles(a.files);
  };

  const download = () => {
    if (!files) return;
    const name = (run ? runTitle(run.prompt) : "atlas").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40).replace(/^_+|_+$/g, "");
    const url = URL.createObjectURL(projectZip(files, name));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${name}.zip` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const line = Number(search.get("line")) || undefined;

  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-10 sm:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-ink-3">
          Runs <span className="text-ink-3/50">/</span>{" "}
          <Link href={`/agents/${runId}`} className="hover:text-ink">
            {run ? runTitle(run.prompt) : "Run"}
          </Link>{" "}
          <span className="text-ink-3/50">/</span> <span className="text-ink">Files</span>
        </span>
        <Button size="sm" onClick={download} disabled={!files?.length}>
          Download dbt project
        </Button>
      </div>

      {error && <p className="rounded-lg bg-surface-1 p-7 text-body text-ink-2">{error}</p>}
      {!error && files?.length === 0 && (
        <p className="rounded-lg bg-surface-1 p-7 text-body text-ink-2">No files yet. They develop here as the data engineer finishes.</p>
      )}

      {!files && !error && (
        <div aria-busy className="flex flex-wrap gap-5">
          <div className="h-80 flex-[1_1_240px] rounded-lg bg-surface-1" />
          <div className="h-80 flex-[999_1_560px] rounded-lg bg-surface-1" />
        </div>
      )}

      {files && selected && (
        <div className="flex flex-wrap items-start gap-5">
          {/* phones: a native picker keeps the code above the fold */}
          <label className="flex w-full flex-col gap-1.5 md:hidden">
            <span className="text-caption text-ink-3">File</span>
            <select
              value={selected.filename}
              onChange={(e) => open(files.find((f) => f.filename === e.target.value)!)}
              className="h-11 rounded-md bg-surface-1 px-3 font-mono text-[13px] text-ink hairline"
            >
              {files.map((f) => (
                <option key={f.filename} value={f.filename}>
                  {f.filename}
                  {marks.get(f.filename) ? ` · ${marks.get(f.filename)}` : ""}
                </option>
              ))}
            </select>
          </label>

          <nav aria-label="Files" className="hidden flex-[1_1_240px] flex-col gap-0.5 rounded-lg bg-surface-1 p-3.5 font-mono text-[13px] hairline md:flex">
            {GROUPS.map((group) => {
              const inGroup = files.filter((f) => groupOf(f) === group);
              if (!inGroup.length) return null;
              return (
                <div key={group} className="flex flex-col gap-0.5">
                  <span className="px-2.5 pt-3 pb-1.5 text-[11px] tracking-[0.12em] text-ink-3 uppercase first:pt-1.5">{group}</span>
                  {inGroup.map((f) => {
                    const mark = marks.get(f.filename);
                    const current = f.filename === selected.filename;
                    return (
                      <button
                        key={f.filename}
                        onClick={() => open(f)}
                        aria-current={current ? "page" : undefined}
                        className={`flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-left ${
                          current ? (mark === "critical" ? "bg-critical-wash text-ink" : "bg-surface-2 text-ink") : "text-ink-2 hover:bg-surface-2/60"
                        }`}
                      >
                        <span className="truncate">{basename(f.filename)}</span>
                        {mark && (
                          <span className={mark === "critical" ? "text-critical" : "text-amber"}>
                            <span aria-hidden>●</span>
                            <span className="sr-only">{mark === "critical" ? "critical finding" : "warning"}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="min-w-0 flex-[999_1_560px]">
            <CodeView
              file={selected}
              flagged={search.get("file") === selected.filename ? line : undefined}
              fix={fixFor(selected.filename, report)}
              canApply={run?.status === "awaiting_writeback_approval"}
              onApply={apply}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function readLast(runId: string): string | null {
  try {
    return localStorage.getItem(lastFileKey(runId));
  } catch {
    return null;
  }
}

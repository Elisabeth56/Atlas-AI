"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Develop } from "@/components/ui/Develop";
import { Loupe } from "@/components/ui/Loupe";
import { basename } from "@/lib/files";
import type { ArtifactFile, QaFix } from "@/lib/types";

const LINE = 26; // px, matches leading-[26px]
const TOP = 18; // pre padding

const AUTHORS: Record<string, string> = {
  data_engineer: "the data engineer",
  documentation: "the documentation agent",
};

/** One file, line-numbered, developing in line by line. A flagged line is highlighted and put under the loupe. */
export function CodeView({
  file,
  flagged,
  fix,
  canApply,
  onApply,
}: {
  file: ArtifactFile;
  flagged?: number;
  fix?: QaFix;
  canApply: boolean;
  onApply: (fix: QaFix) => Promise<void>;
}) {
  const lines = file.content.replace(/\n$/, "").split("\n");
  const flaggedLine = fix?.line ?? flagged;
  const [busy, setBusy] = useState(false);
  const pre = useRef<HTMLDivElement>(null);

  // bring the flagged line into view inside the code box
  useEffect(() => {
    if (pre.current && flaggedLine) pre.current.scrollTop = scrollFor(flaggedLine);
  }, [file.filename, flaggedLine]);

  return (
    <section className="relative min-w-0 rounded-lg bg-surface-1 hairline" aria-label={file.filename}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-[22px] py-4 font-mono text-[12px] text-ink-3 shadow-[inset_0_-1px_0_var(--line)]">
        <span className="break-all text-ink-2">{file.filename}</span>
        <span>
          developed by {AUTHORS[file.source_agent] ?? file.source_agent} · {lines.length} lines
        </span>
      </div>

      <div ref={pre} className="max-h-[70vh] overflow-auto rounded-b-lg">
        <pre className="m-0 pt-[18px] pb-6 font-mono text-[13px] leading-[26px] text-ink-2">
          <Develop
            key={`${file.filename}:${file.content.length}`}
            stagger={0.04}
            items={lines.map((line, i) => (
              <span
                key={i}
                id={`L${i + 1}`}
                className={`block w-max min-w-full px-[22px] ${i + 1 === flaggedLine ? "bg-critical-wash text-critical" : ""}`}
              >
                <span aria-hidden className={`inline-block w-9 select-none ${i + 1 === flaggedLine ? "" : "text-ink-3/50"}`}>
                  {i + 1}
                </span>
                {line || " "}
              </span>
            ))}
          />
        </pre>
      </div>

      {fix && (
        <Loupe lines={lines} flagged={fix.line} size={180} top={loupeTop(fix.line)} className="right-7 hidden lg:block" />
      )}

      {fix && (
        <div className="mx-[22px] mb-[22px] flex flex-wrap items-center gap-x-5 gap-y-3 rounded-md bg-critical-wash px-4 py-3.5">
          <span className="flex-[1_1_320px] text-small text-ink">
            <span className="font-mono text-[12px] text-critical">Critical · line {fix.line} · </span>
            <code className="font-mono text-[13px]">{fix.column}</code> is tagged PII in DataHub. Hash it or drop it.
          </span>
          {canApply ? (
            <Button
              variant="suggest"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onApply(fix);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Re-checking…" : `Use md5(${fix.column})`}
            </Button>
          ) : (
            <span className="text-[13px] text-ink-3">Fixes apply at the writeback checkpoint.</span>
          )}
        </div>
      )}
      <span className="sr-only">{basename(file.filename)}</span>
    </section>
  );
}

const HEADER = 53; // the file path bar above the code
const LOUPE = 180;

function scrollFor(line: number) {
  return Math.max(0, (line - 6) * LINE);
}

/** The loupe sits level with its line, after the code box has scrolled that line into view. */
function loupeTop(line: number) {
  const lineMiddle = HEADER + TOP + (line - 1) * LINE + LINE / 2 - scrollFor(line);
  return Math.max(HEADER + 8, lineMiddle - LOUPE / 2);
}

import type { ReactNode } from "react";

export type Severity = "critical" | "warning" | "passed";

const look: Record<Severity, { row: string; label: string; word: string }> = {
  critical: { row: "bg-critical-wash text-ink", label: "text-critical", word: "Critical" },
  warning: { row: "bg-surface-2 text-ink-2", label: "text-amber", word: "Warning" },
  passed: { row: "bg-surface-2 text-ink-2", label: "text-moss", word: "Passed" },
};

/** One QA check: status word, check name, and a sentence naming the file and column. */
export function Finding({
  severity,
  name,
  children,
  action,
}: {
  severity: Severity;
  name?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const l = look[severity];
  return (
    <div className={`grid grid-cols-1 items-start gap-1 sm:grid-cols-[84px_minmax(0,1fr)] sm:gap-3 rounded-md px-4 py-3.5 text-small ${l.row}`}>
      <span className={`text-caption leading-[21px] ${l.label}`}>{l.word}</span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="min-w-0 flex-[1_1_280px] [&_code]:font-mono [&_code]:text-[13px]">
          {name && <b className="font-semibold text-ink">{name}. </b>}
          {children}
        </p>
        {action}
      </div>
    </div>
  );
}

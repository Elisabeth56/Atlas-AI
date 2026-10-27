"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ago, describeRun, runTitle, TONE_DOT, TONE_TEXT, type RunTone } from "@/lib/runs";
import type { RunListItem } from "@/lib/types";

type Filter = "all" | "waiting" | "failed";
const FILTERS: Filter[] = ["all", "waiting", "failed"];
const KEY = "atlas.runs.filter";

function matches(filter: Filter, tone: RunTone) {
  return filter === "all" || filter === tone;
}

export function RunsList({ runs, error }: { runs: RunListItem[] | null; error: string | null }) {
  const pathname = usePathname();
  const [filter, setFilter] = useState<Filter>("all");

  // the last filter is remembered per browser
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Filter | null;
      if (saved && FILTERS.includes(saved)) setFilter(saved);
    } catch {}
  }, []);
  const choose = (f: Filter) => {
    setFilter(f);
    try {
      localStorage.setItem(KEY, f);
    } catch {}
  };

  const shown = (runs ?? []).filter((r) => matches(filter, describeRun(r).tone));

  return (
    <nav aria-label="Runs" className="flex min-h-0 flex-col gap-1">
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <span className="text-caption tracking-[0.12em] text-ink-3 uppercase">Runs</span>
        <div role="radiogroup" aria-label="Filter runs" className="flex gap-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="radio"
              aria-checked={filter === f}
              onClick={() => choose(f)}
              className={`rounded-full px-2 py-0.5 text-[11px] transition-colors duration-200 ${
                filter === f ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {runs === null && !error && (
        <div className="flex flex-col gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-2.5 p-2.5">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-surface-2" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="h-3.5 w-4/5 rounded-full bg-surface-2" />
                <span className="h-2.5 w-1/3 rounded-full bg-surface-2" />
              </span>
            </div>
          ))}
        </div>
      )}
      {error && <p className="px-2.5 text-small text-ink-3">Couldn’t load runs. They’ll appear when the API is back.</p>}
      {runs && runs.length === 0 && (
        <p className="px-2.5 text-small text-ink-3">No runs yet. Your first one appears here as it develops.</p>
      )}
      {runs && runs.length > 0 && shown.length === 0 && (
        <p className="px-2.5 text-small text-ink-3">No {filter} runs.</p>
      )}

      <ul className="flex flex-col gap-0.5 overflow-y-auto">
        {shown.map((run) => {
          const { tone, label } = describeRun(run);
          const href = `/agents/${run.id}`;
          const active = pathname.startsWith(href);
          return (
            <li key={run.id}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex gap-2.5 rounded-[12px] p-2.5 transition-colors duration-200 ${
                  active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-1"
                }`}
              >
                <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-small">{runTitle(run.prompt)}</span>
                  <span className={`text-[11px] font-mono ${TONE_TEXT[tone]}`}>
                    {label} · {ago(run.created_at)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

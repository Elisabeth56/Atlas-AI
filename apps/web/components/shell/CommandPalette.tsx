"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { describeRun, runTitle, TONE_DOT } from "@/lib/runs";
import { toggleTheme } from "@/lib/theme";
import type { RunListItem } from "@/lib/types";

interface Command {
  id: string;
  label: string;
  hint?: string;
  dot?: string;
  run: () => void;
}

export function CommandPalette({ open, onClose, runs }: { open: boolean; onClose: () => void; runs: RunListItem[] }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const actions: Command[] = [
      { id: "new", label: "New run", hint: "N", run: go("/new") },
      { id: "theme", label: "Toggle theme", run: () => void toggleTheme() },
    ];
    const jumps: Command[] = runs.map((r) => ({
      id: r.id,
      label: runTitle(r.prompt),
      hint: describeRun(r).label,
      dot: TONE_DOT[describeRun(r).tone],
      run: go(`/agents/${r.id}`),
    }));
    const q = query.trim().toLowerCase();
    return [...actions, ...jumps].filter((c) => !q || c.label.toLowerCase().includes(q));
  }, [runs, query, router]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    requestAnimationFrame(() => input.current?.focus());
  }, [open]);
  useEffect(() => setActive(0), [query]);

  const choose = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, commands.length - 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
    else if (e.key === "Enter") choose(commands[active]);
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-center px-4 pt-[18vh]" onKeyDown={onKey}>
          <motion.div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="relative h-fit w-full max-w-[560px] overflow-hidden rounded-lg bg-surface-1 shadow-card"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 300, damping: 30 }}
          >
            <input
              ref={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Jump to a run or type a command"
              aria-label="Search commands and runs"
              aria-controls="palette-list"
              aria-activedescendant={commands[active] ? `cmd-${commands[active].id}` : undefined}
              className="h-14 w-full bg-transparent px-5 text-body text-ink placeholder:text-ink-3 focus:outline-none"
            />
            <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2 shadow-[inset_0_1px_0_var(--line)]">
              {commands.length === 0 && <li className="px-3 py-3 text-small text-ink-3">Nothing matches “{query}”.</li>}
              {commands.map((c, i) => (
                <li
                  key={c.id}
                  id={`cmd-${c.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(c)}
                  className={`flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 text-small ${
                    i === active ? "bg-surface-2 text-ink" : "text-ink-2"
                  }`}
                >
                  {c.dot && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} />}
                  <span className="grow truncate">{c.label}</span>
                  {c.hint && <span className="shrink-0 font-mono text-[11px] text-ink-3">{c.hint}</span>}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

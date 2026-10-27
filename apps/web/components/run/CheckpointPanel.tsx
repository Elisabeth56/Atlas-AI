"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";

/**
 * The card a checkpoint lives in. On desktop it sits in the run view; below 768px it's a bottom sheet
 * over the run, with a handle that folds it down to its title so the strip and log stay reachable.
 */
export function CheckpointPanel({ title, frame, children }: { title: string; frame: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const [folded, setFolded] = useState(false);

  const head = (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="text-[22px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink md:text-[26px]">{title}</h2>
      <span className="font-mono text-[12px] text-amber">frame {frame} · waiting</span>
    </div>
  );

  return (
    <>
      <section className="hidden rounded-lg bg-surface-1 p-7 hairline md:block">
        {head}
        {children}
      </section>

      {/* phone: bottom sheet */}
      <motion.section
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-20 max-h-[70vh] overflow-y-auto rounded-t-[24px] bg-surface-1 px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))] shadow-card md:hidden"
        initial={reduced ? { opacity: 0 } : { y: "100%" }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        transition={reduced ? { duration: 0.2 } : { type: "spring", stiffness: 300, damping: 30 }}
      >
        <button
          onClick={() => setFolded((f) => !f)}
          aria-expanded={!folded}
          aria-label={folded ? "Show the decision" : "Fold the decision away"}
          className="mx-auto mb-3 flex h-6 w-16 items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-ink-3/40" />
        </button>
        {head}
        {!folded && children}
      </motion.section>
    </>
  );
}

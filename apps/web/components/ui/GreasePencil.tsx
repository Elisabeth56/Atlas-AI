"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// a loose hand-drawn loop that overshoots its start, like a pencil circling a frame
const LOOP = "M30 12 C 80 -4, 136 6, 136 52 C 136 98, 90 110, 56 106 C 16 102, 2 78, 6 48 C 10 22, 40 8, 92 10";

/** Circles what it wraps in safelight. Only frames where a person decides get circled. */
export function GreasePencil({
  active = true,
  delay = 0.3,
  children,
  className = "",
}: {
  active?: boolean;
  delay?: number;
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <span className={`relative inline-block ${className}`}>
      {children}
      {active && (
        <svg
          aria-hidden
          viewBox="0 0 140 110"
          preserveAspectRatio="none"
          className="pointer-events-none absolute -inset-x-[9px] -inset-y-[10px] h-[calc(100%+20px)] w-[calc(100%+18px)] overflow-visible"
        >
          <motion.path
            d={LOOP}
            fill="none"
            stroke="var(--safelight)"
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 1.2, ease: [0.22, 1, 0.36, 1], delay }}
          />
        </svg>
      )}
    </span>
  );
}

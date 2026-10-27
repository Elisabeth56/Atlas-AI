"use client";

import { useEffect, useRef, useState } from "react";

/** A grease-pencil loop that draws itself the first time it scrolls into view. CSS only, so the landing ships no animation library. */
export function Pencil({ d, delay = 0.6 }: { d: string; delay?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const seen = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setDrawn(true);
        seen.disconnect();
      }
    }, { threshold: 0.6 });
    seen.observe(el);
    return () => seen.disconnect();
  }, []);

  return (
    <svg ref={ref} aria-hidden viewBox="0 0 260 200" preserveAspectRatio="none" className="pointer-events-none absolute -inset-x-4 -inset-y-3.5 h-[calc(100%+28px)] w-[calc(100%+32px)] overflow-visible">
      <path
        d={d}
        pathLength={1}
        fill="none"
        stroke="var(--safelight)"
        strokeWidth={3.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={{ animationDelay: `${delay}s` }}
        className={`[stroke-dasharray:1] motion-reduce:[stroke-dashoffset:0] ${drawn ? "motion-safe:animate-[draw_1.4s_cubic-bezier(0.22,1,0.36,1)_both]" : "motion-safe:[stroke-dashoffset:1]"}`}
      />
    </svg>
  );
}

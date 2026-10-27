"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Marks its children for a one-time reveal: `data-in` is "false" until the block scrolls into view, then
 * "true". Server HTML has no attribute, so without JS (or before hydration) everything is simply visible.
 * Children opt in with the `.reveal` / `.ink` classes in globals.css.
 */
export function InView({ children, className = "", threshold = 0.3 }: { children: ReactNode; className?: string; threshold?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"true" | "false" | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.85) return; // already on screen at load: don't hide it
    setState("false");
    const seen = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setState("true");
          seen.disconnect();
        }
      },
      { threshold },
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} data-in={state} className={className}>
      {children}
    </div>
  );
}

/** Runs a timeline once a block is in view: returns how many of `steps` (ms from entry) have passed. */
export function useStepsInView(steps: number[], threshold = 0.4) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(steps.length);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setStep(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const seen = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        seen.disconnect();
        steps.forEach((ms, i) => timers.push(setTimeout(() => setStep(i + 1), ms)));
      },
      { threshold },
    );
    seen.observe(el);
    return () => {
      seen.disconnect();
      timers.forEach(clearTimeout);
    };
    // steps is a constant for each caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);

  return { ref, step };
}

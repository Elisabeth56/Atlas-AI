"use client";

import { useEffect, useRef } from "react";
import { GreasePencil } from "@/components/ui/GreasePencil";
import type { Frame, FrameState } from "@/lib/film";

const HOLES = Array.from({ length: 36 });

const frameLook: Record<FrameState, string> = {
  developed: "bg-surface-1",
  developing: "bg-surface-1",
  // undeveloped frames sit dim and soft until their stage finishes; the transition is the develop
  undeveloped: "bg-[#161513] opacity-55 blur-[1.5px]",
  waiting: "bg-surface-0 shadow-[inset_0_0_0_1px_rgb(217_161_91/0.28)]",
  decided: "bg-surface-0 shadow-[inset_0_0_0_1px_rgb(163_176_114/0.25)]",
  critical: "bg-critical-wash",
  failed: "bg-critical-wash",
};

const dotLook: Record<FrameState, string> = {
  developed: "bg-moss",
  developing: "bg-live motion-safe:animate-[breathe_1.6s_ease-in-out_infinite]",
  undeveloped: "bg-[#4A4842]",
  waiting: "bg-amber",
  decided: "bg-moss",
  critical: "bg-critical",
  failed: "bg-critical",
};

/** The run as a strip of eight frames on film base. Checkpoints are written by hand; the waiting one is circled. */
export function FilmStrip({ frames }: { frames: Frame[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const currentIndex = frames.findIndex((f) => f.state === "waiting" || f.state === "developing" || f.state === "failed");

  // on narrow screens keep the frame that's happening now in view
  useEffect(() => {
    const box = scroller.current;
    const frame = box?.querySelectorAll("li")[currentIndex];
    if (!box || !frame || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: frame.offsetLeft - (box.clientWidth - frame.clientWidth) / 2, behavior: "smooth" });
  }, [currentIndex]);

  return (
    <div ref={scroller} data-theme="dark" className="overflow-x-auto rounded-[20px]">
      <div className="relative min-w-[940px] rounded-[20px] bg-film px-[18px] py-[26px]">
        <Sprockets className="top-2" />
        <Sprockets className="bottom-2" />
        <ol aria-label="Run progress" className="grid grid-cols-8 gap-2">
          {frames.map((f, i) => (
            <li
              key={f.number}
              aria-label={`${f.checkpoint ? "Your decision" : f.name}, ${f.meta}`}
              aria-current={i === currentIndex ? "step" : undefined}
              className={`relative flex min-h-24 flex-col justify-between gap-2.5 rounded-sm p-3 transition-[filter,opacity,background-color] duration-[900ms] ease-develop ${frameLook[f.state]}`}
            >
              <span className="flex items-center justify-between" aria-hidden>
                <span className="font-mono text-[10px] tracking-[0.12em] text-ink-3">▸ {f.number}</span>
                <span className={`h-[7px] w-[7px] rounded-full ${dotLook[f.state]}`} />
              </span>
              <span className="flex flex-col gap-0.5" aria-hidden>
                {f.checkpoint ? (
                  <span className={`font-hand text-[20px] leading-6 ${f.state === "waiting" ? "text-amber" : "text-moss"}`}>you</span>
                ) : (
                  <span className="text-small font-semibold text-ink">{f.name}</span>
                )}
                <span
                  className={`font-mono text-[11px] ${f.state === "critical" || f.state === "failed" ? "text-critical" : "text-ink-3"}`}
                >
                  {f.meta}
                </span>
              </span>
              {f.state === "waiting" && (
                <GreasePencil className="!absolute inset-0">
                  <span className="block h-full w-full" />
                </GreasePencil>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Sprockets({ className }: { className: string }) {
  return (
    <div aria-hidden className={`absolute inset-x-3.5 flex justify-between ${className}`}>
      {HOLES.map((_, i) => (
        <span key={i} className="h-[7px] w-[11px] rounded-[2px] bg-surface-1" />
      ))}
    </div>
  );
}

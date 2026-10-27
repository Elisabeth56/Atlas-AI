"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Photo } from "@/components/ui/Photo";

const REQUEST = "Build a customer revenue pipeline from raw Stripe and Postgres events";
const SOURCES = [
  ["raw.stripe_payments", "0.94"],
  ["public.customers", "0.91"],
  ["public.orders", "0.89"],
];

/**
 * The hero: the request types itself, then sources → staging → mart develop in, it pauses at the
 * checkpoint, and it starts again. First paint and reduced motion show the finished frame, so the page
 * never opens on an empty diagram.
 */
export function HeroDevelop() {
  const [phase, setPhase] = useState(4);
  const [take, setTake] = useState(0);

  // one cycle: type the request (in <Typed>), then develop the four phases, rest, repeat
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = setTimeout(() => {
      setPhase(0);
      setTake(1);
    }, 6000); // first read the finished frame; the loop is a second look, not the first
    return () => clearTimeout(start);
  }, []);

  useEffect(() => {
    if (take === 0 || phase === 0) return;
    const next = setTimeout(
      () => {
        if (phase < 4) setPhase(phase + 1);
        else {
          setPhase(0);
          setTake((t) => t + 1);
        }
      },
      phase < 4 ? 1100 : 6000,
    );
    return () => clearTimeout(next);
  }, [phase, take]);

  const nd = (p: number) =>
    `transition-[filter,opacity,transform] duration-[900ms] ease-develop ${phase >= p ? "" : "blur-[8px] opacity-[0.12] translate-y-1.5"}`;
  const ln = (p: number) => `transition-[stroke-dashoffset] duration-[1100ms] ease-develop ${phase >= p ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:320]"}`;

  return (
    <section className="flex flex-col gap-11 pt-10 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="text-[clamp(52px,8.6vw,120px)] leading-[0.94] font-semibold tracking-[-0.045em] text-ink">
          Ask for a pipeline.
          <br />
          <span className={`transition-colors duration-[1200ms] ease-develop ${phase >= 4 ? "text-ink" : "text-ink-3"}`}>
            Get dbt you can <span className="font-hand font-normal tracking-normal text-safelight">check.</span>
          </span>
        </h1>
        <p className="mb-2.5 max-w-[320px] text-body text-ink-2">
          Atlas finds your sources in DataHub, writes the models, tests and docs against their real columns, then stops and asks you.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[32px] bg-surface-1 shadow-[inset_0_0_0_1px_var(--line),0_30px_80px_rgb(0_0_0/0.35)]">
        <Photo
          src="/images/darkroom-tray.webp"
          alt=""
          priority
          drift
          position="50% 60%"
          sizes="(min-width: 1240px) 1192px, 100vw"
          quality={55}
          className="!absolute inset-0 rounded-none opacity-[0.28]"
        />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(28_27_24/0.55)_0%,rgb(28_27_24/0.2)_45%,rgb(28_27_24/0.75)_100%)]" />
        <div aria-hidden className="safelight-glow absolute inset-0" />

        <div className="relative flex flex-col gap-[26px] p-5 sm:p-[26px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] tracking-[0.12em] text-ink-3">REQUEST</span>
            <div className="flex h-14 min-w-0 flex-[1_1_420px] items-center rounded-[18px] bg-surface-0 px-5 hairline">
              <span className="sr-only">Example request: {REQUEST}</span>
              <Typed take={take} onDone={() => setPhase(1)} />
              <span aria-hidden className="ml-0.5 inline-block h-[1.1em] w-0.5 bg-safelight motion-safe:animate-[blink_1s_steps(1)_infinite]" />
            </div>
            <Link
              href="/new"
              className="inline-flex h-14 items-center gap-2.5 rounded-[18px] bg-safelight px-[22px] text-[16px] font-semibold text-action-ink hover:brightness-105"
            >
              Develop <span className="font-mono text-[13px]" aria-hidden>↵</span>
            </Link>
          </div>

          <div aria-label="Sources, staging models and the mart Atlas develops from that request" role="img" className="relative grid min-h-[300px] items-center gap-6 md:grid-cols-[1.1fr_1fr_1fr] md:gap-0">
            <svg aria-hidden viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-0 hidden h-full w-full md:block">
              <g fill="none" stroke="var(--moss-deep)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray={320}>
                <path className={ln(2)} d="M290 60 C 360 60, 360 95, 440 95" />
                <path className={ln(2)} d="M290 150 C 360 150, 360 205, 440 205" />
                <path className={ln(2)} d="M290 240 C 360 240, 360 205, 440 205" />
                <path className={ln(3)} d="M630 95 C 700 95, 700 150, 760 150" />
                <path className={ln(3)} d="M630 205 C 700 205, 700 150, 760 150" />
              </g>
            </svg>
            <div className="relative flex flex-col gap-3.5 md:pr-6">
              {SOURCES.map(([name, conf], i) => (
                <div key={name} style={{ transitionDelay: `${i * 90}ms` }} className={`flex items-center gap-3 rounded-[14px] bg-surface-2 px-4 py-3.5 font-mono text-[13px] text-ink ${nd(1)}`}>
                  <span className="h-2 w-2 rounded-full bg-moss" />
                  <span className="flex-1">{name}</span>
                  <span className="text-[11px] text-ink-3">{conf}</span>
                </div>
              ))}
            </div>
            <div className="relative flex flex-col gap-3.5 md:gap-[70px] md:px-6">
              {["stg_stripe_payments", "stg_postgres_customers"].map((m, i) => (
                <div key={m} style={{ transitionDelay: `${i * 120}ms` }} className={`rounded-[14px] bg-surface-1 px-4 py-3.5 font-mono text-[13px] text-ink shadow-[inset_0_0_0_1px_rgb(163_176_114/0.35)] ${nd(2)}`}>
                  {m}
                </div>
              ))}
            </div>
            <div className="relative flex flex-col gap-3 md:pl-6">
              <div className={`rounded-[18px] bg-safelight p-[18px] text-action-ink ${nd(3)}`}>
                <span className="font-mono text-[11px] opacity-70">mart</span>
                <p className="mt-1 font-mono text-[15px]">fct_customer_revenue</p>
              </div>
              <div className={`flex flex-wrap gap-2 ${nd(4)}`}>
                <span className="rounded-full bg-critical-wash px-2.5 py-1 text-[12px] text-critical">QA · 1 critical</span>
                <span className="rounded-full bg-amber/15 px-2.5 py-1 text-[12px] text-amber">waiting for you</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-[18px] font-mono text-[12px] text-ink-3 shadow-[inset_0_1px_0_var(--line)]">
            <span className={nd(1)}>● 3 sources matched</span>
            <span className={nd(2)}>● 2 staging models</span>
            <span className={nd(3)}>● 1 mart · 6 files</span>
            <span className={`text-amber ${nd(4)}`}>● paused at checkpoint 2</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The request typing itself out. Take 0 is the finished text, so first paint is never empty. */
function Typed({ take, onDone }: { take: number; onDone: () => void }) {
  const [shown, setShown] = useState(REQUEST.length);
  useEffect(() => {
    if (take === 0) return;
    let i = 0;
    setShown(0);
    const ticker = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= REQUEST.length) {
        clearInterval(ticker);
        onDone();
      }
    }, 34);
    return () => clearInterval(ticker);
    // onDone is stable for a take
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [take]);
  return (
    <span aria-hidden className="truncate text-[16px] text-ink sm:text-[18px]">
      {REQUEST.slice(0, shown)}
    </span>
  );
}

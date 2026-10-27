"use client";

import type { CSSProperties } from "react";
import { useStepsInView } from "@/components/landing/InView";
import { Loupe } from "@/components/ui/Loupe";
import { Photo } from "@/components/ui/Photo";

const STG = ["select", "    payment_id,", "    customer_id,", "    amount_cents / 100.0 as amount_usd,", "    currency,", "    card_last4,", "    created_at", "from source"];
const FLAGGED = 5; // index of card_last4 in STG; line 10 of the file

const CHECKS: { name: string; verdict: string; critical?: boolean }[] = [
  { name: "SQL parses", verdict: "passed" },
  { name: "Every column resolves to DataHub", verdict: "passed" },
  { name: "PII stays masked", verdict: "critical · line 10", critical: true },
  { name: "Keys have unique and not_null tests", verdict: "passed" },
];

// ms after the section comes into view. Step 1 develops the code, steps 2-5 resolve the checks in
// order (the PII check puts the line under the loupe), step 6 writes the margin note.
const TIMELINE = [0, 900, 1300, 1700, 2300, 2700];

/** QA doing its job on screen: the file develops, checks resolve one by one, the leak lands under the loupe. */
export function QaSection() {
  const { ref, step } = useStepsInView(TIMELINE);
  const flagged = step >= 4;

  return (
    <section ref={ref} id="qa" className="grid scroll-mt-6 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-14 pt-24 md:pt-[168px]">
      <div className="flex flex-col gap-6">
        <h2 className={`text-[clamp(36px,4.4vw,56px)] leading-none font-semibold tracking-[-0.035em] text-ink transition-[filter,opacity] duration-[900ms] ease-develop ${step >= 1 ? "" : "opacity-15 blur-[8px]"}`}>
          Every column, under the loupe.
        </h2>
        <p className="max-w-[440px] text-body text-ink-2">
          QA parses each model and traces every column back to a dataset in your catalog. A column it can’t trace, or a PII column left unmasked, stops the writeback and names the line.
        </p>
        <ul aria-label="QA checks" className="flex flex-col gap-0.5 overflow-hidden rounded-[18px]">
          {CHECKS.map((c, i) => {
            // checks resolve in order; the last one waits for the PII finding
            const done = step >= (i < 3 ? i + 2 : 5);
            const red = done && c.critical;
            return (
              <li
                key={c.name}
                className={`flex justify-between gap-4 px-[18px] py-3.5 text-small text-ink transition-colors duration-500 ${red ? "bg-critical-wash" : "bg-surface-1"}`}
              >
                <span>{c.name}</span>
                {done ? (
                  <span className={`font-mono text-[12px] ${c.critical ? "text-critical" : "text-moss"}`}>{c.verdict}</span>
                ) : (
                  <span className="flex items-center gap-2 font-mono text-[12px] text-ink-3">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-live motion-safe:animate-[breathe_1.2s_ease-in-out_infinite]" />
                    checking…
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative px-4 py-14 sm:pr-12 sm:pl-10">
        <Photo src="/images/schema-desk.webp" alt="" drift className="!absolute inset-0 rounded-[32px] opacity-70" sizes="(min-width: 768px) 50vw, 100vw" />
        <div className="relative overflow-x-auto rounded-lg bg-surface-1/95 py-[22px] font-mono text-[13px] leading-[26px] text-ink-3 hairline">
          <div className="px-[22px] pb-3 text-[11px] text-ink-3">models/staging/stg_stripe_payments.sql</div>
          {STG.map((line, i) => (
            <div
              key={i}
              style={{ "--d": `${i * 60}ms` } as CSSProperties}
              className={`px-[22px] whitespace-pre transition-[filter,opacity,transform,background-color,color] duration-[900ms] ease-develop [transition-delay:var(--d)] ${
                step >= 1 ? "" : "translate-y-1 opacity-15 blur-[6px]"
              } ${i === FLAGGED && flagged ? "bg-critical-wash text-critical" : ""}`}
            >
              <span className={`inline-block w-8 ${i === FLAGGED && flagged ? "" : "text-ink-3/50"}`}>{i + 5}</span>
              {line}
            </div>
          ))}
        </div>

        {/* the loupe slides onto the flagged line the moment QA flags it */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 hidden transition-[opacity,transform] duration-700 ease-develop sm:block ${
            flagged ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0"
          }`}
        >
          <Loupe lines={STG} flagged={FLAGGED + 1} size={220} top={96} className="right-3" />
        </div>
        <span
          aria-hidden
          className={`absolute top-[336px] right-[30px] hidden rotate-[-4deg] font-hand text-[22px] text-critical transition-[opacity,transform] duration-700 ease-develop [text-shadow:0_2px_12px_rgb(0_0_0/0.8)] sm:block ${
            step >= 6 ? "opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          mask this before it ships
        </span>
      </div>
    </section>
  );
}

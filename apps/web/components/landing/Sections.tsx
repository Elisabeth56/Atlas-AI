import type { ReactNode } from "react";
import { Photo } from "@/components/ui/Photo";
import { InView } from "@/components/landing/InView";
import { Pencil } from "@/components/landing/Pencil";

const SPROCKETS = Array.from({ length: 40 });
const LOOP_A = "M40 26 C 120 -2, 236 10, 248 70 C 262 140, 196 196, 110 192 C 30 188, 2 140, 14 82 C 22 44, 60 22, 128 18";
const LOOP_B = "M60 20 C 150 0, 250 30, 246 96 C 242 160, 170 198, 100 190 C 34 182, 6 136, 18 80 C 28 40, 80 18, 150 22";

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="text-[clamp(36px,4.4vw,56px)] leading-none font-semibold tracking-[-0.035em] text-ink">{children}</h2>;
}

function Frame({
  n,
  children,
  caption,
  you,
  loop,
  delay,
}: {
  n: string;
  children: ReactNode;
  caption: ReactNode;
  you?: boolean;
  loop?: string;
  delay: number;
}) {
  return (
    <figure className="reveal relative flex flex-col gap-2.5" style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3">▸ {n}</span>
      <div className="relative flex aspect-[4/3] flex-col justify-center gap-2 rounded-[10px] bg-surface-1 p-[18px]">
        {children}
        {/* the circle goes on once its frame has developed */}
        {loop && <Pencil d={loop} delay={(delay + 900) / 1000} />}
      </div>
      <figcaption className="text-small text-ink-2">{caption}</figcaption>
      {you && (
        <span aria-hidden className="absolute -top-[18px] right-0 rotate-[-5deg] font-hand text-[24px] text-safelight">
          you decide
        </span>
      )}
    </figure>
  );
}

export function ContactSheet() {
  return (
    <section id="sheet" className="scroll-mt-6 pt-24 md:pt-[168px]">
     <InView className="flex flex-col gap-10" threshold={0.2}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Heading>
          <span className="reveal inline-block">Four frames.</span>
          <br />
          <span className="reveal relative inline-block text-ink-3" style={{ "--d": "150ms" } as React.CSSProperties}>
            You circle <span className="relative inline-block text-ink">
              two.
              <svg aria-hidden viewBox="0 0 120 14" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-[110%] overflow-visible">
                <path
                  className="ink"
                  style={{ "--d": "700ms" } as React.CSSProperties}
                  pathLength={1}
                  d="M3 9 C 30 3, 70 4, 117 7"
                  fill="none"
                  stroke="var(--safelight)"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </span>
        </Heading>
        <div className="flex items-end gap-6">
          <p className="reveal max-w-[340px] text-body text-ink-2" style={{ "--d": "300ms" } as React.CSSProperties}>
            Photographers mark the frames worth printing with a grease pencil. Atlas does the shooting; you mark the two decisions that matter.
          </p>
          <div className="reveal hidden shrink-0 sm:block" style={{ "--d": "450ms" } as React.CSSProperties}>
            <Photo src="/images/negatives.webp" alt="A strip of negatives drying under a warm safelight" drift className="h-[210px] w-[168px] rounded-[22px]" sizes="168px" />
          </div>
        </div>
      </div>

      <div data-theme="dark" className="relative rounded-[28px] bg-film px-5 py-10 sm:px-7">
        {["top-3", "bottom-3"].map((pos) => (
          <div key={pos} aria-hidden className={`absolute inset-x-5 flex justify-between overflow-hidden ${pos}`}>
            {SPROCKETS.map((_, i) => <span key={i} className="h-[9px] w-3.5 shrink-0 rounded-[3px] bg-surface-1" />)}
          </div>
        ))}
        <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <Frame n="01A" delay={600} caption={<><b className="font-semibold text-ink">Describe it.</b> One sentence, in your words.</>}>
            <span className="font-mono text-[10px] text-ink-3">REQUEST</span>
            <span className="rounded-[10px] bg-surface-0 p-3 text-[13px] leading-[1.4] text-ink">
              customer revenue from Stripe and Postgres events<span className="text-safelight">|</span>
            </span>
          </Frame>
          <Frame n="02A" delay={850} you loop={LOOP_A} caption={<><b className="font-semibold text-ink">Confirm the sources.</b> Keep the matches or start fresh.</>}>
            {["raw.stripe_payments", "public.customers", "public.orders"].map((s) => (
              <span key={s} className="rounded-sm bg-surface-2 px-2.5 py-2 font-mono text-[11px] text-ink">● {s}</span>
            ))}
          </Frame>
          <Frame n="03A" delay={1100} caption={<><b className="font-semibold text-ink">Review the output.</b> Code checks the code.</>}>
            <span className="flex flex-col font-mono text-[10px] leading-[1.7] text-ink-2">
              <span>select payment_id,</span>
              <span>  amount_cents / 100.0,</span>
              <span className="text-critical">  card_last4,</span>
              <span>{"from {{ source('raw', …) }}"}</span>
            </span>
            <span className="self-start rounded-full bg-critical-wash px-2 py-0.5 font-mono text-[10px] text-critical">QA · 1 critical</span>
          </Frame>
          <Frame n="04A" delay={1350} you loop={LOOP_B} caption={<><b className="font-semibold text-ink">Write back, or don’t.</b> DataHub only changes when you say so.</>}>
            <svg aria-hidden width="100%" height="70%" viewBox="0 0 200 100">
              <g fill="none" stroke="var(--moss-deep)" strokeWidth={1.5}>
                <path d="M10 15 C 80 15, 100 50, 170 50" />
                <path d="M10 50 L 170 50" />
                <path d="M10 85 C 80 85, 100 50, 170 50" />
              </g>
              <g fill="var(--moss)"><circle cx={10} cy={15} r={4} /><circle cx={10} cy={50} r={4} /><circle cx={10} cy={85} r={4} /></g>
              <circle cx={176} cy={50} r={8} fill="var(--safelight)" />
            </svg>
          </Frame>
        </div>
      </div>
     </InView>
    </section>
  );
}

const AGENTS: { name: string; does: string; you?: boolean; code?: boolean }[] = [
  { name: "Planner", does: "LLM" },
  { name: "Metadata analyst", does: "DataHub + LLM" },
  { name: "you", does: "sources", you: true },
  { name: "Data engineer", does: "LLM" },
  { name: "QA", does: "code", code: true },
  { name: "Documentation", does: "LLM" },
  { name: "you", does: "writeback", you: true },
  { name: "Writeback", does: "code", code: true },
];

export function Pipeline() {
  return (
    <section id="pipeline" className="flex scroll-mt-6 flex-col gap-12 pt-24 md:pt-[168px]">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Heading>Six agents on one line.</Heading>
        <p className="max-w-[360px] text-body text-ink-2">
          Four use a model. The two that judge and write are plain code, so their answer never changes from run to run.
        </p>
      </div>
      <div className="relative overflow-hidden rounded-[32px] bg-surface-1 px-5 pt-16 pb-12 hairline sm:px-10">
        <Photo
          src="/images/fibre-lineage.webp"
          alt=""
          sizes="(min-width: 768px) 60vw, 100vw"
          className="!absolute inset-y-0 right-0 w-[62%] rounded-none opacity-55 [mask-image:linear-gradient(90deg,transparent,#000_45%)]"
        />
        <div className="relative overflow-x-auto">
          <ol aria-label="The pipeline, in order" className="relative grid min-w-[900px] grid-cols-8 gap-2.5 text-center">
            <span aria-hidden className="absolute inset-x-[4%] top-[15px] h-0.5 rounded-sm bg-[#3a3833]">
              <span className="absolute -top-1 left-1/2 -ml-[5px] h-2.5 w-2.5 rounded-full bg-safelight shadow-[0_0_18px_4px_rgb(207_218_168/0.45)] motion-safe:left-0 motion-safe:animate-[travel_5s_cubic-bezier(0.45,0,0.2,1)_infinite]" />
            </span>
            {AGENTS.map((a, i) => (
              <li key={i} className="relative flex flex-col items-center gap-3.5">
                <span
                  className={`h-8 w-8 rounded-full ${
                    a.you ? "bg-surface-0 shadow-[0_0_0_5px_rgb(217_161_91/0.14),inset_0_0_0_1.5px_var(--amber)]" : a.code ? "bg-moss" : "bg-surface-2 shadow-[inset_0_0_0_1.5px_var(--moss)]"
                  }`}
                />
                {a.you ? (
                  <span className="font-hand text-[21px] leading-none text-amber">you</span>
                ) : (
                  <span className="text-[15px] font-semibold text-ink">{a.name}</span>
                )}
                <span className={`font-mono text-[11px] ${a.you ? "text-amber" : a.code ? "text-moss" : "text-ink-3"}`}>{a.does}</span>
              </li>
            ))}
          </ol>
        </div>
        <dl className="relative mt-14 grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-px overflow-hidden rounded-[20px] bg-line">
          {[
            ["5", "deterministic QA checks"],
            ["3", "free model providers, in fallback order"],
            ["2", "places it waits for you"],
            ["0", "rows of your data it touches"],
          ].map(([n, what]) => (
            <div key={what} className="flex flex-col-reverse bg-surface-1 px-[22px] py-5">
              <dt className="mt-1 text-[13px] text-ink-3">{what}</dt>
              <dd className="text-[40px] font-semibold tracking-[-0.03em] text-ink">{n}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "Does Atlas run the SQL it writes?",
    a: "No. It generates files and checks them statically. Nothing touches your warehouse, and the only thing it can write is metadata in DataHub, after you approve.",
  },
  {
    q: "What does it need from me?",
    a: "A sentence describing the pipeline, and two decisions: which sources to trust and whether to write back. The demo runs against a sample catalog; run Atlas yourself with your DataHub URL to ground it in your own.",
  },
  {
    q: "Which models does it use?",
    a: "Free tiers, tried in order: Groq (Llama 3.3 70B), Cerebras (gpt-oss-120b), then Gemini 3.5 Flash-Lite. When one is rate-limited the next takes the call, and the run log says so.",
  },
  {
    q: "What if the output is wrong?",
    a: "QA blocks the mistakes that matter most: columns your catalog doesn’t have and PII left unmasked. You can apply its fix, retry a step, or skip writeback and keep the files. Nothing reaches DataHub until you approve it.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="grid scroll-mt-6 grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-10 pt-24 md:pt-[168px]">
      <Heading>
        Before you
        <br />
        run it
      </Heading>
      <div className="flex flex-col">
        {FAQ.map((item, i) => (
          <details key={item.q} open={i === 0} className="group py-[22px] shadow-[inset_0_1px_0_var(--line)] last:shadow-[inset_0_1px_0_var(--line),inset_0_-1px_0_var(--line)]">
            <summary className="flex cursor-pointer list-none justify-between gap-4 text-[18px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden className="text-ink-3 group-open:hidden">+</span>
              <span aria-hidden className="hidden text-ink-3 group-open:inline">−</span>
            </summary>
            <p className="mt-2.5 max-w-[560px] text-[15px] leading-[1.6] text-ink-2">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Colophon() {
  return (
    <footer className="relative pt-[120px]">
      <div className="relative z-10 grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-8">
        <div className="flex flex-col gap-2.5 text-small">
          <span className="font-mono text-[11px] tracking-[0.12em] text-ink-3">PRODUCT</span>
          <a href="#sheet" className="text-ink-2 hover:text-ink">Contact sheet</a>
          <a href="#pipeline" className="text-ink-2 hover:text-ink">Pipeline</a>
          <a href="/new" className="text-ink-2 hover:text-ink">Demo run</a>
        </div>
        <div className="flex flex-col gap-2.5 text-small">
          <span className="font-mono text-[11px] tracking-[0.12em] text-ink-3">BUILD</span>
          <a href="https://github.com/Elisabeth56/Atlas-AI" className="text-ink-2 hover:text-ink">Source on GitHub</a>
          <a href="https://github.com/Elisabeth56/Atlas-AI/tree/main/docs/decisions" className="text-ink-2 hover:text-ink">Decision records</a>
        </div>
        <p className="max-w-[340px] text-small leading-[1.6] text-ink-3">
          Set in Hanken Grotesk and JetBrains Mono. Grounded in DataHub, written as dbt, checked by code. Developed by Elisabeth Nnamani.
        </p>
        <div className="self-start justify-self-start rotate-[-3deg] rounded-[10px] border-[1.5px] border-dashed border-ink-3/70 px-[18px] py-3.5 font-mono text-[11px] leading-[1.7] tracking-[0.08em] text-ink-3 sm:justify-self-end">
          PRINT NO. 001
          <br />
          ATLAS · OCT 2026
          <br />
          FIXED · WASHED · DRIED
        </div>
      </div>
      {/* the wordmark set like a print's back stamp: decoration, so an image rather than text */}
      <svg aria-hidden viewBox="0 0 1000 250" className="mt-[72px] -mb-[0.5%] block w-full select-none">
        <text x="500" y="232" textAnchor="middle" fill="var(--surface-1)" fontSize="330" fontWeight={600} letterSpacing="-20">
          Atlas
        </text>
      </svg>
    </footer>
  );
}

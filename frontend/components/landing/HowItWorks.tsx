import { Eyebrow } from "@/components/ui/Eyebrow";

const steps = [
  {
    n: "01",
    title: "Connect and map",
    body: "Atlas reads your warehouse metadata, orchestrator history and repository to build a live map of every table, job and dependency.",
    code: "atlas connect --warehouse sn…",
    active: false,
  },
  {
    n: "02",
    title: "Set the guardrails",
    body: "Define budgets, protected datasets, approval rules and SLAs as policy. Agents can only act inside the boundaries you sign off.",
    code: "policy: require_review(schem…",
    active: true,
  },
  {
    n: "03",
    title: "Agents plan and build",
    body: "Work arrives as an explicit plan: what changes, why, expected cost and blast radius. Approve once and the fleet executes.",
    code: "plan → dry-run → test → pull…",
    active: false,
  },
  {
    n: "04",
    title: "Operate and improve",
    body: "Atlas keeps watching after merge — repairing failures, tightening contracts and reclaiming spend with every run.",
    code: "mean time to repair: 3m 12s",
    active: false,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-border-hairline bg-bg-alt py-24">
      <div className="mx-auto max-w-[1280px] px-6 text-center lg:px-10">
        <div className="flex justify-center">
          <Eyebrow>How it works</Eyebrow>
        </div>
        <h2 className="mx-auto mt-6 max-w-2xl text-[36px] font-bold leading-[1.15] tracking-tight text-text-heading sm:text-[44px]">
          From connection to autonomy in four moves
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-text-body">
          No rip-and-replace. Atlas starts read-only, earns trust on low-risk
          work, then takes on more of the pipeline as your guardrails allow.
        </p>

        <div className="mt-14 grid grid-cols-1 gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div
              key={s.n}
              className={`flex flex-col rounded-2xl border p-6 ${
                s.active
                  ? "border-accent bg-bg-card"
                  : "border-border-hairline bg-bg-card/60"
              }`}
            >
              <span className="font-mono-atlas text-[13px] text-accent">{s.n}</span>
              <h3 className="mt-4 text-[17px] font-semibold text-text-heading">{s.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-text-body">{s.body}</p>
              <div className="mt-5 truncate rounded-lg border border-border-hairline bg-bg-base px-3 py-2 font-mono-atlas text-[12px] text-text-body-strong">
                {s.code}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

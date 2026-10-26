import { Eyebrow } from "@/components/ui/Eyebrow";

const steps = [
  {
    n: "01",
    title: "Describe it",
    body: "Write the pipeline you want in a sentence, like a customer revenue model from raw Stripe and Postgres events.",
    code: "\"customer revenue from stripe…\"",
    active: false,
  },
  {
    n: "02",
    title: "Confirm the sources",
    body: "Atlas shows the DataHub datasets it matched and why. Accept them, or start fresh without catalog grounding.",
    code: "matched: raw.stripe_payments…",
    active: true,
  },
  {
    n: "03",
    title: "Review the output",
    body: "Models, SQL, tests and docs arrive with a QA report. A critical finding, like an unmasked PII column, is called out by name.",
    code: "qa: 5 checks · 1 critical",
    active: false,
  },
  {
    n: "04",
    title: "Write back, or don't",
    body: "Approve to add docs and lineage to DataHub, or skip and keep the artifacts. Either way the files are yours.",
    code: "writeback: approved",
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
          From a sentence to reviewed dbt in four steps
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-text-body">
          Atlas does the typing. You make the two calls that matter: which
          sources to trust, and whether the result goes back to the catalog.
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

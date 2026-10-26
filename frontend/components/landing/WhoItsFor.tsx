import { Building2, LineChart, ScanEye } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const cards = [
  {
    icon: LineChart,
    title: "Analytics engineers",
    body: "Skip the first draft. Get staging models, a mart, tests and docs for a new source in minutes, then edit from there.",
    tags: ["Model scaffolding", "Test generation", "Docs from the catalog"],
  },
  {
    icon: Building2,
    title: "Small data teams",
    body: "Keep DataHub current as you build. Approved runs add documentation and lineage, so the catalog doesn't fall behind the code.",
    tags: ["Lineage writeback", "Owner-aware docs", "Reviewed changes"],
  },
  {
    icon: ScanEye,
    title: "Teams with sensitive data",
    body: "QA flags columns DataHub tags as PII when they reach a model unmasked, and blocks writeback until you deal with them.",
    tags: ["PII checks", "Deterministic QA", "Approval gates"],
  },
];

export function WhoItsFor() {
  return (
    <section id="use-cases" className="mx-auto max-w-[1280px] px-6 py-24 lg:px-10">
      <Eyebrow>Who it&apos;s for</Eyebrow>
      <h2 className="mt-6 max-w-xl text-[36px] font-bold leading-[1.15] tracking-tight text-text-heading sm:text-[44px]">
        For people who build on top of a catalog
      </h2>
      <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-text-body">
        Atlas reads from DataHub and writes dbt. If your team uses both, it
        saves you the boilerplate between them.
      </p>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="card-atlas flex flex-col p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent-dim-border bg-accent-dim text-accent">
              <c.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <h3 className="mt-5 text-[17px] font-semibold text-text-heading">{c.title}</h3>
            <p className="mt-2.5 text-[14px] leading-relaxed text-text-body">{c.body}</p>
            <ul className="mt-5 space-y-2.5 border-t border-border-hairline pt-4">
              {c.tags.map((t) => (
                <li key={t} className="flex items-start gap-2 text-[13px] text-text-body-strong">
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

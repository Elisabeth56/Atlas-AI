import { ShieldCheck, Database, ListChecks, FileCode2 } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const features = [
  {
    icon: ShieldCheck,
    title: "You approve twice",
    body: "Review the datasets Atlas matched before it writes code, and review the output before anything goes back to DataHub.",
  },
  {
    icon: Database,
    title: "Grounded in your catalog",
    body: "Models are written against the schemas DataHub returns, and the run records which datasets it used and why.",
  },
  {
    icon: ListChecks,
    title: "Checks that don't guess",
    body: "QA is deterministic code. The same output gets the same verdict every time, with the failing file and column named.",
  },
  {
    icon: FileCode2,
    title: "Plain dbt out",
    body: "Staging and mart models, tests in schema.yml, an analysis query and markdown docs, ready to drop into a dbt project.",
  },
];

export function WhyAtlas() {
  return (
    <section className="mx-auto max-w-[1280px] px-6 py-24 lg:px-10">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <Eyebrow>Why Atlas AI</Eyebrow>
          <h2 className="mt-6 text-[36px] font-bold leading-[1.15] tracking-tight text-text-heading sm:text-[42px]">
            Generated code that shows its working
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-text-body">
            Every run keeps a record of the datasets it matched, the checks
            it ran and what it wants to write back, so you can see why the
            code looks the way it does.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="card-atlas p-6">
              <f.icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
              <h3 className="mt-4 text-[16px] font-semibold text-text-heading">{f.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-text-body">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

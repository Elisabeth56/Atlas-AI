import Link from "next/link";
import { ArrowRight, Play, ShieldCheck } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const dataHubPoints = [
  {
    label: "No guessed schemas",
    body: "Generated SQL is checked against the columns DataHub records for each source dataset.",
  },
  {
    label: "No guessed owners",
    body: "Documentation names the owners DataHub has on record, not ones a model made up.",
  },
  {
    label: "No guessed lineage",
    body: "Approved runs write lineage from each source to the model Atlas built back into DataHub.",
  },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "linear-gradient(to bottom, black, transparent 85%)",
        }}
      />

      <div className="relative mx-auto max-w-[800px] px-6 pt-20 pb-16 text-center lg:px-10 lg:pt-28">
        <div className="flex justify-center">
          <Eyebrow>Data engineering from a sentence</Eyebrow>
        </div>
        <h1 className="mx-auto mt-6 text-[44px] font-bold leading-[1.08] tracking-tight text-text-heading sm:text-[56px] lg:text-[64px]">
          Ask for a pipeline.{" "}
          <span className="text-accent">Get dbt you can check.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-[16px] leading-relaxed text-text-body">
          Describe the pipeline you need. Atlas finds the source datasets in
          DataHub and writes the dbt models, SQL, tests and docs against
          their real columns.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/demo" className="btn-primary">
            Try the demo <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/agents" className="btn-secondary">
            <Play className="h-3.5 w-3.5" /> Watch a run
          </Link>
        </div>

        <p className="mx-auto mt-6 flex items-center justify-center gap-2 text-[13px] text-text-muted">
          <ShieldCheck className="h-4 w-4 text-accent" />
          Nothing is written back to DataHub until you approve it
        </p>

      </div>

      <div className="border-y border-border-hairline bg-bg-alt py-16">
        <div className="mx-auto max-w-[900px] px-6 text-center lg:px-10">
          <p className="font-mono-atlas text-[11px] uppercase tracking-[0.15em] text-accent">
            Why DataHub
          </p>
          <h2 className="mx-auto mt-4 max-w-xl text-[26px] font-bold leading-[1.25] tracking-tight text-text-heading sm:text-[30px]">
            Agents are only as trustworthy as their metadata
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-text-body">
            A model writing SQL from memory will invent column names. Atlas
            looks up each dataset's schema, owners and tags in DataHub first,
            and writes against what it finds.
          </p>

          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-8 text-left sm:grid-cols-3">
            {dataHubPoints.map((p) => (
              <div key={p.label} className="border-t border-accent-dim-border pt-4">
                <p className="text-[14px] font-semibold text-text-heading">{p.label}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-text-body">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </section>
  );
}

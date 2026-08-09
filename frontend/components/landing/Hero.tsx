import Link from "next/link";
import { ArrowRight, Play, ShieldCheck } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const stats = [
  { value: "94%", label: "Pipeline incidents auto-resolved" },
  { value: "11x", label: "Faster time-to-first-model" },
  { value: "38%", label: "Average warehouse spend reclaimed" },
];

const logos = ["Snowflake", "BigQuery", "Databricks", "dbt", "Airflow", "Dagster", "Kafka", "Postgres"];

const dataHubPoints = [
  {
    label: "No guessed schemas",
    body: "Every column, type and constraint Atlas writes against comes from DataHub's live schema registry, not a model's best guess.",
  },
  {
    label: "No guessed owners",
    body: "Ownership, on-call routing and approval chains are read directly from DataHub, so PRs land with the right reviewer automatically.",
  },
  {
    label: "No guessed lineage",
    body: "Atlas plans against DataHub's real dependency graph, so a fix upstream correctly accounts for every model and dashboard downstream.",
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
          <Eyebrow>Autonomous data engineering</Eyebrow>
        </div>
        <h1 className="mx-auto mt-6 text-[44px] font-bold leading-[1.08] tracking-tight text-text-heading sm:text-[56px] lg:text-[64px]">
          Your data platform,{" "}
          <span className="text-accent">operated by agents</span> that never
          sleep.
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-[16px] leading-relaxed text-text-body">
          Atlas AI plans, writes, tests and repairs production pipelines
          across your warehouse and lakehouse. Every change ships as
          reviewable code with lineage, contracts and rollback built in.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/demo" className="btn-primary">
            Book a demo <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/agents" className="btn-secondary">
            <Play className="h-3.5 w-3.5" /> Watch agents run
          </Link>
        </div>

        <p className="mx-auto mt-6 flex items-center justify-center gap-2 text-[13px] text-text-muted">
          <ShieldCheck className="h-4 w-4 text-accent" />
          Deployed inside your VPC · No training on customer data
        </p>

        <div className="mx-auto mt-14 grid max-w-lg grid-cols-3 gap-8 border-t border-border-hairline pt-8">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-[32px] font-bold text-text-heading">{s.value}</p>
              <p className="mt-1 text-[13px] leading-snug text-text-body">{s.label}</p>
            </div>
          ))}
        </div>
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
            Most AI coding tools infer schema and ownership from context and
            hope it's right. Atlas doesn't guess — every decision it makes is
            grounded in DataHub, the metadata platform your team already
            treats as source of truth.
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

      <div className="bg-bg-base py-10">
        <p className="text-center font-mono-atlas text-[11px] uppercase tracking-[0.15em] text-text-muted">
          Native integrations across the modern data stack
        </p>
        <div className="mx-auto mt-6 flex max-w-[1100px] flex-wrap items-center justify-center gap-x-12 gap-y-4 px-6">
          {logos.map((l) => (
            <span key={l} className="text-[15px] font-medium text-text-body-strong">
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

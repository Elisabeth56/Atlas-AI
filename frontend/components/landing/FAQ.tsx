"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const faqs = [
  {
    q: "Can Atlas AI write directly to production?",
    a: "No. Every agent-authored change lands as a pull request with a diff, a rationale and a rollback path. Nothing merges without human approval unless you explicitly configure auto-merge for a narrow, low-risk policy.",
  },
  {
    q: "Which platforms does Atlas connect to?",
    a: "Snowflake, BigQuery, Databricks and Postgres for warehouses; dbt, Airflow, Dagster and Kafka for transformation and orchestration — with more connectors added regularly.",
  },
  {
    q: "Where does our data live?",
    a: "Atlas deploys inside your own cloud account. Your credentials and data never leave your perimeter, and nothing is used to train models.",
  },
  {
    q: "How long does implementation take?",
    a: "Most teams are connected and mapped within a day. Agents start in a read-only advisory mode before you grant write access to any dataset.",
  },
  {
    q: "What happens if an agent gets it wrong?",
    a: "Every change ships as a reviewable PR with an estimated cost and blast radius, so mistakes are caught before merge. Post-merge, the Repair agent can revert or patch automatically.",
  },
  {
    q: "How is Atlas AI priced?",
    a: "Pricing is based on managed pipeline volume and agent activity. Talk to us for a plan sized to your warehouse footprint.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="mx-auto max-w-[1280px] px-6 py-24 lg:px-10">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="mt-6 text-[36px] font-bold leading-[1.15] tracking-tight text-text-heading sm:text-[42px]">
            What teams ask before switching on autonomy
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-text-body">
            If something here isn&apos;t covered, our engineers will answer it
            live during a demo.
          </p>
        </div>

        <div>
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b border-border-hairline">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[15px] font-medium text-text-heading">{f.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 flex-shrink-0 text-text-muted transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid overflow-hidden transition-all duration-200 ${
                    isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="min-h-0">
                    <p className="max-w-xl text-[14px] leading-relaxed text-text-body">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

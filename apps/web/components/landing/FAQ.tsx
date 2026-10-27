"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const faqs = [
  {
    q: "Does Atlas run the SQL it writes?",
    a: "No. It generates files and checks them statically. Nothing touches your warehouse, and the only thing it can write is metadata in DataHub, after you approve.",
  },
  {
    q: "What does it need from me?",
    a: "A DataHub instance with your datasets ingested and an access token. Without one, the demo runs against a sample catalog of Stripe and Postgres tables.",
  },
  {
    q: "Which models does it use?",
    a: "Open models on free inference tiers, starting with Llama 3.3 70B on Groq. If a provider rate-limits a call, the next one in the chain takes over.",
  },
  {
    q: "What happens if the output is wrong?",
    a: "QA names the file and the problem, such as a column that doesn't exist in the source schema. A critical finding blocks writeback until it's resolved.",
  },
  {
    q: "Can I skip the DataHub writeback?",
    a: "Yes. Skipping finishes the run with every artifact intact. DataHub is only changed when you click approve.",
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
            Questions worth asking first
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-text-body">
            The short version: Atlas writes code and metadata, never data, and
            asks before it changes anything.
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

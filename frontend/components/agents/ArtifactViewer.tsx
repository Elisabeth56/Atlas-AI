"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { ArtifactBundle } from "@/lib/types";

const tabs: { key: keyof Omit<ArtifactBundle, "request_id">; label: string; lang: string }[] = [
  { key: "dbt_models", label: "dbt model", lang: "sql" },
  { key: "sql", label: "SQL", lang: "sql" },
  { key: "tests", label: "Tests", lang: "yaml" },
  { key: "docs", label: "Docs", lang: "markdown" },
  { key: "configs", label: "Config", lang: "yaml" },
];

export function ArtifactViewer({ bundle }: { bundle: ArtifactBundle }) {
  const [active, setActive] = useState<(typeof tabs)[number]["key"]>("dbt_models");
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(bundle[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card-atlas overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-hairline px-2">
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                active === t.key
                  ? "bg-bg-alt text-text-heading"
                  : "text-text-body hover:text-text-heading"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          className="mr-2 flex flex-shrink-0 items-center gap-1.5 rounded-full border border-border-hairline-strong px-3 py-1.5 text-[12px] text-text-body-strong transition-colors hover:text-text-heading"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[560px] overflow-auto p-6 font-mono-atlas text-[13px] leading-relaxed text-text-body-strong">
        {bundle[active]}
      </pre>
    </div>
  );
}

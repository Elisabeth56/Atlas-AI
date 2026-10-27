import Link from "next/link";
import { ArrowRight } from "lucide-react";

const columns = [
  {
    title: "Platform",
    links: ["Ingestion agents", "Transformation agents", "Quality & contracts", "Cost optimizer"],
  },
  {
    title: "Solutions",
    links: ["Data platform teams", "Analytics engineering", "ML & feature stores", "Regulated industries"],
  },
  {
    title: "Company",
    links: ["Book a demo", "Live agent console", "Control center", "Security & trust"],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border-hairline bg-bg-base">
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                A
              </span>
              <span className="text-[15px] font-semibold text-text-heading">
                Atlas <span className="text-accent">AI</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-text-body">
              Atlas AI runs autonomous data engineering agents that build, repair and govern
              production pipelines — with every action reviewed, versioned and explainable.
            </p>
            <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Engineering notes
            </p>
            <form className="mt-3 flex max-w-xs items-center rounded-full border border-border-hairline-strong bg-bg-card pl-4 pr-1.5 py-1.5">
              <input
                type="email"
                placeholder="you@company.com"
                className="w-full bg-transparent text-[14px] text-text-heading placeholder:text-text-muted focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                {col.title}
              </p>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link
                      href="#"
                      className="text-[14px] text-text-body transition-colors hover:text-text-heading"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-border-hairline pt-6 text-[12px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Atlas AI Systems. All rights reserved.</p>
          <p className="font-mono-atlas tracking-wide">SOC 2 TYPE II · ISO 27001 · GDPR READY</p>
        </div>
      </div>
    </footer>
  );
}

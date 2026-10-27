"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/shell/Logo";

const SECTIONS = [
  { id: "sheet", label: "Contact sheet" },
  { id: "pipeline", label: "Pipeline" },
  { id: "qa", label: "QA" },
  { id: "faq", label: "FAQ" },
];

/** Numbered pill nav; the pill for the section you're reading lights up. N starts a run from anywhere on the page. */
export function LandingNav() {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const seen = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) seen.observe(el);
    });
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !el.closest("input,textarea")) router.push("/new");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      seen.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, [router]);

  return (
    <nav aria-label="Main" className="flex flex-wrap items-center justify-between gap-4 py-[22px]">
      <Link href="/" className="flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
        <Logo />
        Atlas
      </Link>
      <div className="order-3 flex w-full gap-1 overflow-x-auto rounded-full bg-surface-1 p-[5px] hairline sm:order-none sm:w-auto">
        {SECTIONS.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={active === s.id ? "location" : undefined}
            className={`inline-flex shrink-0 items-baseline gap-1.5 rounded-full px-3.5 py-2 text-small transition-colors duration-200 ${
              active === s.id ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            <span className={`font-mono text-[10px] ${active === s.id ? "text-moss" : "text-ink-3"}`}>0{i + 1}</span>
            {s.label}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Link href="/sign-in" className="px-3.5 text-small text-ink-2 hover:text-ink">
          Sign in
        </Link>
        <Link
          href="/new"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-safelight px-[18px] text-[15px] font-semibold text-action-ink hover:brightness-105"
        >
          Start a run
          <kbd className="rounded-[6px] bg-action-ink/10 px-1.5 py-0.5 font-mono text-[11px] font-normal">N</kbd>
        </Link>
      </div>
    </nav>
  );
}

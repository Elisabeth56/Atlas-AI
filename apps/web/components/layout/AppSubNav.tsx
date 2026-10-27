"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImagePlaceholder, ArrowLeft } from "lucide-react";

const tabs = [
  { label: "Control center", href: "/dashboard", icon: ImagePlaceholder },
  { label: "Running agents", href: "/agents", icon: ImagePlaceholder },
];

export function AppSubNav({ crumb }: { crumb: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border-hairline bg-bg-base">
      <div className="flex items-center justify-between px-6 py-2 text-[12px] text-text-muted lg:px-10">
        <span className="font-mono-atlas">/ {crumb}</span>
      </div>
      <div className="flex items-center justify-between border-t border-border-hairline px-6 py-3.5 lg:px-10">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
              A
            </span>
            <span className="text-[14px] font-semibold text-text-heading">
              Atlas <span className="text-accent">AI</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                    active
                      ? "bg-bg-card text-text-heading"
                      : "text-text-body hover:text-text-heading"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[13px] text-text-body transition-colors hover:text-text-heading"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to site
        </Link>
      </div>
    </header>
  );
}

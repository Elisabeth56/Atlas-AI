"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Moon, PanelLeftClose, Search, Sun } from "lucide-react";
import { Logo } from "@/components/shell/Logo";
import { RunsList } from "@/components/shell/RunsList";
import { supabaseBrowser } from "@/lib/supabase/client";
import { currentTheme, toggleTheme, type Theme } from "@/lib/theme";
import type { RunListItem } from "@/lib/types";

const DECISIONS_URL = "https://github.com/Elisabeth56/Atlas-AI/tree/main/docs/decisions";

export function Sidebar({
  runs,
  runsError,
  onSearch,
  onClose,
}: {
  runs: RunListItem[] | null;
  runsError: string | null;
  onSearch: () => void;
  /** set when the sidebar is a drawer */
  onClose?: () => void;
}) {
  const account = useAccount();
  const [theme, setThemeState] = useState<Theme>("dark");
  useEffect(() => setThemeState(currentTheme()), []);

  return (
    <div className="flex h-full flex-col gap-[18px] bg-sidebar px-3.5 py-[18px] text-ink shadow-[inset_-1px_0_0_var(--line)]">
      <div className="flex items-center gap-2.5 px-1.5 py-1">
        <Logo />
        <span className="flex min-w-0 grow flex-col">
          <span className="text-[16px] font-semibold tracking-[-0.02em]">Atlas</span>
          <span className="truncate font-mono text-[11px] text-ink-3">{account.workspace}</span>
        </span>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-ink-3 hover:text-ink"
          >
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <Link
        href="/new"
        className="flex h-11 items-center justify-between rounded-md bg-safelight pr-3.5 pl-4 text-[15px] font-semibold text-action-ink transition-[filter] duration-200 hover:brightness-105"
      >
        New run
        <kbd className="rounded-[6px] bg-action-ink/10 px-1.5 py-0.5 font-mono text-[11px] font-normal">N</kbd>
      </Link>

      <button
        onClick={onSearch}
        className="flex h-10 items-center gap-2.5 rounded-[12px] bg-surface-1 px-3 text-small text-ink-3 transition-colors duration-200 hover:text-ink-2"
      >
        <Search className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden />
        <span className="grow text-left">Search runs</span>
        <kbd className="font-mono text-[11px]">⌘K</kbd>
      </button>

      <div className="min-h-0 grow overflow-hidden">
        <RunsList runs={runs} error={runsError} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="px-2.5 text-caption tracking-[0.12em] text-ink-3 uppercase">Catalog</span>
        <div className="mx-1 flex flex-col gap-1 rounded-md bg-surface-1 px-3.5 py-3">
          <span className="flex items-center gap-2 text-small">
            <span aria-hidden className="h-2 w-2 rounded-full bg-moss" />
            Sample catalog
          </span>
          <span className="font-mono text-[11px] text-ink-3">3 datasets · 3 PII columns</span>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 text-small">
        <a
          href={DECISIONS_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-ink-2 hover:bg-surface-1 hover:text-ink"
        >
          <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Decision records
        </a>
      </div>

      <div className="flex items-center gap-2.5 rounded-md bg-surface-1 p-2.5">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-moss-deep font-mono text-[11px] text-safelight"
        >
          {account.initials}
        </span>
        <span className="flex min-w-0 grow flex-col">
          <span className="truncate text-small">{account.name}</span>
          <span className="font-mono text-[11px] text-ink-3">{account.kind}</span>
        </span>
        <button
          onClick={() => setThemeState(toggleTheme())}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] text-ink-3 hover:text-ink"
        >
          {theme === "light" ? (
            <Moon className="h-[15px] w-[15px]" strokeWidth={1.75} />
          ) : (
            <Sun className="h-[15px] w-[15px]" strokeWidth={1.75} />
          )}
        </button>
      </div>
    </div>
  );
}

/** Who's signed in. Anonymous demo visitors get a private workspace, so they're "Guest". */
function useAccount() {
  const [account, setAccount] = useState({ name: "Guest", kind: "demo account", initials: "G", workspace: "My workspace" });
  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) {
      setAccount({ name: "Local", kind: "sign-in off", initials: "L", workspace: "Demo workspace" });
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user || user.is_anonymous) return;
      const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Signed in";
      const initials = name.split(/[\s@.]/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
      setAccount({ name, kind: user.email ?? "account", initials, workspace: `${name.split(" ")[0]}’s workspace` });
    });
  }, []);
  return account;
}

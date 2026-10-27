"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { Logo } from "@/components/shell/Logo";
import { Sidebar } from "@/components/shell/Sidebar";
import { RunsContext, useRuns } from "@/hooks/useRuns";

function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** Sidebar on desktop, a drawer behind a 44px menu button below 768px, and the ⌘K palette. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const runsState = useRuns();
  const { runs, error } = runsState;
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawerPanel = useRef<HTMLDivElement>(null);

  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((open) => !open);
      } else if (e.key === "Escape") {
        setDrawer(false);
      } else if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target) && !palette) {
        e.preventDefault();
        router.push("/new");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, palette]);

  // move focus into the drawer when it opens and back to the menu button when it closes
  useEffect(() => {
    if (drawer) drawerPanel.current?.querySelector<HTMLElement>("a, button")?.focus();
    else if (document.activeElement && drawerPanel.current?.contains(document.activeElement)) menuButton.current?.focus();
  }, [drawer]);

  const sidebar = (onClose?: () => void) => (
    <Sidebar runs={runs} runsError={error} onSearch={() => setPalette(true)} onClose={onClose} />
  );

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 md:block">{sidebar()}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-surface-0/90 px-2 backdrop-blur md:hidden">
          <button
            ref={menuButton}
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            aria-expanded={drawer}
            className="flex h-11 w-11 items-center justify-center rounded-[12px] text-ink-2"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <Logo size={22} />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Atlas</span>
        </header>
        <main className="flex-1">
          <RunsContext.Provider value={runsState}>{children}</RunsContext.Provider>
        </main>
      </div>

      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.div
              className="absolute inset-0 bg-black/50"
              onClick={() => setDrawer(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              ref={drawerPanel}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 left-0 w-[288px] max-w-[85vw]"
              initial={reduced ? { opacity: 0 } : { x: "-100%" }}
              animate={reduced ? { opacity: 1 } : { x: 0 }}
              exit={reduced ? { opacity: 0 } : { x: "-100%" }}
              transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 300, damping: 30 }}
            >
              {sidebar(() => setDrawer(false))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CommandPalette open={palette} onClose={() => setPalette(false)} runs={runs ?? []} />
    </div>
  );
}

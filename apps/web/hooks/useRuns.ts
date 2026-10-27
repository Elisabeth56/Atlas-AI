"use client";

import { useEffect, useState } from "react";
import { HAS_BACKEND, listRuns } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { RunListItem } from "@/lib/types";

const POLL_MS = 5000;

/**
 * The workspace's runs, kept current. Supabase Realtime signals a change to `runs` (RLS limits it to
 * this workspace) and we refetch; without Supabase it polls. Same pattern as useRunStream (ADR 003).
 */
export function useRuns() {
  const [runs, setRuns] = useState<RunListItem[] | null>(HAS_BACKEND ? null : []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!HAS_BACKEND) return;
    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      try {
        const next = await listRuns();
        if (!cancelled) {
          setRuns(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn’t load your runs.");
      }
    };
    const refreshSoon = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(refresh, 300);
    };

    refresh();
    const supabase = supabaseBrowser();
    if (!supabase) {
      const poller = setInterval(refresh, POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(poller);
      };
    }
    const channel = supabase
      .channel("runs-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, refreshSoon)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refreshSoon();
      });
    return () => {
      cancelled = true;
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }, []);

  return { runs, error };
}

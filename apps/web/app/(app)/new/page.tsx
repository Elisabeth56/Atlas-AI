"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Photo } from "@/components/ui/Photo";
import { useRunsList } from "@/hooks/useRuns";
import { createRun } from "@/lib/api";

const EXAMPLES = ["Customer revenue from Stripe and Postgres events", "Daily orders per plan tier, with revenue in dollars"];
const DRAFT_KEY = "atlas.draft";

export default function NewRunPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const { runs } = useRunsList();
  const firstRun = runs !== null && runs.length === 0;

  // an unsent prompt survives a reload or a wander to another run
  useEffect(() => {
    try {
      setPrompt(localStorage.getItem(DRAFT_KEY) ?? "");
    } catch {}
    field.current?.focus();
  }, []);
  const edit = (value: string) => {
    setPrompt(value);
    try {
      localStorage.setItem(DRAFT_KEY, value);
    } catch {}
  };

  const pick = (example: string) => {
    edit(example);
    field.current?.focus();
  };

  async function start() {
    const text = prompt.trim();
    if (!text || starting) return;
    setStarting(true);
    setError(null);
    try {
      const { run_id } = await createRun(text);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      router.push(`/agents/${run_id}?prompt=${encodeURIComponent(text)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Atlas couldn’t start the run. Try again in a moment.");
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-8 px-4 pt-12 pb-24 sm:px-8 md:pt-24">
      <div className="flex flex-col gap-3">
        <Eyebrow>new run</Eyebrow>
        <h1 className="text-[32px] leading-[36px] font-semibold tracking-[-0.03em] text-ink sm:text-title">
          What should Atlas build?
        </h1>
        <p className="max-w-[56ch] text-lead text-ink-2">
          Describe the pipeline in a sentence. Atlas finds the source datasets in your catalog and asks you to confirm
          them before it writes anything.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
        className="flex flex-col rounded-lg bg-surface-1 hairline transition-shadow duration-200 focus-within:shadow-[inset_0_0_0_1px_var(--moss)]"
      >
        <label htmlFor="prompt" className="sr-only">
          Describe the pipeline
        </label>
        <textarea
          ref={field}
          id="prompt"
          value={prompt}
          onChange={(e) => edit(e.target.value)}
          onKeyDown={(e) => {
            // Enter starts the run; Shift+Enter adds a line
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              start();
            }
          }}
          rows={4}
          maxLength={4000}
          placeholder="Customer revenue from Stripe and Postgres events"
          className="w-full resize-none rounded-t-lg bg-transparent px-6 pt-5 pb-2 text-body text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-2 pb-5">
          <span className="flex items-center gap-2 font-mono text-[11px] text-ink-3">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-moss" />
            sample catalog · 3 datasets
          </span>
          <Button type="submit" disabled={!prompt.trim() || starting}>
            {starting ? "Starting…" : "Start a run"}
            {!starting && <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-md bg-critical-wash px-4 py-3 text-small text-ink">
          {error}
        </p>
      )}

      {firstRun ? (
        <section aria-label="No runs yet" className="grid gap-5 rounded-lg bg-surface-1 p-5 hairline sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Photo
            src="/images/schema-desk.webp"
            alt="A printed database schema under a desk lamp"
            position="50% 65%"
            className="h-[220px] sm:h-full sm:min-h-[260px]"
            sizes="(min-width: 640px) 320px, 100vw"
          />
          <div className="flex flex-col gap-4 py-1">
            <h2 className="text-[22px] leading-[1.25] font-semibold tracking-[-0.02em] text-ink">No runs yet</h2>
            <p className="text-small text-ink-2">
              Describe a pipeline and Atlas will find the sources in your catalog. Start from one of these:
            </p>
            <Starters onPick={pick} />
          </div>
        </section>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-caption text-ink-3">or start from one of these</span>
          <Starters onPick={pick} />
        </div>
      )}
    </div>
  );
}

function Starters({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {EXAMPLES.map((example) => (
        <button
          key={example}
          type="button"
          onClick={() => onPick(example)}
          className="rounded-[14px] bg-surface-2 px-3.5 py-3 text-left text-small text-ink transition-colors duration-200 hover:bg-surface-2/70"
        >
          {example}
        </button>
      ))}
    </div>
  );
}

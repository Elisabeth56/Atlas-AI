"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DEMO_PROMPT } from "@/lib/pipeline";
import { createRequest } from "@/lib/api";

const EXAMPLE_PROMPTS = [
  DEMO_PROMPT,
  "Build a churn prediction dataset from user signups and cancellations",
  "Create a daily active users model from event tracking data",
];

export default function NewRunPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || starting) return;

    setStarting(true);
    setError(null);
    try {
      const { request_id } = await createRequest(trimmed);
      router.push(`/agents/${request_id}?prompt=${encodeURIComponent(trimmed)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start the run.");
      setStarting(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "linear-gradient(to bottom, black, transparent 85%)",
            }}
          />
          <div className="relative mx-auto max-w-[640px] px-6 pt-24 pb-28 lg:px-10">
            <div className="flex justify-center">
              <Eyebrow>New run</Eyebrow>
            </div>
            <h1 className="mx-auto mt-6 max-w-lg text-center text-[40px] font-bold leading-[1.12] tracking-tight text-text-heading sm:text-[46px]">
              Describe the pipeline you need.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-center text-[16px] leading-relaxed text-text-body">
              Write your own request — this runs the real six-agent pipeline
              against whatever you type, not a canned scenario.
            </p>

            <form onSubmit={handleSubmit} className="card-atlas mt-10 p-5">
              <label htmlFor="prompt" className="sr-only">
                Describe the pipeline you need
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Build a customer revenue pipeline from raw Stripe and Postgres events"
                rows={4}
                className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-text-heading placeholder:text-text-muted focus:outline-none"
              />
              <div className="mt-4 flex items-center justify-between border-t border-border-hairline pt-4">
                <span className="font-mono-atlas text-[11px] uppercase tracking-[0.1em] text-text-muted">
                  {prompt.length} characters
                </span>
                <button
                  type="submit"
                  disabled={!prompt.trim() || starting}
                  className="btn-primary disabled:opacity-50"
                >
                  {starting ? "Starting…" : "Run pipeline"}
                  {!starting && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </form>

            {error && (
              <p className="mt-4 text-center text-[13px] text-red-400">{error}</p>
            )}

            <div className="mt-8">
              <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-text-muted">
                <Sparkles className="h-3.5 w-3.5" />
                Try an example
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="rounded-lg border border-border-hairline bg-bg-card px-4 py-3 text-left text-[13px] text-text-body transition-colors hover:border-border-hairline-strong hover:text-text-heading"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

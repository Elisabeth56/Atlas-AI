"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DEMO_PROMPT } from "@/lib/pipeline";
import { createRequest } from "@/lib/api";

export default function DemoPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDemo() {
    setStarting(true);
    setError(null);
    try {
      const { request_id } = await createRequest(DEMO_PROMPT);
      router.push(`/agents/${request_id}?prompt=${encodeURIComponent(DEMO_PROMPT)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start the demo run.");
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
          <div className="relative mx-auto max-w-[640px] px-6 pt-24 pb-28 text-center lg:px-10">
            <div className="flex justify-center">
              <Eyebrow>Try it live</Eyebrow>
            </div>
            <h1 className="mx-auto mt-6 max-w-lg text-[40px] font-bold leading-[1.12] tracking-tight text-text-heading sm:text-[46px]">
              Watch six agents build a pipeline, live.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-text-body">
              One tap. No setup. Atlas plans, retrieves metadata, writes the
              code and validates it in front of you, end to end.
            </p>

            <div className="card-atlas mx-auto mt-10 max-w-md p-5 text-left">
              <p className="font-mono-atlas text-[11px] uppercase tracking-[0.1em] text-text-muted">
                Demo scenario
              </p>
              <p className="mt-2 font-mono-atlas text-[14px] leading-relaxed text-text-heading">
                &ldquo;Build a customer revenue pipeline from raw Stripe and
                Postgres events&rdquo;
              </p>
            </div>

            <button
              onClick={startDemo}
              disabled={starting}
              className="btn-primary mx-auto mt-8 disabled:opacity-70"
            >
              <Play className="h-4 w-4" />
              {starting ? "Starting…" : "Start demo"}
            </button>

            {error && (
              <p className="mt-4 text-[13px] text-red-400">{error}</p>
            )}

            <p className="mt-8 flex items-center justify-center gap-2 text-[13px] text-text-muted">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Read-only until you approve · No production writes without a PR
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}


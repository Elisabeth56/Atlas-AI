"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppSubNav } from "@/components/layout/AppSubNav";
import { ArtifactViewer } from "@/components/agents/ArtifactViewer";
import { getArtifacts } from "@/lib/api";
import type { ArtifactBundle } from "@/lib/types";

export default function ArtifactsPage() {
  const params = useParams<{ runId: string }>();
  const [bundle, setBundle] = useState<ArtifactBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getArtifacts(params.runId)
      .then((b) => !cancelled && setBundle(b))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [params.runId]);

  return (
    <>
      <AppSubNav crumb={`agents/${params.runId}/artifacts`} />
      <main className="flex-1 bg-bg-base">
        <div className="mx-auto max-w-[1000px] px-6 py-10 lg:px-10">
          <Link
            href={`/agents/${params.runId}`}
            className="flex items-center gap-1.5 text-[13px] text-text-body transition-colors hover:text-text-heading"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to run
          </Link>
          <h1 className="mt-3 text-[26px] font-bold text-text-heading">Generated artifacts</h1>
          <p className="mt-1.5 text-[14px] text-text-body">
            dbt models, SQL, tests, docs and configs produced by this run.
          </p>

          <div className="mt-8">
            {error && (
              <p className="text-[14px] text-accent">Failed to load artifacts: {error}</p>
            )}
            {!bundle && !error && (
              <div className="flex items-center gap-2 py-10 text-[14px] text-text-body">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading artifacts…
              </div>
            )}
            {bundle && <ArtifactViewer bundle={bundle} />}
          </div>
        </div>
      </main>
    </>
  );
}

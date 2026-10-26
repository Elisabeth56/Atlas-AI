"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppSubNav } from "@/components/layout/AppSubNav";
import { ValidationBanner } from "@/components/agents/ValidationBanner";
import { getValidationReport } from "@/lib/api";
import type { ValidationReport } from "@/lib/types";

export default function ValidationPage() {
  const params = useParams<{ runId: string }>();
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getValidationReport(params.runId)
      .then((r) => !cancelled && setReport(r))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [params.runId]);

  return (
    <>
      <AppSubNav crumb={`agents/${params.runId}/validation`} />
      <main className="flex-1 bg-bg-base">
        <div className="mx-auto max-w-[760px] px-6 py-10 lg:px-10">
          <Link
            href={`/agents/${params.runId}`}
            className="flex items-center gap-1.5 text-[13px] text-text-body transition-colors hover:text-text-heading"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to run
          </Link>
          <h1 className="mt-3 text-[26px] font-bold text-text-heading">Validation report</h1>
          <p className="mt-1.5 text-[14px] text-text-body">
            Schema, lint and governance checks run by the QA agent before write-back.
          </p>

          <div className="mt-8">
            {error && (
              <p className="text-[14px] text-accent">Failed to load report: {error}</p>
            )}
            {!report && !error && (
              <div className="flex items-center gap-2 py-10 text-[14px] text-text-body">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading validation report…
              </div>
            )}
            {report && <ValidationBanner report={report} />}
          </div>
        </div>
      </main>
    </>
  );
}

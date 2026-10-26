import { Check, Loader2, X } from "lucide-react";
import type { PipelineStage } from "@/lib/pipeline";
import type { StageStatus } from "@/hooks/useRunStream";

export function RunStepper({
  stages,
  statuses,
}: {
  stages: PipelineStage[];
  statuses: StageStatus[];
}) {
  return (
    <div className="card-atlas p-6">
      <ol>
        {stages.map((stage, i) => {
          const status = statuses[i];
          const isLast = i === stages.length - 1;
          return (
            <li key={stage.id} className="relative flex gap-4 pb-8 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px ${
                    status === "done" ? "bg-accent" : "bg-border-hairline"
                  }`}
                />
              )}
              <span
                className={`z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-[12px] font-medium ${
                  status === "done"
                    ? "border-accent bg-accent text-white"
                    : status === "failed"
                    ? "border-accent bg-accent-dim text-accent"
                    : status === "running"
                    ? "border-accent bg-bg-card text-accent"
                    : "border-border-hairline-strong bg-bg-card text-text-muted"
                }`}
              >
                {status === "done" ? (
                  <Check className="h-4 w-4" />
                ) : status === "failed" ? (
                  <X className="h-4 w-4" />
                ) : status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  i + 1
                )}
              </span>
              <div className="pt-0.5">
                <p
                  className={`text-[15px] font-semibold ${
                    status === "pending" ? "text-text-muted" : "text-text-heading"
                  }`}
                >
                  {stage.name}
                </p>
                <p className="mt-0.5 text-[13px] text-text-body">{stage.role}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

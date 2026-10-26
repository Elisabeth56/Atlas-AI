import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { ValidationReport } from "@/lib/types";

const severityStyle = {
  info: { icon: CheckCircle2, cls: "text-accent" },
  warning: { icon: AlertTriangle, cls: "text-[#cfa53c]" },
  critical: { icon: XCircle, cls: "text-accent" },
};

export function ValidationBanner({ report }: { report: ValidationReport }) {
  return (
    <div>
      <div
        className={`card-atlas flex items-center gap-3 p-5 ${
          report.passed ? "" : "border-accent-dim-border"
        }`}
      >
        {report.passed ? (
          <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-accent" />
        ) : (
          <XCircle className="h-6 w-6 flex-shrink-0 text-accent" />
        )}
        <div>
          <p className="text-[15px] font-semibold text-text-heading">
            {report.passed ? "All checks passed" : "Action required before write-back"}
          </p>
          <p className="text-[13px] text-text-body">
            {report.checks.filter((c) => c.passed).length} of {report.checks.length} checks
            passed
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {report.checks.map((c) => {
          const s = severityStyle[c.severity];
          const Icon = s.icon;
          return (
            <div key={c.name} className="card-atlas flex items-start gap-3 p-4">
              <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${s.cls}`} />
              <div>
                <p className="text-[14px] font-medium text-text-heading">{c.name}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-text-body">{c.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

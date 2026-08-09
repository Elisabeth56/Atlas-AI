interface ReviewRow {
  pr: string;
  agent: string;
  target: string;
  summary: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
}

const rows: ReviewRow[] = [
  { pr: "PR #4821", agent: "Atlas Repair", target: "fct_orders", summary: "Handle nullable billing_country after source drift", risk: "LOW" },
  { pr: "PR #4818", agent: "Atlas Model", target: "dim_customer", summary: "Split SCD2 logic into reusable macro", risk: "MEDIUM" },
  { pr: "PR #4815", agent: "Atlas Ledger", target: "wh_analytics", summary: "Downsize warehouse on weekend schedule", risk: "LOW" },
  { pr: "PR #4812", agent: "Atlas Warden", target: "raw_payments", summary: "Apply masking policy to card_last4", risk: "HIGH" },
  { pr: "PR #4809", agent: "Atlas Sentinel", target: "stg_events", summary: "Tighten freshness contract to 15 minutes", risk: "LOW" },
];

const riskCls: Record<ReviewRow["risk"], string> = {
  LOW: "badge-risk-low",
  MEDIUM: "badge-risk-medium",
  HIGH: "badge-risk-high",
};

export function ReviewQueue() {
  return (
    <div className="card-atlas p-6">
      <h3 className="text-[17px] font-semibold text-text-heading">Review queue</h3>
      <p className="mt-1 text-[13px] text-text-body">
        Agent-authored changes waiting on a human approver
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border-hairline text-[11px] uppercase tracking-[0.08em] text-text-muted">
              <th className="pb-3 font-medium">Change</th>
              <th className="pb-3 font-medium">Agent</th>
              <th className="pb-3 font-medium">Target</th>
              <th className="pb-3 font-medium">Summary</th>
              <th className="pb-3 text-right font-medium">Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pr} className="border-b border-border-hairline last:border-b-0">
                <td className="py-3.5 font-mono-atlas text-[13px] text-accent">{r.pr}</td>
                <td className="py-3.5 text-[14px] text-text-heading">{r.agent}</td>
                <td className="py-3.5 font-mono-atlas text-[13px] text-text-body-strong">{r.target}</td>
                <td className="py-3.5 text-[14px] text-text-body">{r.summary}</td>
                <td className="py-3.5 text-right">
                  <span className={`badge-risk ${riskCls[r.risk]}`}>{r.risk}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

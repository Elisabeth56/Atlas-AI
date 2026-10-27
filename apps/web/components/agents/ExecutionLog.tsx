const agentColor: Record<string, string> = {
  sentinel: "text-[#cfa53c]",
  repair: "text-accent",
  model: "text-[#7ea6e0]",
  ledger: "text-[#8ad0a8]",
  ingest: "text-text-body-strong",
  warden: "text-[#c48ae0]",
  planner: "text-text-body-strong",
  metadata_analyst: "text-[#7ea6e0]",
  data_engineer: "text-accent",
  qa: "text-[#cfa53c]",
  documentation: "text-[#8ad0a8]",
  writeback: "text-[#c48ae0]",
};

export interface LogLine {
  agent: string;
  text: string;
}

export function ExecutionLog({ lines }: { lines: LogLine[] }) {
  return (
    <div className="card-atlas flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[17px] font-semibold text-text-heading">Execution log</h3>
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-accent">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Live
        </span>
      </div>

      <div className="mt-5 flex-1 space-y-4 overflow-y-auto font-mono-atlas text-[13px] leading-relaxed">
        {lines.map((l, i) => (
          <p key={i} className="text-text-body">
            <span className={`${agentColor[l.agent] ?? "text-text-body-strong"} font-medium`}>
              {l.agent}
            </span>{" "}
            {l.text}
          </p>
        ))}
      </div>

      <p className="mt-5 border-t border-border-hairline pt-4 text-[12px] leading-relaxed text-text-muted">
        Every line above maps to an immutable audit entry with the plan,
        inputs, cost estimate and reviewer.
      </p>
    </div>
  );
}

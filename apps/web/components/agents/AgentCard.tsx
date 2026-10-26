const statusMap = {
  running: { label: "Running", cls: "badge-running" },
  review: { label: "Awaiting review", cls: "badge-review" },
  scheduled: { label: "Scheduled", cls: "badge-scheduled" },
};

export type AgentStatus = keyof typeof statusMap;

export interface AgentCardData {
  name: string;
  status: AgentStatus;
  role: string;
  body: string;
  cadence: string;
  metric: string;
  progress: number; // 0-100
}

export function AgentCard({ agent }: { agent: AgentCardData }) {
  const status = statusMap[agent.status];
  return (
    <div className="card-atlas p-6">
      <div className="flex items-start justify-between">
        <h3 className="text-[17px] font-semibold text-text-heading">{agent.name}</h3>
        <span className={`badge-status ${status.cls}`}>{status.label}</span>
      </div>
      <p className="mt-1 text-[13px] text-text-body">{agent.role}</p>

      <div className="mt-4 flex items-center justify-between font-mono-atlas text-[12px] text-text-muted">
        <span>{agent.cadence}</span>
        <span className="text-text-body-strong">{agent.metric}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${agent.progress}%` }}
        />
      </div>

      <p className="mt-4 text-[14px] leading-relaxed text-text-body">{agent.body}</p>
    </div>
  );
}

import { LucideIcon, ArrowUp, ArrowDown } from "lucide-react";

export interface StatCardData {
  label: string;
  value: string;
  delta: string;
  direction: "up" | "down";
  icon: LucideIcon;
}

export function StatCard({ stat }: { stat: StatCardData }) {
  const Icon = stat.icon;
  const DeltaIcon = stat.direction === "up" ? ArrowUp : ArrowDown;
  return (
    <div className="card-atlas p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-text-body">{stat.label}</p>
        <Icon className="h-4 w-4 text-accent" strokeWidth={1.75} />
      </div>
      <p className="mt-3 text-[28px] font-bold text-text-heading">{stat.value}</p>
      <p className="mt-1.5 flex items-center gap-1 text-[12px] text-text-muted">
        <DeltaIcon className="h-3 w-3 text-accent" />
        {stat.delta}
      </p>
    </div>
  );
}

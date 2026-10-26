import { Activity, GitPullRequest, AlertTriangle, DollarSign } from "lucide-react";
import { AppSubNav } from "@/components/layout/AppSubNav";
import { StatCard, type StatCardData } from "@/components/dashboard/StatCard";
import { ThroughputChart } from "@/components/dashboard/ThroughputChart";
import { GuardrailsPanel } from "@/components/dashboard/GuardrailsPanel";
import { ReviewQueue } from "@/components/dashboard/ReviewQueue";
import { NewRunButton } from "@/components/dashboard/NewRunButton";

const stats: StatCardData[] = [
  { label: "Pipelines healthy", value: "312 / 318", delta: "+6 today", direction: "up", icon: Activity },
  { label: "Auto-resolved incidents", value: "47", delta: "94% of total", direction: "up", icon: GitPullRequest },
  { label: "Open review queue", value: "5", delta: "-3 vs yesterday", direction: "down", icon: AlertTriangle },
  { label: "Compute spend (MTD)", value: "$41.2k", delta: "-38% vs plan", direction: "down", icon: DollarSign },
];

export default function DashboardPage() {
  return (
    <>
      <AppSubNav crumb="dashboard" />
      <main className="flex-1 bg-bg-base">
        <div className="mx-auto max-w-[1280px] px-6 py-10 lg:px-10">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-[28px] font-bold text-text-heading">Control center</h1>
              <p className="mt-1.5 text-[14px] text-text-body">
                Fleet health across 318 managed pipelines · updated 42 seconds ago
              </p>
            </div>
            <NewRunButton />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <StatCard key={s.label} stat={s} />
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
            <ThroughputChart />
            <GuardrailsPanel />
          </div>

          <div className="mt-5">
            <ReviewQueue />
          </div>
        </div>
      </main>
    </>
  );
}

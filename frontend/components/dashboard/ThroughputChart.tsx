"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { day: "Mon", runs: 1820 },
  { day: "Tue", runs: 2140 },
  { day: "Wed", runs: 2020 },
  { day: "Thu", runs: 2480 },
  { day: "Fri", runs: 2640 },
  { day: "Sat", runs: 1380 },
  { day: "Sun", runs: 1290 },
];

export function ThroughputChart() {
  return (
    <div className="card-atlas p-6">
      <h3 className="text-[17px] font-semibold text-text-heading">Agent throughput</h3>
      <p className="mt-1 text-[13px] text-text-body">
        Pipeline runs and autonomous repairs over the last 7 days
      </p>
      <div className="mt-6 h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="throughputFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e14d5f" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#e14d5f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="rgba(255,255,255,0.1)"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fill: "#5c5f68", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#5c5f68", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "#111318",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 10,
                fontSize: 12,
                color: "#f5f5f6",
              }}
            />
            <Area
              type="monotone"
              dataKey="runs"
              stroke="#e14d5f"
              strokeWidth={2}
              fill="url(#throughputFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

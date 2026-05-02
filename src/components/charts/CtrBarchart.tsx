"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CtrBarchartProps {
  data: Array<{ query: string; impressions: number; ctr: number }>;
}

export function CtrBarchart({ data }: CtrBarchartProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-muted text-xs mb-2.5 font-semibold">
        📊 CTR Opportunity Distribution
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data.slice(0, 8)}
          margin={{ top: 0, right: 10, bottom: 0, left: -20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="query"
            tick={{ fill: "var(--muted)", fontSize: 9 }}
            tickFormatter={(v) => v.slice(0, 12) + "…"}
          />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 9 }} />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--text)" }}
          />
          <Bar
            dataKey="impressions"
            fill="var(--blue)"
            radius={[3, 3, 0, 0]}
            name="Impressions"
          />
          <Bar
            dataKey="ctr"
            fill="var(--green)"
            radius={[3, 3, 0, 0]}
            name="CTR %"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

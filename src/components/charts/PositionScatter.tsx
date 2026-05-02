"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PositionScatterProps {
  data: Array<{ query: string; position: number; clicks: number }>;
}

export function PositionScatter({ data }: PositionScatterProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-muted text-xs mb-2.5 font-semibold">
        🎯 Position vs Clicks
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="position"
            name="Position"
            tick={{ fill: "var(--muted)", fontSize: 9 }}
            domain={[0, 30]}
            label={{ value: "Position", fill: "var(--muted)", fontSize: 9 }}
          />
          <YAxis
            dataKey="clicks"
            name="Clicks"
            tick={{ fill: "var(--muted)", fontSize: 9 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number, n: string) => [v, n]}
            labelFormatter={(l: string) => `Position: ${l}`}
          />
          <Scatter data={data.slice(0, 20)} fill="var(--amber)" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

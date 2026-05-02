"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface IntentPieProps {
  data: Record<string, number>;
}

const COLORS = [
  "var(--blue)",
  "var(--green)",
  "var(--amber)",
  "var(--red)",
];

export function IntentPie({ data }: IntentPieProps) {
  const pieData = Object.entries(data).map(([name, value]) => ({ name, value }));

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-muted text-xs mb-2.5 font-semibold">
        🔍 Intent Distribution
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend
            iconSize={10}
            iconType="circle"
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

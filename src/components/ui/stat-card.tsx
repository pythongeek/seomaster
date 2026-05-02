"use client";

interface StatCardProps {
  label: string;
  value: string;
  variant?: "blue" | "green" | "amber" | "red" | "purple" | "cyan" | "muted";
  sub?: string;
}

const valueColors: Record<string, string> = {
  blue: "text-blue",
  green: "text-green",
  amber: "text-amber",
  red: "text-red",
  purple: "text-purple",
  cyan: "text-cyan",
  muted: "text-muted",
};

export function StatCard({ label, value, variant = "blue", sub }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-blue/30 hover:shadow-lg hover:shadow-blue/5 group">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">
        {label}
      </div>
      <div
        className={`text-[28px] font-extrabold font-mono leading-tight ${valueColors[variant]}`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-xs text-muted mt-0.5">{sub}</div>
      )}
    </div>
  );
}

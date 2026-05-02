"use client";

import type { ReactNode } from "react";

const colorMap: Record<string, string> = {
  blue: "bg-blue/10 text-blue border-blue/25",
  green: "bg-green/10 text-green border-green/25",
  amber: "bg-amber/10 text-amber border-amber/25",
  red: "bg-red/10 text-red border-red/25",
  purple: "bg-purple/10 text-purple border-purple/25",
  cyan: "bg-cyan/10 text-cyan border-cyan/25",
  muted: "bg-muted/10 text-muted border-muted/25",
};

interface BadgeProps {
  variant?: keyof typeof colorMap;
  /** Override with raw Tailwind color classes */
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = "blue", className, children }: BadgeProps) {
  const base =
    "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold tracking-wider font-mono whitespace-nowrap";
  const color = className ?? colorMap[variant] ?? colorMap.blue;

  return <span className={`${base} ${color}`}>{children}</span>;
}

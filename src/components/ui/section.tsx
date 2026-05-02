"use client";

import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  accent?: string;
  action?: ReactNode;
  children: ReactNode;
}

const accentColors: Record<string, string> = {
  blue: "bg-blue",
  green: "bg-green",
  amber: "bg-amber",
  red: "bg-red",
  purple: "bg-purple",
  cyan: "bg-cyan",
  muted: "bg-muted",
};

export function Section({ title, accent = "blue", action, children }: SectionProps) {
  const bar = accentColors[accent] ?? accentColors.blue;

  return (
    <div className="mb-7 animate-fade-in">
      <div className="flex items-center justify-between border-b border-border pb-2.5 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-[3px] h-[18px] rounded-sm ${bar}`} />
          <span className="text-text font-bold text-[15px]">{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

"use client";

import type { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue/50 focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed";

  const variants: Record<string, string> = {
    primary:
      "bg-blue text-white hover:brightness-110 active:scale-[0.98] shadow-lg shadow-blue/20",
    outline:
      "border border-border text-muted hover:text-text hover:border-blue/50 bg-transparent",
    ghost:
      "text-muted hover:text-text hover:bg-surface bg-transparent",
  };

  const sizes: Record<string, string> = {
    sm: "px-3.5 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full spinner" />
          Processing…
        </>
      ) : (
        children
      )}
    </button>
  );
}

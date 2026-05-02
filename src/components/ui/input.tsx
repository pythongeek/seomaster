"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (v: string) => void;
}

export function Input({ value, onChange, className = "", ...props }: InputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] font-mono text-text placeholder:text-muted/50 outline-none transition-colors duration-200 focus:border-blue/50 focus:ring-1 focus:ring-blue/30 ${className}`}
      {...props}
    />
  );
}

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onChange: (v: string) => void;
}

export function TextArea({ value, onChange, rows = 4, className = "", ...props }: TextAreaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={`w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-[13px] font-mono text-text placeholder:text-muted/50 outline-none resize-y transition-colors duration-200 focus:border-blue/50 focus:ring-1 focus:ring-blue/30 ${className}`}
      {...props}
    />
  );
}

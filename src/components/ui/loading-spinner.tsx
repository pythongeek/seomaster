"use client";

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = "Analyzing data with AI…" }: LoadingSpinnerProps) {
  return (
    <div className="text-center py-10">
      <div className="text-blue text-[32px] mb-3 spinner inline-block">⚙️</div>
      <div className="text-muted text-[13px]">{message}</div>
    </div>
  );
}

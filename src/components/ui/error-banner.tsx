"use client";

interface ErrorBannerProps {
  message: string;
  variant?: "error" | "warning";
}

export function ErrorBanner({ message, variant = "error" }: ErrorBannerProps) {
  if (!message) return null;

  const styles =
    variant === "error"
      ? "bg-red/5 border-red/20 text-red"
      : "bg-amber/5 border-amber/20 text-amber";

  return (
    <div
      className={`rounded-lg border px-3.5 py-2.5 mb-4 text-[13px] animate-fade-in ${styles}`}
    >
      {message}
    </div>
  );
}

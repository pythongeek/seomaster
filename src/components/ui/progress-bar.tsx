"use client";

interface ProgressBarProps {
  progress: number;
  message?: string;
  status?: "pending" | "processing" | "completed" | "failed";
}

export function ProgressBar({ progress, message, status = "processing" }: ProgressBarProps) {
  const isFailed = status === "failed";
  const isCompleted = status === "completed";

  const barColor = isFailed ? "bg-red" : isCompleted ? "bg-green" : "bg-blue";
  const textColor = isFailed ? "text-red" : isCompleted ? "text-green" : "text-blue";

  return (
    <div className="w-full bg-surface border border-border rounded-lg p-4 animate-fade-in">
      <div className="flex justify-between items-center mb-2 text-xs font-bold">
        <span className="text-text">{message || "Processing..."}</span>
        <span className={textColor}>{progress}%</span>
      </div>
      <div className="w-full bg-border rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-500 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {status === "pending" && (
        <div className="text-muted text-[10px] mt-2">Waiting in queue...</div>
      )}
    </div>
  );
}

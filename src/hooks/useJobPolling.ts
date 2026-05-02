"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/store";

export function useJobPolling(jobId?: string | null, onComplete?: (result: any) => void, onError?: (error: string) => void) {
  const { updateJobProgress, completeJob, failJob, activeJobs } = useStore();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const pollJob = async () => {
      try {
        const res = await fetch(`/api/jobs?id=${jobId}`);
        if (!res.ok) throw new Error("Failed to fetch job status");
        
        const data = await res.json();
        
        updateJobProgress(jobId, data.progress, data.progressMessage);

        if (data.status === "completed") {
          completeJob(jobId, data.result);
          onComplete?.(data.result);
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (data.status === "failed") {
          failJob(jobId, data.error || "Job failed");
          onError?.(data.error || "Job failed");
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.error("Job polling error:", err);
      }
    };

    // Initial poll
    pollJob();

    // Set up interval
    pollingRef.current = setInterval(pollJob, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [jobId, updateJobProgress, completeJob, failJob, onComplete, onError]);

  return activeJobs[jobId || ""] || null;
}

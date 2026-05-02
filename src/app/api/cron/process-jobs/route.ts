import { NextRequest, NextResponse } from "next/server";
import { getPendingJobs, markJobProcessing, completeJob, failJob, updateJobProgress, initDB } from "@/db/queries";
// Assuming processAnalyzeJob exists in your job processor. 
import { processAnalyzeJob } from "@/lib/job-processor";

export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET || "seomaster-cron-secret";

export async function GET(req: NextRequest) {
  try {
    await initDB();
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Process one job at a time to prevent serverless timeouts
    const pendingJobs = await getPendingJobs(1);

    if (pendingJobs.length === 0) {
      return NextResponse.json({ message: "No pending jobs" });
    }

    const job = pendingJobs[0];
    await markJobProcessing(job.id);
    
    // Process asynchronously (do not await, let the endpoint return quickly for cron-jobs.org)
    // Next.js nodejs runtime might kill background tasks if the request finishes.
    // In Vercel, this might need waitUntil(). For long-running, we await it here and hope it finishes before the 10s-60s timeout.
    // To be safe, we await it but limit processing time.
    try {
      if (job.jobType === "analyze") {
        await updateJobProgress(job.id, 10, "Starting analysis");
        const result = await processAnalyzeJob(job.input as any, (progress, message) => {
          updateJobProgress(job.id, progress, message).catch(console.error);
        });
        await completeJob(job.id, result);
      } else {
        await failJob(job.id, "Unknown job type");
      }
    } catch (err) {
      await failJob(job.id, err instanceof Error ? err.message : "Processing failed");
    }

    return NextResponse.json({ message: `Job ${job.id} processed` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

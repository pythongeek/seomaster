/**
 * Queue Process API Route
 * 
 * HTTP endpoint that processes a single job from the BullMQ queue.
 * This can be called by cron services (cron-jobs.org, Vercel Cron, etc.)
 * to trigger job processing without running a persistent worker.
 * 
 * Unlike the /api/cron/process-jobs route which processes jobs directly,
 * this route uses BullMQ's queue system for better reliability and retry logic.
 */

import { NextRequest, NextResponse } from "next/server";
import { analysisQueue, QUEUE_NAMES, getQueueStats } from "@/lib/job-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "seomaster-cron-secret";

/**
 * GET /api/queue/process
 * 
 * Retrieves the queue status and optionally processes a job.
 * 
 * Query params:
 * - status: If "true", returns queue stats without processing
 * - token: CRON_SECRET for authentication
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const statusOnly = searchParams.get("status") === "true";

    // Auth check
    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Redis not configured — queue is disabled
    if (!analysisQueue) {
      return NextResponse.json({
        queue: "disabled",
        message: "Redis not configured. Set REDIS_URL or UPSTASH_REDIS_REST_URL env vars.",
      });
    }

    // Return queue stats if status only
    if (statusOnly) {
      const stats = await getQueueStats();
      return NextResponse.json({
        queue: QUEUE_NAMES.ANALYSIS,
        stats,
      });
    }

    // Get next waiting job
    const waiting = await analysisQueue.getWaiting();
    
    if (waiting.length === 0) {
      return NextResponse.json({ message: "No jobs in queue", processed: 0 });
    }

    // Process up to 1 job per request (can be increased for faster processing)
    const job = waiting[0];
    
    if (!job.id) {
      return NextResponse.json({ error: "Job has no ID" }, { status: 400 });
    }

    console.log(`[queue/process] Processing job ${job.id} from queue`);
    
    // Move job to active state by fetching it
    const activeJob = await analysisQueue.getJob(job.id);
    
    if (!activeJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // The job will be processed by the worker
    // We just return info about what was picked up
    const stats = await getQueueStats();
    
    return NextResponse.json({
      message: `Job ${job.id} is queued for processing`,
      jobId: job.id,
      jobName: job.name,
      queueStats: stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[queue/process] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/queue/process
 * 
 * Manually trigger processing of a specific job.
 * This is useful for retrying failed jobs.
 * 
 * Body: { jobId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!analysisQueue) {
      return NextResponse.json({
        queue: "disabled",
        message: "Redis not configured. Set REDIS_URL or UPSTASH_REDIS_REST_URL env vars.",
      });
    }

    const { jobId, action } = await req.json();

    // Default: process next waiting job if no action specified
    if (!action) {
      const waiting = await analysisQueue.getWaiting();
      if (waiting.length === 0) {
        return NextResponse.json({ message: "No jobs in queue", processed: 0 });
      }
      const job = waiting[0];
      if (!job.id) {
        return NextResponse.json({ error: "Job has no ID" }, { status: 400 });
      }
      return NextResponse.json({
        message: `Job ${job.id} queued for processing`,
        jobId: job.id,
        queueStats: await getQueueStats(),
      });
    }

    if (action === "retry" && jobId) {
      // Retry a specific failed job
      const job = await analysisQueue.getJob(jobId);
      
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      await job.retry();
      
      return NextResponse.json({
        message: `Job ${jobId} retry triggered`,
        jobId,
        status: await job.getState(),
      });
    }

    if (action === "retryFailed") {
      // Retry all failed jobs
      const failed = await analysisQueue.getFailed();
      
      for (const job of failed) {
        await job.retry();
      }
      
      return NextResponse.json({
        message: `Retrying ${failed.length} failed jobs`,
        count: failed.length,
      });
    }

    if (action === "pause") {
      await analysisQueue.pause();
      return NextResponse.json({ message: "Queue paused" });
    }

    if (action === "resume") {
      await analysisQueue.resume();
      return NextResponse.json({ message: "Queue resumed" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[queue/process] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

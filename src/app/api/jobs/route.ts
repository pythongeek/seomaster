import { NextRequest, NextResponse } from "next/server";
import { createJob, getJob, getPendingJobs, initDB } from "@/db/queries";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const { type, input } = await req.json();

    if (!type || !input) {
      return NextResponse.json({ error: "Missing job type or input" }, { status: 400 });
    }

    const job = await createJob(type, input);

    if (!job) {
      return NextResponse.json({ error: "Failed to create job in database" }, { status: 500 });
    }

    // Trigger processing in the background (self-trigger)
    const CRON_SECRET = process.env.CRON_SECRET || "seomaster-cron-secret";
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    // We use a non-awaited fetch to trigger the processing immediately
    // In Vercel, you might use edge runtime or waitUntil, but this works for simple nodejs runtime too
    fetch(`${baseUrl}/api/cron/process-jobs`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${CRON_SECRET}` },
    }).catch(err => console.error("Self-trigger failed:", err));

    return NextResponse.json({ jobId: job.id, status: "pending" }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await initDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const listPending = searchParams.get("pending");

    if (listPending) {
      const pendingJobs = await getPendingJobs(10);
      return NextResponse.json({ jobs: pendingJobs });
    }

    if (!id) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    }

    const job = await getJob(id);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      progressMessage: job.progressMessage,
      result: job.result,
      error: job.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createJob, getJob, getPendingJobs } from "@/db/queries";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { type, input } = await req.json();

    if (!type || !input) {
      return NextResponse.json({ error: "Missing job type or input" }, { status: 400 });
    }

    const job = await createJob(type, input);

    if (!job) {
      return NextResponse.json({ error: "Failed to create job in database" }, { status: 500 });
    }

    return NextResponse.json({ jobId: job.id, status: "pending" }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
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

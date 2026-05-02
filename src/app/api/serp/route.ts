import { NextRequest, NextResponse } from "next/server";
import { getDynamicBenchmark } from "@/lib/serp-engine";

export async function POST(req: NextRequest) {
  try {
    const { query, position, intent, actualCtr, siteUrl } = await req.json();

    if (!query || position === undefined || !intent) {
      return NextResponse.json({ error: "Missing required fields: query, position, intent" }, { status: 400 });
    }

    const result = await getDynamicBenchmark(query, position, intent, actualCtr, siteUrl);

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

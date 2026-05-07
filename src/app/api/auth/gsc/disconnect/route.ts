import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/database";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email && !req.body) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const userEmail = email || ((await req.json())?.email) || "";

    if (!userEmail) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    await sql`DELETE FROM gsc_oauth_tokens WHERE user_email = ${userEmail}`;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[GSC OAuth] Disconnect error:", err);
    return NextResponse.json({ error: "Disconnect failed" }, { status: 500 });
  }
}

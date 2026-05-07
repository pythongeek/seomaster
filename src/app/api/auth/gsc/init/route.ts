import { NextResponse } from "next/server";
import { sql } from "@/lib/database";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    await sql`
      CREATE TABLE IF NOT EXISTS gsc_oauth_tokens (
        id SERIAL PRIMARY KEY,
        user_email TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_type TEXT DEFAULT 'Bearer',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json({ success: true, message: "Table created/verified" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

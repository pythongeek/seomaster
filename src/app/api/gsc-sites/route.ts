import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/database";

export const runtime = "nodejs";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

async function ensureSchema() {
  if (!sql) return;
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
}

async function getStoredToken(email?: string) {
  if (!sql) return null;
  if (email) {
    const result = await sql`
      SELECT access_token, refresh_token, expires_at, user_email
      FROM gsc_oauth_tokens
      WHERE user_email = ${email}
      LIMIT 1
    `;
    return result.length > 0 ? result[0] : null;
  } else {
    const result = await sql`
      SELECT access_token, refresh_token, expires_at, user_email
      FROM gsc_oauth_tokens
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    return result.length > 0 ? result[0] : null;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.Client_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.Client_secret || "";

  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedEmail = searchParams.get("email");

  try {
    if (!sql) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    console.log("[GSC Sites] sql available:", !!sql);
    await ensureSchema();

    const token = await getStoredToken(requestedEmail || undefined);
    console.log("[GSC Sites] token found:", !!token, requestedEmail);
    if (!token) {
      return NextResponse.json({ error: "Not connected" }, { status: 401 });
    }

    let accessToken = token.access_token as string;
    const isExpired = new Date(token.expires_at as Date) <= new Date();

    if (isExpired) {
      const refreshed = await refreshAccessToken(token.refresh_token as string);
      if (!refreshed) {
        return NextResponse.json({ error: "Token expired. Please reconnect." }, { status: 401 });
      }
      accessToken = refreshed.access_token;
    }

    const gscResp = await fetch(
      "https://searchconsole.googleapis.com/webmasters/v3/sites",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!gscResp.ok) {
      return NextResponse.json({ error: `GSC API error ${gscResp.status}` }, { status: gscResp.status });
    }

    const data = await gscResp.json();
    // GSC Sites API returns { siteEntry: [{ siteUrl, permissionLevel }, ...] }
    const siteEntry: { siteUrl: string; permissionLevel: string }[] = data.siteEntry || data.site || [];
    const sites = siteEntry.map((s) => ({
      url: s.siteUrl,
      permission: s.permissionLevel,
    }));

    return NextResponse.json({ sites });
  } catch (err) {
    console.error("[GSC OAuth] Sites error:", err);
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 });
  }
}

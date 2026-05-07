import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/database";

export const runtime = "nodejs";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

async function getStoredToken(email: string) {
  if (!sql) return null;
  const result = await sql`
    SELECT access_token, refresh_token, expires_at
    FROM gsc_oauth_tokens
    WHERE user_email = ${email}
    LIMIT 1
  `;
  return result.length > 0 ? result[0] : null;
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.Client_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.Client_secret || "";

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
  return res.json();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email") || "gsc-user";

  try {
    const token = await getStoredToken(email);
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
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!gscResp.ok) {
      return NextResponse.json({ error: `GSC API error ${gscResp.status}` }, { status: gscResp.status });
    }

    const data = await gscResp.json();
    const sites = (data.site || []).map((s: { siteUrl: string; permissionLevel: string }) => ({
      url: s.siteUrl,
      permission: s.permissionLevel,
    }));

    return NextResponse.json({ sites });
  } catch (err) {
    console.error("[GSC OAuth] Sites error:", err);
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/database";

export const runtime = "nodejs";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

// Token management
async function getStoredToken(email: string) {
  if (!sql) return null;
  const result = await sql`
    SELECT access_token, refresh_token, expires_at, token_type
    FROM gsc_oauth_tokens
    WHERE user_email = ${email}
    LIMIT 1
  `;
  return result.length > 0 ? result[0] : null;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

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

async function updateStoredToken(email: string, accessToken: string, expiresAt: Date) {
  if (!sql) return;
  await sql`
    UPDATE gsc_oauth_tokens
    SET access_token = ${accessToken}, expires_at = ${expiresAt}, updated_at = CURRENT_TIMESTAMP
    WHERE user_email = ${email}
  `;
}

// ─── GET: Check connection status ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email") || "gsc-user";

  try {
    if (!sql) {
      return NextResponse.json({ connected: false, error: "Database not configured" });
    }

    const token = await getStoredToken(email);

    if (!token) {
      return NextResponse.json({ connected: false });
    }

    // Check if expired
    const isExpired = new Date(token.expires_at) <= new Date();

    return NextResponse.json({
      connected: true,
      email,
      expired: isExpired,
    });
  } catch (err) {
    console.error("[GSC OAuth] Status check error:", err);
    return NextResponse.json({ connected: false, error: "Check failed" }, { status: 500 });
  }
}

// ─── POST: Fetch GSC data using OAuth tokens ─────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { email, siteUrl, startDate, endDate, dimensions, rowLimit } = await req.json();

    if (!siteUrl) {
      return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "email required for OAuth" }, { status: 400 });
    }

    // Get stored token
    const token = await getStoredToken(email);
    if (!token) {
      return NextResponse.json(
        { error: "Google account not connected. Click 'Connect Google' first." },
        { status: 401 }
      );
    }

    // Check expiry and refresh if needed
    let accessToken = token.access_token as string;
    const isExpired = new Date(token.expires_at as Date) <= new Date();

    if (isExpired) {
      const refreshed = await refreshAccessToken(token.refresh_token as string);
      if (!refreshed) {
        return NextResponse.json(
          { error: "Token refresh failed. Please reconnect your Google account." },
          { status: 401 }
        );
      }
      accessToken = refreshed.access_token;
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
      await updateStoredToken(email, accessToken, expiresAt);
    }

    // Fetch from Google Search Console API
    const gscBody: Record<string, unknown> = {
      startDate: startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      endDate: endDate || new Date().toISOString().split("T")[0],
      dimensions: dimensions || ["query", "page"],
      rowLimit: rowLimit || 5000,
    };

    const gscResp = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gscBody),
      }
    );

    if (!gscResp.ok) {
      const errText = await gscResp.text();
      console.error("[GSC OAuth] API error:", gscResp.status, errText);

      // If 401, token might have been revoked
      if (gscResp.status === 401) {
        return NextResponse.json(
          { error: "Google account access expired. Please reconnect." },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: `GSC API error ${gscResp.status}: ${errText}` },
        { status: gscResp.status }
      );
    }

    const data = await gscResp.json();
    const rows = (data.rows || []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
      query: r.keys[0] || "",
      page: r.keys[1] || "",
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: parseFloat((r.ctr * 100).toFixed(4)),
      position: parseFloat(r.position.toFixed(2)),
    }));

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[GSC OAuth] Fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch GSC data" }, { status: 500 });
  }
}

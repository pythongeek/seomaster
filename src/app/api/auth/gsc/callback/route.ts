import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/database";

export const runtime = "nodejs";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.Client_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.Client_secret || "";
const REDIRECT_URI = `https://seomaster-beta.vercel.app/api/auth/gsc/callback`;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// Initialize DB schema if needed
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

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  error?: string;
  error_description?: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?gsc_error=${encodeURIComponent(error)}`, "https://seomaster-beta.vercel.app")
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?gsc_error=no_code", "https://seomaster-beta.vercel.app")
    );
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokens: TokenResponse = await tokenRes.json();

    if (tokens.error || !tokens.access_token) {
      console.error("[GSC OAuth] Token error:", tokens.error_description || tokens.error);
      return NextResponse.redirect(
        new URL(`/?gsc_error=${encodeURIComponent(tokens.error_description || tokens.error || "token_error")}`, "https://seomaster-beta.vercel.app")
      );
    }

    // Get user email from Google
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const userEmail = userInfo.email || "gsc-user";

    // Store tokens in database
    await ensureSchema();

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await (sql!)`
      INSERT INTO gsc_oauth_tokens (user_email, access_token, refresh_token, token_type, expires_at)
      VALUES (
        ${userEmail},
        ${tokens.access_token},
        ${tokens.refresh_token || ""},
        ${tokens.token_type || "Bearer"},
        ${expiresAt}
      )
      ON CONFLICT (user_email) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(NULLIF(EXCLUDED.refresh_token, ''), gsc_oauth_tokens.refresh_token),
        token_type = EXCLUDED.token_type,
        expires_at = EXCLUDED.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `;

    return NextResponse.redirect(
      new URL("/?gsc_connected=1", "https://seomaster-beta.vercel.app")
    );
  } catch (err) {
    console.error("[GSC OAuth] Callback error:", err);
    return NextResponse.redirect(
      new URL("/?gsc_error=callback_error", "https://seomaster-beta.vercel.app")
    );
  }
}

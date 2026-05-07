import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.Client_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.Client_secret || "";
const REDIRECT_URI = `https://seomaster-beta.vercel.app/api/auth/gsc/callback`;

// Google OAuth endpoints
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

function generateState() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const array = new Uint8Array(32);
  require("crypto").randomFillSync(array);
  for (let i = 0; i < 32; i++) result += chars[array[i] % chars.length];
  return result;
}

export async function GET() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to env vars." },
      { status: 500 }
    );
  }

  const state = generateState();

  // Build Google OAuth URL
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

  return NextResponse.json({ authUrl, state });
}

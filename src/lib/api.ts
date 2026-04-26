// AI API helper - routes through OpenRouter for Hermes Agent with MiniMax M2.7
// GSC API helper - uses Service Account for Google Search Console

import { JWT } from 'google-auth-library';

const BASE_URL = process.env.OPENROUTER_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://api.minimax.io/anthropic";
const API_KEY = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || "";
const MODEL = process.env.ANTHROPIC_MODEL || "MiniMax-M2.7";

// GSC Service Account - path to JSON key file (for local dev) or inline credentials
const GSC_SERVICE_ACCOUNT_EMAIL = process.env.GSC_SERVICE_ACCOUNT_EMAIL || "";
const GSC_SERVICE_ACCOUNT_KEY = process.env.GSC_SERVICE_ACCOUNT_KEY || "";
const GSC_SERVICE_ACCOUNT_KEY_FILE = process.env.GSC_SERVICE_ACCOUNT_KEY_FILE || "";

export async function callAI(systemPrompt: string, userContent: string, onChunk?: (text: string) => void): Promise<string> {
  const resp = await fetch(`${BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      stream: false,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`AI API error ${resp.status}: ${error}`);
  }

  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);

  const text = data.content?.map((b: { text?: string }) => b.text || "").join("") || "";
  if (onChunk) onChunk(text);
  return text;
}

export function tryJSON(text: string): unknown {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ─── Google Search Console API with Service Account ─────────────────────────
export interface GSCRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export function parseGSCcsv(csv: string): GSCRow[] {
  const lines = csv.trim().split("\n");
  const headerIdx = lines.findIndex(l =>
    /clicks/i.test(l) && /impressions/i.test(l)
  );
  if (headerIdx < 0) return [];
  const headers = lines[headerIdx].split(",").map(h =>
    h.replace(/"/g, "").trim().toLowerCase()
  );
  return lines.slice(headerIdx + 1).map(line => {
    const cols = line.split(",").map(c => c.replace(/"/g, "").trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ""; });
    return {
      query:       obj.query || obj["top queries"] || "",
      page:        obj.page || obj["landing page"] || "",
      clicks:      parseInt(obj.clicks) || 0,
      impressions: parseInt(obj.impressions) || 0,
      ctr:         parseFloat(String(obj.ctr || "0").replace("%", "")) || 0,
      position:    parseFloat(obj.position) || 0,
    };
  }).filter(r => r.query || r.page);
}

// Get GSC data using Service Account
export async function fetchGSCData(options: {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
}): Promise<GSCRow[]> {
  const { siteUrl, startDate, endDate, dimensions = ["query", "page"], rowLimit = 5000 } = options;

  // Create JWT client from service account credentials
  const client = new JWT({
    email: GSC_SERVICE_ACCOUNT_EMAIL,
    key: GSC_SERVICE_ACCOUNT_KEY || undefined,
    keyFile: GSC_SERVICE_ACCOUNT_KEY_FILE || undefined,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  // Get access token
  await client.authorize();
  const accessToken = client.accessToken || '';

  const resp = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions,
        rowLimit,
      }),
    }
  );

  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`GSC API error ${resp.status}: ${error}`);
  }

  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);

  return (data.rows || []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
    query: r.keys?.[0] || "",
    page: r.keys?.[1] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: (r.ctr || 0) * 100,
    position: r.position || 0,
  }));
}

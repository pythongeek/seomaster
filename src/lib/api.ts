// AI API helper - routes through OpenRouter for Hermes Agent with MiniMax M2.7

const BASE_URL = process.env.OPENROUTER_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://api.minimax.io/anthropic";
const API_KEY = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || "";
const MODEL = process.env.ANTHROPIC_MODEL || "MiniMax-M2.7";

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

// ─── CSV Parser ────────────────────────────────────────────────────────────
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
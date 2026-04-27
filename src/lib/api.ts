// Client-side API helpers
// All AI and GSC calls go through server-side routes (api/ai, api/gsc)
// to keep API keys server-side only.

// ─── Types ─────────────────────────────────────────────────────────────────
export interface GSCRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// ─── AI via server-side route ───────────────────────────────────────────────
export async function callAI(systemPrompt: string, userContent: string): Promise<string> {
  const resp = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userContent }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI API error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.text || '';
}

// ─── CSV Parser ────────────────────────────────────────────────────────────
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

// ─── GSC via server-side route ─────────────────────────────────────────────
export async function fetchGSCData(options: {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
}): Promise<GSCRow[]> {
  const { siteUrl, startDate, endDate, dimensions, rowLimit } = options;

  const resp = await fetch('/api/gsc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteUrl, startDate, endDate, dimensions, rowLimit }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GSC API error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.rows || [];
}

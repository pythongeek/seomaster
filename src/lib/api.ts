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
export function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── CSV Parser ────────────────────────────────────────────────────────────
export function parseGSCcsv(csv: string): GSCRow[] {
  // Robust CSV parsing for quoted fields and commas
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  // Handle BOM if present
  let cleanCsv = csv;
  if (csv.charCodeAt(0) === 0xFEFF) {
    cleanCsv = csv.slice(1);
  }

  for (let i = 0; i < cleanCsv.length; i++) {
    const char = cleanCsv[i];
    const nextChar = cleanCsv[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentField.trim());
        if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
        if (char === '\r' && nextChar === '\n') i++;
      } else {
        currentField += char;
      }
    }
  }
  
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
      rows.push(currentRow);
    }
  }

  const headerIdx = rows.findIndex(r =>
    r.some(c => /clicks/i.test(c)) && r.some(c => /impressions/i.test(c))
  );
  if (headerIdx < 0) return [];

  const headers = rows[headerIdx].map(h => h.toLowerCase().replace(/"/g, "").trim());
  
  return rows.slice(headerIdx + 1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ""; });
    
    const topPages = obj["top pages"] || "";
    const topQueries = obj["top queries"] || "";
    const isUrl = (s: string) => s.startsWith("http") || s.includes("/");

    let query = obj.query || topQueries;
    let page = obj.page || obj["landing page"] || topPages;

    // Smart swap: if query looks like a URL and page is empty, swap them
    // This is common in "Pages" exports where the URL is in the first column
    if (query && !page && isUrl(query)) {
      page = query;
      query = "";
    }

    return {
      query,
      page,
      clicks:      parseInt(obj.clicks.replace(/,/g, "")) || 0,
      impressions: parseInt(obj.impressions.replace(/,/g, "")) || 0,
      ctr:         parseFloat(String(obj.ctr || "0").replace("%", "").replace(/,/g, "")) || 0,
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

import { NextRequest, NextResponse } from 'next/server';
import { sql, saveReport, initDB } from '@/lib/db';

export const runtime = 'nodejs';

interface GSCRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface FilterRequest {
  dataset: GSCRow[];
  searchType?: string;
  regexFilter?: string;
}

interface FilterResult {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface CTROpp {
  query: string;
  page: string;
  impressions: number;
  ctr: number;
  position: number;
  ctrGap: number;
  potentialClicks: number;
  fix: string;
}

interface Cannibalization {
  query: string;
  urls: Array<{ url: string; position: number; clicks: number; ctr: number }>;
  recommendation: string;
}

interface IntentBucket {
  intent: string;
  count: number;
  impressions: number;
  clicks: number;
  avgCTR: number;
}

function classifyIntent(query: string): string {
  const q = query.toLowerCase();
  const transPatterns = /\b(buy|price|cost|pricing|discount|deal|order|checkout|purchase|quote|buy now|get started)\b/i;
  const navPatterns = /^(best top|compare|vs|alternative|review)/i;
  const localPatterns = /\b(near me|nearby|local|location|store|shop hours)\b/i;
  if (transPatterns.test(q)) return 'Transactional';
  if (navPatterns.test(q)) return 'Navigational';
  if (localPatterns.test(q)) return 'Local';
  return 'Informational';
}

function validateRegex(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern, 'i');
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

function applyRegexFilter(rows: GSCRow[], regexFilter: string): FilterResult[] {
  try {
    const regex = new RegExp(regexFilter, 'i');
    return rows.filter(r => regex.test(r.query) || regex.test(r.page));
  } catch {
    return rows;
  }
}

function analyzeIntentDistribution(rows: GSCRow[]): IntentBucket[] {
  const buckets: Record<string, GSCRow[]> = {
    Informational: [], Navigational: [], Transactional: [], Local: [], Commercial: []
  };
  rows.forEach(r => {
    const intent = classifyIntent(r.query);
    buckets[intent].push(r);
  });
  return Object.entries(buckets)
    .filter(([, arr]) => arr.length > 0)
    .map(([intent, arr]) => ({
      intent,
      count: arr.length,
      impressions: arr.reduce((s, r) => s + r.impressions, 0),
      clicks: arr.reduce((s, r) => s + r.clicks, 0),
      avgCTR: arr.length ? arr.reduce((s, r) => s + r.ctr, 0) / arr.length : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

function findCTRGaps(rows: GSCRow[]): CTROpp[] {
  return rows
    .filter(r => r.impressions > 500 && r.position <= 20)
    .map(r => {
      const expectedCTR = Math.min(40, Math.max(2, 20 - r.position * 1.5));
      const ctrGap = expectedCTR - r.ctr;
      const potentialClicks = Math.round(r.impressions * (ctrGap / 100));
      return {
        query: r.query,
        page: r.page,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
        ctrGap: parseFloat(ctrGap.toFixed(2)),
        potentialClicks,
        fix: r.position <= 3
          ? 'Optimize title/meta for immediate CTR boost'
          : 'Improve content depth + schema + internal links to raise ranking, then optimize CTR',
      };
    })
    .filter(r => r.ctrGap > 2)
    .sort((a, b) => b.potentialClicks - a.potentialClicks)
    .slice(0, 15);
}

function findCannibalization(rows: GSCRow[]): Cannibalization[] {
  const queryMap: Record<string, GSCRow[]> = {};
  rows.forEach(r => {
    if (!queryMap[r.query]) queryMap[r.query] = [];
    queryMap[r.query].push(r);
  });
  return Object.entries(queryMap)
    .filter(([, arr]) => arr.length > 1 && arr.every(r => r.clicks > 0))
    .map(([query, arr]) => ({
      query,
      urls: arr
        .sort((a, b) => a.position - b.position)
        .map(r => ({ url: r.page, position: r.position, clicks: r.clicks, ctr: r.ctr })),
      recommendation: arr.length >= 3
        ? `CONSIDER: Merge content into one canonical URL. ${arr[0].page} ranks best — redirect others or add noindex.`
        : `WATCH: ${arr[0].page} dominates. Audit if secondary URL has unique value or should redirect.`,
    }))
    .slice(0, 10);
}

function generateExecutiveSummary(rows: GSCRow[], intentDist: IntentBucket[], ctrGaps: CTROpp[], cannibal: Cannibalization[]): string {
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpr = rows.reduce((s, r) => s + r.impressions, 0);
  const dominantIntent = intentDist[0]?.intent || 'Informational';
  const topCTR = ctrGaps[0];
  return `Dataset of ${rows.length.toLocaleString()} queries reveals ${dominantIntent.toLowerCase()} intent dominates (${intentDist[0]?.count || 0} queries), with ${totalClicks.toLocaleString()} total clicks across ${totalImpr.toLocaleString()} impressions. ${topCTR ? `Top CTR opportunity is "${topCTR.query}" — improving its CTR from ${topCTR.ctr}% to ${(topCTR.ctr + topCTR.ctrGap).toFixed(1)}% could recover ${topCTR.potentialClicks} clicks/month.` : 'No significant CTR gaps detected.'} ${cannibal.length > 0 ? `${cannibal.length} query cannibalization cases detected — multiple URLs competing for the same queries.` : ''}`;
}

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const { dataset, searchType = 'web', regexFilter } = await req.json() as FilterRequest;

    if (!dataset || !Array.isArray(dataset)) {
      return NextResponse.json({ error: 'dataset is required and must be an array' }, { status: 400 });
    }

    if (regexFilter) {
      const regexValidation = validateRegex(regexFilter);
      if (!regexValidation.valid) {
        return NextResponse.json({ error: `Invalid regex: ${regexValidation.error}` }, { status: 400 });
      }
    }

    // Pre-processing
    let filtered = applyRegexFilter(dataset, regexFilter || '');
    filtered = filtered
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 150);

    // AI Processing phases
    const intentDist = analyzeIntentDistribution(filtered);
    const ctrGaps = findCTRGaps(filtered);
    const cannibal = findCannibalization(filtered);
    const executiveSummary = generateExecutiveSummary(filtered, intentDist, ctrGaps, cannibal);

    const result = {
      searchType,
      regexFilter: regexFilter || 'none',
      totalFiltered: filtered.length,
      intentDistribution: intentDist,
      ctrGaps,
      cannibalization: cannibal,
      executiveSummary,
      top5Opportunities: ctrGaps.slice(0, 5).map(r => ({
        query: r.query,
        page: r.page,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
        ctrGap: r.ctrGap,
        potentialClicks: r.potentialClicks,
        action: r.fix,
      })),
      actionPlan: [
        ...(ctrGaps.length ? [`Fix top ${Math.min(5, ctrGaps.length)} CTR gaps — estimated +${ctrGaps.slice(0, 5).reduce((s, r) => s + r.potentialClicks, 0)} clicks/month`] : []),
        ...(cannibal.length ? [`Resolve ${cannibal.length} cannibalization cases — redirect or noindex duplicate URLs`] : []),
        ...(intentDist.filter(i => i.intent === 'Transactional' && i.avgCTR < 3).length ? ['Transactional queries with low CTR: ensure clear CTAs and conversion-focused meta text'] : []),
        'Use AI Overview targeting for informational queries with position ≤10',
      ].filter(Boolean),
    };

    try {
      await saveReport({ report_type: 'filter_engine', title: `Regex Filter — ${searchType} ${regexFilter || ''}`, data: { dataset, searchType, regexFilter }, summary: { totalFiltered: filtered.length, ctrGaps: ctrGaps.length, cannibalCases: cannibal.length } });
    } catch {}

    return NextResponse.json({ result, reportTitle: `Regex Filter — ${searchType}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

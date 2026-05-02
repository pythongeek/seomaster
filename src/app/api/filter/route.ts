import { NextRequest, NextResponse } from 'next/server';
import { saveReport, initDB } from '@/db/queries';

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

interface CTROpp {
  query: string;
  page: string;
  impressions: number;
  ctr: number;
  position: number;
  expectedCTR: number;
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

const CTR_CURVE: Record<number, number> = { 1:28.5,2:15.7,3:11.0,4:8.0,5:5.9,6:4.4,7:3.3,8:2.6,9:2.1,10:1.7,11:1.3,12:1.1,13:0.9,14:0.8,15:0.7,16:0.6,17:0.5,18:0.5,19:0.4,20:0.4 };

function benchCTR(pos: number): number {
  return CTR_CURVE[Math.min(Math.max(Math.round(pos), 1), 20)] ?? 0.3;
}

function classifyIntent(query: string): string {
  const q = query.toLowerCase();
  if (/\b(buy|order|purchase|price|cost|cheap|discount|deal|subscribe|download|free trial)\b/i.test(q)) return 'Transactional';
  if (/\b(best|top|review|compare|vs|alternative|recommended|rated|ranking)\b/i.test(q)) return 'Commercial';
  if (/\b(near me|nearby|local|location|store|open now)\b/i.test(q)) return 'Local';
  if (/\b(login|sign in|official|homepage|dashboard)\b/i.test(q)) return 'Navigational';
  return 'Informational';
}

function validateRegex(pattern: string): boolean {
  try { new RegExp(pattern, 'i'); return true; } catch { return false; }
}

function applyRegexFilter(rows: GSCRow[], regexFilter: string): GSCRow[] {
  try {
    const rx = new RegExp(regexFilter, 'i');
    return rows.filter(r => rx.test(r.query) || rx.test(r.page));
  } catch { return rows; }
}

function analyzeIntentDistribution(rows: GSCRow[]): IntentBucket[] {
  const buckets: Record<string, { count: number; impressions: number; clicks: number; ctrSum: number }> = {};
  for (const r of rows) {
    const intent = classifyIntent(r.query);
    if (!buckets[intent]) buckets[intent] = { count: 0, impressions: 0, clicks: 0, ctrSum: 0 };
    buckets[intent].count++;
    buckets[intent].impressions += r.impressions;
    buckets[intent].clicks += r.clicks;
    buckets[intent].ctrSum += r.ctr;
  }
  return Object.entries(buckets)
    .filter(([, d]) => d.count > 0)
    .map(([intent, d]) => ({
      intent,
      count: d.count,
      impressions: d.impressions,
      clicks: d.clicks,
      avgCTR: parseFloat((d.ctrSum / d.count).toFixed(2)),
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

function findCTRGaps(rows: GSCRow[]): CTROpp[] {
  return rows
    .filter(r => r.impressions > 200 && r.position <= 20)
    .map(r => {
      const expected = benchCTR(r.position);
      const gap = expected - r.ctr;
      return {
        query: r.query,
        page: r.page,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
        expectedCTR: parseFloat(expected.toFixed(2)),
        ctrGap: parseFloat(gap.toFixed(2)),
        potentialClicks: Math.round(Math.max(0, r.impressions * gap / 100)),
        fix: gap > 5
          ? 'Severe underperformance — rewrite title with power words, number, and current year'
          : 'Moderate CTR gap — A/B test title adding specificity or emotional trigger',
      };
    })
    .filter(r => r.ctrGap > 1)
    .sort((a, b) => b.potentialClicks - a.potentialClicks)
    .slice(0, 15);
}

function findCannibalization(rows: GSCRow[]): Cannibalization[] {
  const queryMap: Record<string, GSCRow[]> = {};
  for (const r of rows) {
    if (!queryMap[r.query]) queryMap[r.query] = [];
    if (!queryMap[r.query].some(x => x.page === r.page)) queryMap[r.query].push(r);
  }
  return Object.entries(queryMap)
    .filter(([, urls]) => urls.length > 1)
    .map(([query, urls]) => ({
      query,
      urls: urls.sort((a, b) => a.position - b.position).map(u => ({ url: u.page, position: u.position, clicks: u.clicks, ctr: u.ctr })),
      recommendation: `Canonical "${urls.sort((a,b)=>a.position-b.position)[0].page}" as preferred URL — redirect or noindex competing pages`,
    }))
    .slice(0, 10);
}

function generateExecutiveSummary(filtered: GSCRow[], intentDist: IntentBucket[], ctrGaps: CTROpp[], cannibal: Cannibalization[], searchType: string, regexFilter?: string): string {
  const topCTR = ctrGaps[0];
  return `${filtered.length} queries in filtered set (${searchType} surface${regexFilter ? `, regex: "${regexFilter}"` : ''}). ` +
    `Intent: ${intentDist.map(i => `${i.intent} ${i.count}`).join(', ')}. ` +
    (topCTR ? `Top opportunity: "${topCTR.query}" — recovering its ${topCTR.ctrGap.toFixed(1)}pp CTR gap could yield +${topCTR.potentialClicks} clicks/mo. ` : '') +
    (cannibal.length ? `${cannibal.length} cannibalization cases detected.` : '');
}

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const { dataset, searchType = 'web', regexFilter } = await req.json() as FilterRequest;

    if (!dataset || !Array.isArray(dataset)) {
      return NextResponse.json({ error: 'dataset is required and must be an array' }, { status: 400 });
    }

    if (regexFilter && !validateRegex(regexFilter)) {
      return NextResponse.json({ error: `Invalid regex: "${regexFilter}"` }, { status: 400 });
    }

    let filtered = applyRegexFilter(dataset, regexFilter || '');
    filtered = filtered.sort((a, b) => b.impressions - a.impressions).slice(0, 150);

    const intentDist = analyzeIntentDistribution(filtered);
    const ctrGaps = findCTRGaps(filtered);
    const cannibal = findCannibalization(filtered);
    const executiveSummary = generateExecutiveSummary(filtered, intentDist, ctrGaps, cannibal, searchType, regexFilter);

    const totalImpressions = filtered.reduce((s, r) => s + r.impressions, 0);
    const totalClicks = filtered.reduce((s, r) => s + r.clicks, 0);

    const result = {
      searchType,
      regexFilter: regexFilter || 'none',
      totalFiltered: filtered.length,
      totalImpressions,
      totalClicks,
      intentDistribution: intentDist,
      ctrGaps,
      cannibalization: cannibal,
      executiveSummary,
      top5Opportunities: ctrGaps.slice(0, 5),
      actionPlan: [
        ...(ctrGaps.length ? [`Fix top ${Math.min(5, ctrGaps.length)} CTR gaps → +${ctrGaps.slice(0,5).reduce((s,r)=>s+r.potentialClicks,0)} estimated clicks/mo`] : []),
        ...(cannibal.length ? [`Resolve ${cannibal.length} cannibalization cases — consolidate duplicate-intent URLs`] : []),
        `Prioritise ${intentDist[0]?.intent || 'Informational'} queries (${intentDist[0]?.count || 0} queries, ${(intentDist[0]?.impressions||0).toLocaleString()} impressions)`,
      ],
    };

    try {
      await saveReport({ report_type: 'filter_engine', title: `Regex Filter — ${searchType} "${regexFilter||'all'}"`, data: { searchType, regexFilter }, summary: { totalFiltered: filtered.length, ctrGaps: ctrGaps.length, cannibalCases: cannibal.length } });
    } catch {}

    return NextResponse.json({ result, reportTitle: `Regex Filter — ${searchType}` });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
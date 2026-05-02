import { NextRequest, NextResponse } from 'next/server';
import { initDB, saveReport, saveGSCSnapshot } from '@/db/queries';
import { getGenericBenchmark, getDynamicBenchmark } from '@/lib/serp-engine';
import { callMiniMaxRaw, extractJSON } from '@/lib/ai-client';
import { AISynthesisSchema } from '@/lib/ai-schemas';

export const runtime = 'nodejs';

interface GSCRow {
  query: string; page: string;
  clicks: number; impressions: number; ctr: number; position: number;
}

interface ScoredRow extends GSCRow {
  intent: string; intentCategory: string;
  benchCTR: number; ctrGap: number; ctrRatio: number;
  opportunityScore: number; estimatedClicksLost: number;
  performanceLabel: string;
}

function classifyIntent(q: string): { intent: string; category: string; isQuestion: boolean; isLongTail: boolean } {
  const lower = q.toLowerCase();
  const wordCount = lower.split(/\s+/).length;
  const isQuestion = /^(how|what|why|when|who|which|where|can|does|is|are|should|will|do)\b/i.test(lower);
  const isLongTail = wordCount >= 4;

  if (/\b(buy|order|purchase|checkout|add to cart|get started|sign up|download|install|hire|book|reserve|subscribe|pricing|price|cost|how much|discount|coupon|deal|cheap|free trial)\b/i.test(lower))
    return { intent: 'transactional', category: 'commerce', isQuestion, isLongTail };

  if (/\b(best|top|review|reviews|rated|rating|compare|comparison|vs\b|versus|alternative|alternatives|instead of|pros and cons|worth it|should i buy|recommended|ranking)\b/i.test(lower))
    return { intent: 'commercial', category: 'evaluation', isQuestion, isLongTail };

  if (/\b(near me|nearby|in [a-z]{3,}|local|location|open now|hours|directions|store|shop near)\b/i.test(lower))
    return { intent: 'local', category: 'local', isQuestion, isLongTail };

  if (/\b(login|sign in|log in|account|dashboard|portal|official site|homepage|app)\b/i.test(lower))
    return { intent: 'navigational', category: 'navigation', isQuestion, isLongTail };

  return { intent: 'informational', category: 'educational', isQuestion, isLongTail };
}

function calcOpportunityScore(r: GSCRow, intent: string): number {
  const bench = getGenericBenchmark(r.position);
  const ctrGap = Math.max(0, bench - r.ctr);
  const impactScore = r.impressions * (ctrGap / 100);
  const qualityMultiplier = r.impressions >= 1000 ? 1.5 : r.impressions >= 200 ? 1.0 : 0.5;
  const positionMultiplier = r.position <= 3 ? 0.8 : r.position <= 5 ? 1.2 : r.position <= 10 ? 1.5 : 0.7;
  return impactScore * qualityMultiplier * positionMultiplier;
}

function performanceLabel(ctrRatio: number): string {
  if (ctrRatio >= 1.30) return 'Outperforming';
  if (ctrRatio >= 0.90) return 'At Benchmark';
  if (ctrRatio >= 0.60) return 'Underperforming';
  if (ctrRatio >= 0.30) return 'Critical Gap';
  return 'No Clicks';
}

function detectCannibalization(rows: GSCRow[]) {
  const map: Record<string, GSCRow[]> = {};
  for (const r of rows) {
    if (!r.query) continue;
    if (!map[r.query]) map[r.query] = [];
    if (!map[r.query].some(x => x.page === r.page)) map[r.query].push(r);
  }
  return Object.entries(map)
    .filter(([, urls]) => urls.length > 1)
    .map(([query, urls]) => {
      const sorted = [...urls].sort((a, b) => a.position - b.position);
      const dominant = sorted[0];
      const totalClicks = sorted.reduce((s, u) => s + u.clicks, 0);
      const splitScore = sorted.length * (sorted.slice(1).reduce((s, u) => s + u.impressions, 0) / Math.max(dominant.impressions, 1));
      return {
        query,
        urls: sorted.map(u => ({ url: u.page, position: u.position, clicks: u.clicks, impressions: u.impressions, ctr: u.ctr })),
        dominantUrl: dominant.page,
        totalClicks,
        splitScore: parseFloat(splitScore.toFixed(2)),
        severity: splitScore > 0.5 ? 'High' : splitScore > 0.2 ? 'Medium' : 'Low',
        recommendation: sorted.length >= 3
          ? `CRITICAL: ${sorted.length} URLs competing. Canonical ${dominant.page} as preferred. 301-redirect or noindex the weaker ${sorted.length - 1} URLs.`
          : `Redirect "${sorted[1].page}" to "${dominant.page}" or add a canonical tag pointing to the dominant URL.`,
      };
    })
    .filter(c => c.splitScore > 0.1)
    .sort((a, b) => b.splitScore - a.splitScore)
    .slice(0, 20);
}

function scoreAIOverviewEligibility(r: GSCRow, intent: string): { score: number; label: string; reason: string; optimization: string } {
  let score = 0;
  const q = r.query.toLowerCase();

  if (intent === 'informational') score += 40;
  else if (intent === 'commercial') score += 15;
  else if (intent === 'transactional') score += 5;

  if (/^(how|what|why|when|who|which|where)\b/i.test(q)) score += 20;

  if (/\b(list|top \d|tips|ways|steps|examples|types of|kinds of)\b/i.test(q)) score += 20;
  else if (/\b(guide|tutorial|how-to|explained|definition|meaning)\b/i.test(q)) score += 15;
  else if (/\b(best practices|checklist|cheat sheet|overview)\b/i.test(q)) score += 10;

  if (r.position <= 3) score += 20;
  else if (r.position <= 5) score += 15;
  else if (r.position <= 10) score += 8;

  if (r.impressions >= 1000) score += 10;
  else if (r.impressions >= 200) score += 6;
  else if (r.impressions >= 50) score += 3;

  score = Math.min(100, score);
  const label = score >= 75 ? 'High' : score >= 50 ? 'Medium' : score >= 30 ? 'Low' : 'Unlikely';

  const reason = score >= 75
    ? `Strong informational query with question pattern — Googlebot actively sources these for AI Overview`
    : score >= 50
      ? `Moderate AI Overview potential — improve content structure (add FAQ schema + H2 question headings)`
      : `Low AI Overview fit — focus on standard ranking improvements first`;

  const optimization = r.position > 5
    ? `Reach top 5 first (currently pos ${r.position.toFixed(1)}), then add FAQ schema, direct answer paragraph in first 50 words, and HowTo markup`
    : `Already in top 5 — add: (1) 40-word direct answer in first paragraph, (2) FAQ schema, (3) numbered steps for procedural queries`;

  return { score, label, reason, optimization };
}

function generateTitleFix(r: GSCRow, intent: string): string {
  const q = r.query;
  const pos = r.position;
  const bench = getGenericBenchmark(pos);
  const gap = bench - r.ctr;

  if (gap < 0.5) return 'CTR is already at or above benchmark — monitor and maintain';

  if (intent === 'transactional') {
    if (gap > 5) return `Add power words: "Get [Product] Today — Free Shipping" or include price anchoring`;
    return `Add transactional CTA to title: "Buy | Shop | Order [keyword]" — position ${pos.toFixed(1)} should convert at ${bench.toFixed(1)}%`;
  }
  if (intent === 'commercial') {
    return `Reframe as list/comparison: "Best ${q} in 2025 — [N] Options Compared" — adds specificity that boosts CTR by ~${(gap * 0.6).toFixed(1)}pp`;
  }
  if (/^how/i.test(q)) {
    return `Keep How-To format, add numeric specificity: "How to ${q.replace(/^how to/i, '').trim()} (${['3','5','7'][Math.floor(Math.random()*3)]} Steps)" — brackets lift CTR 15-30%`;
  }
  if (/^what/i.test(q)) {
    return `Make title more direct: "${q.charAt(0).toUpperCase() + q.slice(1)}: Complete Answer + Examples" — definitional queries favour authoritative framing`;
  }
  if (gap > 8) {
    return `Severe underperformance vs position ${pos.toFixed(1)} benchmark (${bench.toFixed(1)}% exp. CTR). Test: (1) Add year [2025], (2) Use number-led title, (3) Add emotional trigger word`;
  }
  return `Add meta description urgency cue + ensure title includes exact match of "${q}" — ${gap.toFixed(1)}pp CTR gap represents ~${Math.round(r.impressions * gap / 100)} lost clicks/mo`;
}

function positionBands(rows: GSCRow[]) {
  const bands = {
    'Top 3 (Featured)': { min: 0, max: 3, queries: 0, clicks: 0, impressions: 0, ctr: 0 },
    'Page 1 Mid (4-6)': { min: 4, max: 6, queries: 0, clicks: 0, impressions: 0, ctr: 0 },
    'Page 1 Bottom (7-10)': { min: 7, max: 10, queries: 0, clicks: 0, impressions: 0, ctr: 0 },
    'Page 2 (11-20)': { min: 11, max: 20, queries: 0, clicks: 0, impressions: 0, ctr: 0 },
    'Page 3+ (21+)': { min: 21, max: Infinity, queries: 0, clicks: 0, impressions: 0, ctr: 0 },
  };
  for (const r of rows) {
    for (const [, band] of Object.entries(bands)) {
      if (r.position > band.min && r.position <= band.max) {
        band.queries++; band.clicks += r.clicks;
        band.impressions += r.impressions; band.ctr += r.ctr;
      }
    }
  }
  return Object.fromEntries(
    Object.entries(bands).map(([label, band]) => [
      label,
      {
        queries: band.queries,
        clicks: band.clicks,
        impressions: band.impressions,
        avgCTR: band.queries ? parseFloat((band.ctr / band.queries).toFixed(2)) : 0,
        benchmarkCTR: parseFloat(getGenericBenchmark((band.min + band.max) / 2).toFixed(2)),
        efficiency: band.queries && band.impressions
          ? parseFloat(((band.clicks / band.impressions) * 100 / Math.max(getGenericBenchmark((band.min + band.max) / 2), 0.1)).toFixed(2))
          : 0,
      }
    ])
  );
}

function classifyContentGap(r: GSCRow): { type: string; priority: string; action: string } {
  if (r.impressions > 5000 && r.clicks === 0)
    return { type: 'Volume Gap', priority: 'P0 Critical', action: 'Immediate rewrite — 5K+ impressions with zero clicks means severe title/meta mismatch or SERP feature blocking' };
  if (r.impressions > 1000 && r.clicks === 0)
    return { type: 'Volume Gap', priority: 'P1 High', action: 'Rewrite title and meta — 1K+ impressions with zero clicks indicates CTR issue, not ranking issue' };
  if (r.impressions > 500 && r.clicks === 0)
    return { type: 'Ranking Gap', priority: 'P2 Medium', action: 'Position is too low (or content is not compelling enough) — improve content depth and add internal links' };
  if (r.impressions > 100 && r.clicks === 0)
    return { type: 'Opportunity', priority: 'P3 Low', action: 'Monitor — low-volume zero-click. May be featured snippet or PAA absorbing clicks' };
  return { type: 'Noise', priority: 'P4 Ignore', action: 'Insufficient data to draw conclusions' };
}

function siteHealthScore(rows: GSCRow[]): { score: number; grade: string; breakdown: Record<string, number> } {
  if (!rows.length) return { score: 0, grade: 'N/A', breakdown: {} };

  const avgPos = rows.reduce((s, r) => s + r.position, 0) / rows.length;
  const avgCTR = rows.reduce((s, r) => s + r.ctr, 0) / rows.length;
  const p1Ratio = rows.filter(r => r.position <= 10).length / rows.length;
  const zeroClickRatio = rows.filter(r => r.clicks === 0).length / rows.length;
  const highCTRRatio = rows.filter(r => {
    const bench = getGenericBenchmark(r.position);
    return r.ctr >= bench * 0.9;
  }).length / rows.length;

  const posScore = Math.max(0, 100 - (avgPos - 1) * 4);
  const ctrScore = Math.min(100, (avgCTR / 5) * 100);
  const coverageScore = p1Ratio * 100;
  const zeroClickPenalty = (1 - zeroClickRatio) * 100;
  const efficiencyScore = highCTRRatio * 100;

  const composite = posScore * 0.25 + ctrScore * 0.25 + coverageScore * 0.20 + zeroClickPenalty * 0.15 + efficiencyScore * 0.15;
  const score = Math.round(Math.min(100, Math.max(0, composite)));
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  return {
    score, grade,
    breakdown: {
      positionScore: Math.round(posScore),
      ctrScore: Math.round(ctrScore),
      coverageScore: Math.round(coverageScore),
      zeroClickPenalty: Math.round(zeroClickPenalty),
      efficiencyScore: Math.round(efficiencyScore),
    }
  };
}

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const body = await req.json();
    const { data: rows, options = {} } = body as { data: GSCRow[]; options: { siteUrl?: string; startDate?: string; endDate?: string } };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'data array is required and must not be empty' }, { status: 400 });
    }

    const siteUrl   = options.siteUrl || 'unknown';
    const startDate = options.startDate || '';
    const endDate   = options.endDate || '';
    const dateRange = `${startDate} → ${endDate}`;

    const scored: ScoredRow[] = rows.map((r: GSCRow) => {
      const { intent } = classifyIntent(r.query);
      const bench = getGenericBenchmark(r.position);
      const ctrGap = bench - r.ctr;
      const ctrRatio = r.ctr / Math.max(bench, 0.01);
      const oScore = calcOpportunityScore(r, intent);
      const clicksLost = Math.round(Math.max(0, r.impressions * (ctrGap / 100)));
      return {
        ...r,
        intent,
        intentCategory: classifyIntent(r.query).category,
        benchCTR: parseFloat(bench.toFixed(2)),
        ctrGap: parseFloat(ctrGap.toFixed(2)),
        ctrRatio: parseFloat(ctrRatio.toFixed(3)),
        opportunityScore: parseFloat(oScore.toFixed(2)),
        estimatedClicksLost: clicksLost,
        performanceLabel: performanceLabel(ctrRatio),
      };
    });

    const totalClicks = rows.reduce((s: number, r: GSCRow) => s + r.clicks, 0);
    const totalImpressions = rows.reduce((s: number, r: GSCRow) => s + r.impressions, 0);
    const avgCTR = rows.reduce((s: number, r: GSCRow) => s + r.ctr, 0) / rows.length;
    const avgPosition = rows.reduce((s: number, r: GSCRow) => s + r.position, 0) / rows.length;

    const benchmarkClicks = rows.reduce((s: number, r: GSCRow) => {
      return s + r.impressions * getGenericBenchmark(r.position) / 100;
    }, 0);
    const potentialClicksGain = Math.round(Math.max(0, benchmarkClicks - totalClicks));

    const perfDist: Record<string, number> = { 'Outperforming': 0, 'At Benchmark': 0, 'Underperforming': 0, 'Critical Gap': 0, 'No Clicks': 0 };
    scored.forEach(r => { perfDist[r.performanceLabel] = (perfDist[r.performanceLabel] || 0) + 1; });

    const intentDist: Record<string, number> = {};
    scored.forEach(r => { intentDist[r.intent] = (intentDist[r.intent] || 0) + 1; });

    const ctrOpportunities = scored
      .filter(r => r.impressions >= 50 && r.ctrGap > 0.5 && r.position <= 30)
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 25)
      .map(r => ({
        query: r.query, page: r.page,
        impressions: r.impressions, clicks: r.clicks,
        ctr: r.ctr, benchmarkCTR: r.benchCTR,
        ctrGap: r.ctrGap, ctrRatio: r.ctrRatio,
        position: parseFloat(r.position.toFixed(1)),
        estimatedClicksLost: r.estimatedClicksLost,
        opportunityScore: r.opportunityScore,
        performanceCategory: r.performanceLabel,
        intent: r.intent,
        fix: generateTitleFix(r, r.intent),
      }));

    const quickWins = scored
      .filter(r => r.position >= 4 && r.position <= 10 && r.impressions >= 50)
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 15)
      .map(r => ({
        query: r.query, page: r.page,
        position: parseFloat(r.position.toFixed(1)),
        clicks: r.clicks, impressions: r.impressions,
        currentCTR: r.ctr, benchmarkCTR: r.benchCTR,
        ctrGap: r.ctrGap,
        estimatedTrafficGain: r.estimatedClicksLost,
        effort: r.position <= 6 ? 'Low' : 'Medium',
        action: `Improve content depth + E-E-A-T signals + internal links pointing to this page — pos ${r.position.toFixed(1)} can realistically reach top 3`,
      }));

    const contentGaps = rows
      .filter((r: GSCRow) => r.impressions >= 100 && r.clicks === 0)
      .sort((a: GSCRow, b: GSCRow) => b.impressions - a.impressions)
      .slice(0, 20)
      .map((r: GSCRow) => {
        const { type: gapType, priority, action } = classifyContentGap(r);
        return { query: r.query, page: r.page, impressions: r.impressions, position: r.position, gapType, priority, action };
      });

    const aiOverviewCandidates = scored
      .filter(r => r.impressions >= 50)
      .map(r => {
        const { score, label, reason, optimization } = scoreAIOverviewEligibility(r, r.intent);
        return { query: r.query, page: r.page, impressions: r.impressions, position: r.position, ctr: r.ctr, intent: r.intent, aiScore: score, aiEligibility: label, reason, optimization };
      })
      .filter(r => r.aiScore >= 40)
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 15);

    const cannibalization = detectCannibalization(rows);
    const bands = positionBands(rows);
    const healthScore = siteHealthScore(rows);

    const pageMap: Record<string, { clicks: number; impressions: number; ctrSum: number; count: number }> = {};
    for (const r of rows as GSCRow[]) {
      if (!r.page) continue;
      if (!pageMap[r.page]) pageMap[r.page] = { clicks: 0, impressions: 0, ctrSum: 0, count: 0 };
      pageMap[r.page].clicks += r.clicks;
      pageMap[r.page].impressions += r.impressions;
      pageMap[r.page].ctrSum += r.ctr;
      pageMap[r.page].count++;
    }
    const topPages = Object.entries(pageMap)
      .map(([page, d]) => ({ page, clicks: d.clicks, impressions: d.impressions, avgCTR: parseFloat((d.ctrSum / d.count).toFixed(2)), queries: d.count }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 15);

    const ruleBasedRecommendations = [
      ctrOpportunities.filter(o => o.performanceCategory === 'Critical Gap').length > 0
        ? `${ctrOpportunities.filter(o => o.performanceCategory === 'Critical Gap').length} queries in CRITICAL CTR gap — title/meta overhaul needed immediately`
        : null,
      quickWins.length > 0
        ? `${quickWins.length} quick-win targets in positions 4-10 — estimated recovery +${quickWins.reduce((s, w) => s + w.estimatedTrafficGain, 0).toLocaleString()} clicks/mo`
        : null,
      contentGaps.filter(g => g.priority === 'P0 Critical' || g.priority === 'P1 High').length > 0
        ? `${contentGaps.filter(g => g.priority === 'P0 Critical' || g.priority === 'P1 High').length} high-priority content gaps with 1K+ impressions and zero clicks`
        : null,
      aiOverviewCandidates.filter(t => t.aiEligibility === 'High').length > 0
        ? `${aiOverviewCandidates.filter(t => t.aiEligibility === 'High').length} queries are strong AI Overview candidates — add FAQ schema + direct answers`
        : null,
      cannibalization.filter(c => c.severity === 'High').length > 0
        ? `${cannibalization.filter(c => c.severity === 'High').length} severe keyword cannibalization cases — URLs are splitting ranking signals`
        : null,
      `Site Health Score: ${healthScore.score}/100 (Grade ${healthScore.grade}) — benchmark click potential: ${Math.round(benchmarkClicks).toLocaleString()} vs actual ${totalClicks.toLocaleString()} (${potentialClicksGain.toLocaleString()} click gap)`,
    ].filter(Boolean).join(' | ');

    const ruleBasedResult = {
      overview: {
        totalQueries: rows.length, totalClicks, totalImpressions,
        avgCTR: parseFloat(avgCTR.toFixed(2)),
        avgPosition: parseFloat(avgPosition.toFixed(1)),
        potentialClicksGain,
        benchmarkClicks: Math.round(benchmarkClicks),
        performanceDistribution: perfDist,
        intentDistribution: intentDist,
      },
      ctrOpportunities,
      quickWins,
      contentGaps,
      aiOverviewCandidates,
      cannibalization,
      positionBands: bands,
      topPages,
      healthScore,
      ruleBasedRecommendations,
    };

    let aiSynthesis: Record<string, unknown> | null = null;
    try {
      const topOpps = ctrOpportunities.slice(0, 6).map(o =>
        `"${o.query}" | pos ${o.position} | CTR ${o.ctr}% vs benchmark ${o.benchmarkCTR}% | gap ${o.ctrGap}pp | -${o.estimatedClicksLost} clicks/mo`
      ).join('\n');

      const qwList = quickWins.slice(0, 5).map(w =>
        `"${w.query}" | pos ${w.position} | CTR ${w.currentCTR}% | +${w.estimatedTrafficGain} clicks/mo if pushed to top 3`
      ).join('\n');

      const aiPrompt = `GOOGLE SEARCH CONSOLE DATA — FULL ALGORITHMIC ANALYSIS RESULTS:

## Site: ${siteUrl} | Period: ${dateRange}
## Health Score: ${healthScore.score}/100 (Grade ${healthScore.grade})

### Aggregate Metrics
- Queries: ${rows.length.toLocaleString()} | Clicks: ${totalClicks.toLocaleString()} | Impressions: ${totalImpressions.toLocaleString()}
- Avg CTR: ${avgCTR.toFixed(2)}% | Avg Position: ${avgPosition.toFixed(1)}
- Benchmark click potential: ${Math.round(benchmarkClicks).toLocaleString()} | Click gap: ${potentialClicksGain.toLocaleString()}
- Performance: Outperforming: ${perfDist['Outperforming']}, At Benchmark: ${perfDist['At Benchmark']}, Underperforming: ${perfDist['Underperforming']}, Critical Gap: ${perfDist['Critical Gap']}

### Top CTR Opportunities (ranked by algorithm)
${topOpps || 'None above threshold'}

### Quick Wins — Positions 4-10
${qwList || 'None identified'}

### Content Gaps
${contentGaps.slice(0, 5).map(g => `"${g.query}" | ${g.impressions} impr, 0 clicks | ${g.priority}`).join('\n') || 'None'}

### Cannibalization Cases
${cannibalization.slice(0, 3).map(c => `"${c.query}" — ${c.urls.length} URLs competing | Severity: ${c.severity}`).join('\n') || 'None detected'}

### AI Overview Candidates (top 5)
${aiOverviewCandidates.slice(0, 5).map(a => `"${a.query}" | Score: ${a.aiScore}/100 | ${a.aiEligibility} eligibility`).join('\n') || 'None'}

### Intent Distribution
${Object.entries(intentDist).map(([k, v]) => `${k}: ${v}`).join(' | ')}

Provide expert SEO synthesis in this EXACT JSON structure (no markdown fences):
{
  "summary": "2-3 sentence verdict on the site's SEO health",
  "topPriorityActions": ["Action 1 with specific data citation", "Action 2 with specific data citation", "Action 3 with specific data citation"],
  "aiOverviewStrategy": "Specific strategy for the top AI Overview candidates above",
  "contentStrategy": "Data-backed content recommendation based on intent distribution and gaps",
  "quickestWin": "Single highest-ROI action that can be done this week"
}`;

      const aiRaw = await callMiniMaxRaw(
        'You are a senior SEO strategist. You receive fully-processed algorithmic analysis. Return only valid JSON matching the schema. No markdown, no code fences, no explanation outside the JSON.',
        aiPrompt,
        2000
      );

      const clean = aiRaw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      try { aiSynthesis = JSON.parse(clean); }
      catch { aiSynthesis = { summary: aiRaw.slice(0, 400), topPriorityActions: [], raw: true }; }

    } catch (aiErr) {
      console.warn('AI synthesis failed:', (aiErr as Error).message);
    }

    try {
      await saveGSCSnapshot({ site_url: siteUrl, date_range: dateRange, data: rows.slice(0, 500), metrics: ruleBasedResult.overview });
      await saveReport({
        report_type: 'gsc_full',
        title: `GSC — ${siteUrl || 'site'} (${dateRange || new Date().toLocaleDateString()}) — ${rows.length} queries`,
        data: rows.slice(0, 100),
        summary: ruleBasedResult.overview,
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      result: ruleBasedResult,
      aiSynthesis,
      metadata: {
        analyzedAt: new Date().toISOString(),
        rowsAnalyzed: rows.length,
        siteUrl,
        dateRange,
        analysisMode: aiSynthesis ? 'hybrid (algorithmic + AI M2.7)' : 'algorithmic only',
        algorithmsRun: [
          'Industry CTR Benchmark Curve (Advanced Web Ranking)',
          'Intent Classification (multi-signal)',
          'Composite Opportunity Scoring',
          'AI Overview Eligibility Scoring',
          'Cannibalization Detection',
          'Site Health Composite Score',
          'Position Band Cohort Analysis',
          'Content Gap Classification',
        ],
      }
    });

  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
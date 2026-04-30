import { NextRequest, NextResponse } from 'next/server';
import { sql, saveReport, initDB, saveGSCSnapshot } from '@/lib/db';

export const runtime = 'nodejs';

interface GSCRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// ─── Industry Standard CTR Benchmarks by Position ──────────────────────────
const CTR_BENCHMARKS: Record<number, { ctr: number; label: string }> = {
  1:  { ctr: 28.5, label: "Position 1" },
  2:  { ctr: 15.2, label: "Position 2" },
  3:  { ctr: 9.8,  label: "Position 3" },
  4:  { ctr: 7.0,  label: "Position 4" },
  5:  { ctr: 5.4,  label: "Position 5" },
  6:  { ctr: 4.2,  label: "Position 6" },
  7:  { ctr: 3.4,  label: "Position 7" },
  8:  { ctr: 3.0,  label: "Position 8" },
  9:  { ctr: 2.6,  label: "Position 9" },
  10: { ctr: 2.2,  label: "Position 10" },
  11: { ctr: 1.5,  label: "Positions 11-20" },
  12: { ctr: 1.3,  label: "Positions 11-20" },
  13: { ctr: 1.1,  label: "Positions 11-20" },
  14: { ctr: 0.9,  label: "Positions 11-20" },
  15: { ctr: 0.8,  label: "Positions 11-20" },
  16: { ctr: 0.7,  label: "Positions 11-20" },
  17: { ctr: 0.6,  label: "Positions 11-20" },
  18: { ctr: 0.5,  label: "Positions 11-20" },
  19: { ctr: 0.4,  label: "Positions 11-20" },
  20: { ctr: 0.3,  label: "Positions 11-20" },
};

function getBenchmarkCTR(position: number): number {
  if (position <= 0) return 0;
  if (position >= 20) return 0.2;
  return CTR_BENCHMARKS[Math.round(position)]?.ctr ?? 0.2;
}

function classifyIntent(query: string): { intent: string; category: string; commercialSignals: boolean } {
  const q = query.toLowerCase();
  const infoPatterns = /^(how|what|why|when|where|who|which|can i|is it|tutorial|guide)/i;
  const navPatterns = /^(best top|compare|vs|alternative|review)/i;
  const transPatterns = /\b(buy|price|cost|pricing|discount|deal|order|checkout|purchase|quote|buy now|get started)\b/i;
  const localPatterns = /\b(near me|nearby|local|location|store|shop hours)\b/i;

  let intent = 'informational', category = 'educational', commercialSignals = false;

  if (transPatterns.test(q)) { intent = 'transactional'; category = 'commerce'; commercialSignals = true; }
  else if (navPatterns.test(q)) { intent = 'navigational'; category = 'discovery'; commercialSignals = true; }
  else if (localPatterns.test(q)) { intent = 'local'; category = 'local'; commercialSignals = false; }
  else if (infoPatterns.test(q)) { intent = 'informational'; category = 'educational'; commercialSignals = false; }

  return { intent, category, commercialSignals };
}

function priorityScore(row: GSCRow): number {
  const benchmark = getBenchmarkCTR(row.position);
  const ctrRatio = row.ctr / Math.max(benchmark, 0.1);
  const ctrOpportunity = row.impressions > 100 ? (row.impressions * Math.max(0, (1 - ctrRatio))) : 0;
  const positionMomentum = row.position >= 4 && row.position <= 10 ? (10 - row.position) * 10 : 0;
  const clickValue = row.clicks * (row.position <= 10 ? 1.5 : 1);
  const trafficPotential = row.impressions * Math.max(0, (benchmark - row.ctr) / 100) * (1 / Math.max(row.position, 1));
  return ctrOpportunity * 0.3 + positionMomentum * 0.25 + clickValue * 0.25 + trafficPotential * 0.2;
}

async function callMiniMax(systemPrompt: string, userContent: string): Promise<string> {
  const BASE_URL = process.env.ANTHROPIC_BASE_URL || process.env.OPENROUTER_BASE_URL || "https://api.minimax.io/anthropic";
  const API_KEY = process.env.ANTHROPIC_AUTH_TOKEN || process.env.OPENROUTER_API_KEY || "";
  const MODEL = process.env.ANTHROPIC_MODEL || "MiniMax-M2.7";

  if (!API_KEY) throw new Error("AI API key not configured");

  const resp = await fetch(`${BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      stream: false,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  const responseText = await resp.text();
  if (!resp.ok) {
    let errorMsg = `AI API error ${resp.status}: ${responseText}`;
    try {
      const parsed = JSON.parse(responseText);
      if (parsed.error?.error?.message) errorMsg = parsed.error.error.message;
      else if (parsed.error?.message) errorMsg = parsed.error.message;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = JSON.parse(responseText);
  if (data.error) throw new Error(data.error?.error?.message || data.error?.message || JSON.stringify(data.error));
  return data.content?.map((b: { text?: string }) => b.text || "").join("") || "";
}

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const { type, data: rows, options } = await req.json();

    if (!type || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'type and data (array) are required' }, { status: 400 });
    }

    const siteUrl = (options?.siteUrl as string) || 'unknown';
    const dateRange = `${options?.startDate || '2025-01-01'} to ${options?.endDate || '2025-04-01'}`;

    // ─── Rule-Based Analysis ───────────────────────────────────────────────
    const totalRows = rows.length;
    const totalClicks = rows.reduce((s: number, r: GSCRow) => s + r.clicks, 0);
    const totalImpressions = rows.reduce((s: number, r: GSCRow) => s + r.impressions, 0);
    const avgCTR = rows.length ? rows.reduce((s: number, r: GSCRow) => s + r.ctr, 0) / rows.length : 0;
    const avgPosition = rows.length ? rows.reduce((s: number, r: GSCRow) => s + r.position, 0) / rows.length : 0;

    const scored = rows.map((r: GSCRow) => {
      const benchmark = getBenchmarkCTR(r.position);
      return {
        ...r,
        priorityScore: priorityScore(r),
        benchmarkCTR: benchmark,
        ctrGap: benchmark - r.ctr,
        ctrRatio: r.ctr / Math.max(benchmark, 0.1),
      };
    });

    // CTR Opportunities — queries underperforming vs benchmark
    const ctrOpportunities = scored
      .filter((r: any) => r.impressions > 200 && r.ctrGap > 1 && r.position <= 20)
      .sort((a: any, b: any) => (b.ctrGap * b.impressions) - (a.ctrGap * a.impressions))
      .slice(0, 20)
      .map((r: any) => ({
        query: r.query, page: r.page, impressions: r.impressions, ctr: r.ctr, position: r.position,
        benchmarkCTR: parseFloat(r.benchmarkCTR.toFixed(1)),
        ctrGap: parseFloat(r.ctrGap.toFixed(2)),
        ctrRatio: parseFloat(r.ctrRatio.toFixed(2)),
        estimatedClicksLost: Math.round(r.impressions * (r.ctrGap / 100)),
        priority: r.priorityScore,
        performanceCategory: r.ctrRatio >= 1.2 ? 'Outperforming' : r.ctrRatio >= 0.8 ? 'At Benchmark' : r.ctrRatio >= 0.5 ? 'Underperforming' : 'Critical Gap',
        fix: r.position <= 3
          ? `CTR ${r.ctrRatio < 0.5 ? 'critically low' : 'below benchmark'} — optimize title/meta for immediate CTR boost`
          : `CTR gap of ${r.ctrGap.toFixed(1)}pp vs position ${r.position} benchmark — improve content + schema + internal links`,
      }));

    // Quick Wins — positions 4-10 with high traffic potential
    const quickWins = scored
      .filter((r: any) => r.position >= 4 && r.position <= 10 && r.clicks > 20)
      .sort((a: any, b: any) => b.priorityScore - a.priorityScore)
      .slice(0, 12)
      .map((r: any) => ({
        query: r.query, page: r.page, position: r.position, clicks: r.clicks, impressions: r.impressions,
        estimatedTrafficGain: Math.round(r.clicks * 0.3),
        effort: r.position >= 7 ? 'Low' : 'Medium',
        action: 'Improve content quality + internal links + schema to outrank competitors',
        currentCTR: parseFloat(r.ctr.toFixed(1)),
        benchmarkCTR: parseFloat(r.benchmarkCTR.toFixed(1)),
      }));

    // Content Gaps — high impressions but zero clicks
    const contentGaps = scored
      .filter((r: any) => r.impressions > 500 && r.clicks === 0)
      .sort((a: any, b: any) => b.impressions - a.impressions)
      .slice(0, 15)
      .map((r: any) => ({
        query: r.query, page: r.page, impressions: r.impressions, position: r.position,
        issue: r.position > 10 ? 'Ranking issue — need backlinks + content depth' : 'Title/meta not compelling enough despite ranking',
        priority: 'High',
      }));

    // AI Overview Candidates
    const aiOverviewCandidates = scored
      .filter((r: any) => {
        const q = r.query.toLowerCase();
        return r.impressions > 100 && r.position <= 20 &&
          (/how|what|why|which/i.test(q) || /\b(list|tips|steps|examples|types)/i.test(q));
      })
      .sort((a: any, b: any) => b.priorityScore - a.priorityScore)
      .slice(0, 15)
      .map((r: any) => ({
        query: r.query, page: r.page, intent: classifyIntent(r.query).intent,
        impressions: r.impressions, position: r.position, ctr: r.ctr,
        aiEligibility: r.position <= 5 ? 'High' : r.position <= 10 ? 'Medium' : 'Low',
        contentSuggestion: r.position > 5
          ? `Position ${r.position} — need top 5 for AI Overview. Focus on E-E-A-T + structured content.`
          : `Top ${r.position} — optimize for AI Overview: definitions, lists, step-by-step, FAQ schema`,
      }));

    // Intent Distribution
    const intentCounts = { informational: 0, transactional: 0, navigational: 0, commercial: 0 };
    rows.forEach((r: GSCRow) => {
      const { intent } = classifyIntent(r.query);
      (intentCounts as any)[intent]++;
    });

    // Performance Distribution
    const perfDist = { Outperforming: 0, 'At Benchmark': 0, Underperforming: 0, 'Critical Gap': 0 };
    scored.forEach((r: any) => {
      const cat = r.ctrRatio >= 1.2 ? 'Outperforming' : r.ctrRatio >= 0.8 ? 'At Benchmark' : r.ctrRatio >= 0.5 ? 'Underperforming' : 'Critical Gap';
      (perfDist as any)[cat]++;
    });

    // Benchmark-aware potential clicks
    const top10Rows = rows.filter((r: GSCRow) => r.position <= 10);
    const benchmarkClicks = top10Rows.reduce((s: number, r: GSCRow) => s + r.impressions * (getBenchmarkCTR(r.position) / 100), 0);
    const potentialClicksGain = Math.round(benchmarkClicks - totalClicks);

    const ruleBasedResult = {
      overview: {
        totalQueries: totalRows, totalClicks, totalImpressions,
        avgCTR: parseFloat(avgCTR.toFixed(2)), avgPosition: parseFloat(avgPosition.toFixed(1)),
        potentialClicksGain, benchmarkClicks: Math.round(benchmarkClicks),
        performanceDistribution: perfDist,
      },
      ctrOpportunities,
      quickWins,
      contentGaps,
      aiOverviewCandidates,
      intentDistribution: intentCounts,
      ruleBasedRecommendations: [
        ...(ctrOpportunities.filter((o: any) => o.performanceCategory === 'Critical Gap').length
          ? [`⚠️ ${ctrOpportunities.filter((o: any) => o.performanceCategory === 'Critical Gap').length} queries have critical CTR gaps — immediate title/meta audit needed`]
          : []),
        ...(quickWins.length ? [`🎯 ${quickWins.length} quick win opportunities in positions 4-10 — estimated +${quickWins.reduce((s: number, w: any) => s + w.estimatedTrafficGain, 0)} clicks/month`] : []),
        ...(contentGaps.length ? [`📝 ${contentGaps.length} content gaps with impressions but zero clicks`] : []),
        ...(aiOverviewCandidates.filter((t: any) => t.aiEligibility === 'High').length
          ? [`🤖 ${aiOverviewCandidates.filter((t: any) => t.aiEligibility === 'High').length} AI Overview candidates in positions 1-5`]
          : []),
      ].join(' | '),
    };

    // ─── AI Agentic Synthesis ──────────────────────────────────────────────
    let aiSynthesis = null;
    try {
      const topOpportunities = ctrOpportunities.slice(0, 5).map((o: any) =>
        `Query: "${o.query}" | Page: ${o.page} | CTR: ${o.ctr}% (benchmark: ${o.benchmarkCTR}%) | Gap: ${o.ctrGap}pp | Position: ${o.position} | Est. clicks lost: ${o.estimatedClicksLost}/mo`
      ).join('\n');

      const quickWinList = quickWins.slice(0, 5).map((w: any) =>
        `Query: "${w.query}" | Position: ${w.position} | Current CTR: ${w.currentCTR}% | Benchmark: ${w.benchmarkCTR}% | Potential gain: +${w.estimatedTrafficGain} clicks/mo`
      ).join('\n');

      const aiPrompt = `You are an expert SEO analyst. Based on this Google Search Console data analysis:

## Rule-Based Analysis Summary
- Total Queries: ${totalRows.toLocaleString()}
- Total Clicks: ${totalClicks.toLocaleString()}
- Total Impressions: ${totalImpressions.toLocaleString()}
- Average CTR: ${avgCTR.toFixed(1)}%
- Average Position: ${avgPosition.toFixed(1)}
- Potential Clicks at Benchmark: ${Math.round(benchmarkClicks).toLocaleString()}
- Performance Distribution: ${JSON.stringify(perfDist)}

## Top 5 CTR Opportunities
${topOpportunities || 'None identified'}

## Top 5 Quick Wins (Positions 4-10)
${quickWinList || 'None identified'}

## Intent Distribution
${JSON.stringify(intentCounts)}

Analyze this data and provide:
1. Executive summary (2-3 sentences)
2. Top 3 priority actions with specific effort/impact estimates
3. AI Overview optimization strategy
4. Content strategy recommendations based on intent distribution

Format your response as structured JSON with these keys: summary, topPriorityActions (array of 3), aiOverviewStrategy, contentStrategy.`;

      const aiText = await callMiniMax("You are an expert SEO analyst with deep knowledge of CTR optimization, AI Overview eligibility, and content strategy. Provide concise, data-driven recommendations.", aiPrompt);
      try { aiSynthesis = JSON.parse(aiText); } catch { aiSynthesis = { raw: aiText }; }
    } catch (aiErr) {
      console.warn('AI synthesis failed, using rule-based only:', aiErr);
    }

    // ─── Save to DB ─────────────────────────────────────────────────────────
    try {
      await saveGSCSnapshot({ site_url: siteUrl, date_range: dateRange, data: rows, metrics: ruleBasedResult.overview });
      await saveReport({ report_type: 'gsc_full', title: `GSC Analysis — ${siteUrl} (${dateRange})`, data: rows, summary: ruleBasedResult.overview });
    } catch {}

    return NextResponse.json({
      result: ruleBasedResult,
      aiSynthesis,
      metadata: {
        analyzedAt: new Date().toISOString(),
        rowsAnalyzed: totalRows,
        siteUrl,
        dateRange,
        analysisMode: aiSynthesis ? 'hybrid (rule-based + AI agentic)' : 'rule-based only',
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
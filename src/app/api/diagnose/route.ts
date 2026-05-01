import { NextRequest, NextResponse } from 'next/server';
import {
  classifyKeywordIntent,
  detectCannibalization,
  detectRankChanges,
  detectKeywordDrops,
  detectContentGaps,
  computeSiteHealthScore,
  scoreKeyword,
  analyzeSERPAbsorption,
  generateOpportunityHeatmap,
  type KeywordIntent,
  type CannibalizationEntry,
  type RankChangeEntry,
  type KeywordDropEntry,
} from '@/lib/seo-heuristics';

export const runtime = 'nodejs';

const BASE_URL = process.env.ANTHROPIC_BASE_URL || process.env.OPENROUTER_BASE_URL || "https://api.minimax.io/anthropic";
const API_KEY = process.env.ANTHROPIC_AUTH_TOKEN || process.env.OPENROUTER_API_KEY || "";
const MODEL = process.env.ANTHROPIC_MODEL || "MiniMax-M2.7";

interface GSCRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCRowMinimal {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position: number;
}

interface AnalyzeRequest {
  siteUrl: string;
  rows: GSCRow[];
  previousRows?: GSCRow[];
  periodDays?: number;
  includeCannibalization?: boolean;
  includeRankChanges?: boolean;
}

async function callMiniMax(systemPrompt: string, userContent: string, maxTokens = 4096): Promise<{ text: string }> {
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
      max_tokens: maxTokens,
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
  return { text: data.content?.map((b: { text?: string }) => b.text || "").join("") || "" };
}

const SYSTEM_PROMPT = `You are an expert SEO analyst agent with deep knowledge of:
- Google Search Console data analysis
- Industry CTR benchmarks by SERP position (Position 1: ~28.5%, Position 2: ~15.2%, Position 3: ~9.8%, Positions 4-10: 2.2-7.0%, Positions 11-20: 0.3-1.5%)
- Google AI Overview eligibility criteria (position ≤10, HowTo/FAQ content patterns, E-E-A-T signals)
- Keyword intent classification (informational, transactional, navigational, commercial, local, sub-intent)
- SERP feature absorption and featured snippet optimization
- Content gap analysis and topic clustering
- CTR optimization through title/meta tag improvements
- Keyword cannibalization detection and resolution
- Competitive density analysis and site health scoring

You analyze GSC data step-by-step and provide structured, actionable recommendations. Always cite the specific data points that support your analysis.

Response format — ALWAYS return JSON with this exact structure:
{
  "summary": "2-3 sentence executive summary of the key findings",
  "findings": [
    {
      "category": "CTR Opportunity | Quick Win | Content Gap | AI Overview | Cannibalization | Rank Drop | SERP Feature",
      "severity": "Critical | High | Medium | Low",
      "query": "specific query or 'Multiple queries' for grouped",
      "page": "specific URL or 'Multiple pages' for grouped",
      "metric": "key metric value with context",
      "recommendation": "specific actionable fix",
      "citations": ["Data point 1", "Data point 2"],
      "effort": "Low | Medium | High",
      "impact": "Estimated clicks gained per month"
    }
  ],
  "topPriorityActions": ["Top 3 most impactful actions ranked by effort-to-impact ratio"],
  "aiOverviewCandidates": [
    {
      "query": "query with AI Overview potential",
      "currentPosition": number,
      "action": "Content optimization to reach top 5"
    }
  ]
}`;

function buildDiagnosticPrompt(
  siteUrl: string,
  rows: GSCRow[],
  opts: {
    periodDays?: number;
    includeCannibalization?: boolean;
    includeRankChanges?: boolean;
    serpAbsorption?: ReturnType<typeof analyzeSERPAbsorption>;
    contentGaps?: ReturnType<typeof detectContentGaps>;
    healthScore?: ReturnType<typeof computeSiteHealthScore>;
    heatmap?: Record<string, Array<{ query: string; opportunity: number; quadrant: string }>>;
    rankChanges?: RankChangeEntry[];
    keywordDrops?: KeywordDropEntry[];
    cannibalizations?: CannibalizationEntry[];
  }
): string {
  const { periodDays = 28, includeCannibalization = true, includeRankChanges = true, serpAbsorption, contentGaps, healthScore, heatmap, rankChanges = [], keywordDrops = [], cannibalizations = [] } = opts;

  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  const startDate = new Date(today.getTime() - periodDays * 86400000).toISOString().split('T')[0];

  const uniqueQueries = new Set(rows.map(r => r.query)).size;
  const uniquePages = new Set(rows.map(r => r.page)).size;
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const avgCTR = rows.length ? rows.reduce((s, r) => s + r.ctr, 0) / rows.length : 0;
  const avgPosition = rows.length ? rows.reduce((s, r) => s + r.position, 0) / rows.length : 0;

  const intentDist: Record<string, number> = {};
  rows.forEach(r => {
    const intent = classifyKeywordIntent(r.query).intent;
    intentDist[intent] = (intentDist[intent] || 0) + 1;
  });

  const scored = rows.map(r => scoreKeyword(r));
  const ctrOpps = scored
    .filter(r => r.ctrGap > 1 && r.impressions >= 50)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 10);
  const quickWins = scored
    .filter(r => r.position >= 4 && r.position <= 10 && r.clicks > 20)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 5);

  let prompt = `# SEO Diagnostic Report — ${siteUrl}
**Period:** ${startDate} to ${endDate} (${periodDays} days)

## Aggregate Metrics
- Query-Page Combinations: ${rows.length.toLocaleString()} | Unique Queries: ${uniqueQueries.toLocaleString()} | Unique Pages: ${uniquePages.toLocaleString()}
- Total Clicks: ${totalClicks.toLocaleString()} | Total Impressions: ${totalImpressions.toLocaleString()}
- Avg CTR: ${avgCTR.toFixed(2)}% | Avg Position: ${avgPosition.toFixed(1)}
${healthScore ? `- **Site Health Score:** ${healthScore.score}/100 (Grade ${healthScore.grade} — ${healthScore.label})` : ''}

## Intent Distribution
${Object.entries(intentDist).map(([k, v]) => `- **${k.charAt(0).toUpperCase() + k.slice(1)}:** ${v} queries`).join('\n')}

## Top CTR Opportunities (${ctrOpps.length} identified)
`;
  ctrOpps.forEach((r, i) => {
    prompt += `${i + 1}. **"${r.query}"** | Pos: ${r.position} | CTR: ${r.ctr}% (benchmark: ${r.benchCTR}%) | Gap: ${r.ctrGap}pp | Est. clicks lost: ${r.clicksLost}/mo\n`;
    prompt += `   Fix: ${r.fixRecommendation}\n`;
  });

  prompt += `\n## Quick Wins — Positions 4-10 (${quickWins.length} targets)\n`;
  quickWins.forEach((r, i) => {
    prompt += `${i + 1}. **"${r.query}"** | Pos: ${r.position} | CTR: ${r.ctr}% | +${Math.round(r.clicks * 0.3)} potential clicks/mo\n`;
  });

  if (contentGaps && contentGaps.length > 0) {
    prompt += `\n## Content Gaps (${contentGaps.length} detected)\n`;
    contentGaps.slice(0, 5).forEach((g, i) => {
      prompt += `${i + 1}. **"${g.query}"** | ${g.impressions} impr, 0 clicks | Priority: ${g.priority} | ${g.rootCause}\n`;
      prompt += `   Action: ${g.action}\n`;
    });
  }

  if (serpAbsorption && serpAbsorption.length > 0) {
    prompt += `\n## SERP Feature Absorption (${serpAbsorption.length} queries)\n`;
    serpAbsorption.slice(0, 5).forEach((s, i) => {
      prompt += `${i + 1}. **"${s.query}"** | Pos: ${s.position} | Features: ${s.featuresPresent.join(', ')} | Absorption: ${(s.featureAbsorptionRate * 100).toFixed(0)}%\n`;
      prompt += `   Recommendation: ${s.recommendedResponse}\n`;
    });
  }

  if (includeRankChanges && rankChanges.length > 0) {
    const improved = rankChanges.filter(c => c.direction === 'improved');
    const declined = rankChanges.filter(c => c.direction === 'declined');
    prompt += `\n## Rank Position Changes (${rankChanges.length} significant)\n`;
    prompt += `- Improved: ${improved.length} | Declined: ${declined.length}\n`;
    if (declined.length > 0) {
      prompt += `\n### Top Declines\n`;
      declined.slice(0, 5).forEach((c, i) => {
        prompt += `${i + 1}. **"${c.query}"** | ${c.previousPosition} → ${c.currentPosition} (${c.change > 0 ? '+' : ''}${c.change}) | ${c.impressions.toLocaleString()} impr | Urgency: ${c.urgency}\n`;
      });
    }
    if (keywordDrops.length > 0) {
      prompt += `\n### Keyword Drops (${keywordDrops.length} queries dropped ≥5 positions)\n`;
      keywordDrops.slice(0, 5).forEach((d, i) => {
        prompt += `${i + 1}. **"${d.query}"** | ${d.previousPosition} → ${d.currentPosition} (${d.positionDelta}) | Est. traffic loss: ${d.estimatedTrafficLoss} clicks/mo\n`;
      });
    }
  }

  if (includeCannibalization && cannibalizations.length > 0) {
    const critical = cannibalizations.filter(c => c.severity === 'Critical').length;
    const warning = cannibalizations.filter(c => c.severity === 'Warning').length;
    prompt += `\n## Cannibalization Issues (${cannibalizations.length} detected)\n`;
    prompt += `- Critical: ${critical} | Warning: ${warning} | Minor: ${cannibalizations.length - critical - warning}\n`;
    cannibalizations.slice(0, 5).forEach((c, i) => {
      prompt += `${i + 1}. **"${c.query}"** | ${c.pageCount} pages competing | Severity: ${c.severity} | Total Impr: ${c.totalImpressions.toLocaleString()}\n`;
      prompt += `   Recommendation: ${c.recommendation}\n`;
    });
  }

  if (heatmap) {
    prompt += `\n## Opportunity Heatmap\n`;
    for (const [quadrant, items] of Object.entries(heatmap)) {
      if (items.length > 0) {
        prompt += `- **${quadrant}:** ${items.length} queries (top: "${items[0].query}", opportunity: ${items[0].opportunity})\n`;
      }
    }
  }

  prompt += `
## Request
Based on this data, provide a structured, page-specific SEO action plan with prioritized recommendations. Return your response as JSON with this exact structure:
{
  "summary": "2-3 sentence executive summary",
  "findings": [
    {
      "category": "CTR Opportunity | Quick Win | Content Gap | AI Overview | Cannibalization | Rank Drop | SERP Feature",
      "severity": "Critical | High | Medium | Low",
      "query": "specific query or 'Multiple queries'",
      "page": "specific URL or 'Multiple pages'",
      "metric": "key metric with context",
      "recommendation": "specific actionable fix",
      "citations": ["data point 1", "data point 2"],
      "effort": "Low | Medium | High",
      "impact": "estimated clicks gained per month"
    }
  ],
  "topPriorityActions": ["top 3 actions ranked by effort-to-impact ratio"],
  "aiOverviewCandidates": [
    {
      "query": "query with AI Overview potential",
      "currentPosition": number,
      "action": "content optimization to reach top 5"
    }
  ]
}`;

  return prompt;
}

export async function POST(req: NextRequest) {
  try {
    const { siteUrl, rows, previousRows, periodDays, includeCannibalization, includeRankChanges }: AnalyzeRequest = await req.json();

    if (!siteUrl || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'siteUrl and rows array are required' }, { status: 400 });
    }
    if (rows.length > 25000) {
      return NextResponse.json({ error: 'rows cannot exceed 25000' }, { status: 400 });
    }

    const scored = rows.map(r => scoreKeyword(r));
    const cannibalizations = includeCannibalization !== false ? detectCannibalization(rows) : [];
    const rankChanges = includeRankChanges && previousRows ? detectRankChanges(rows, previousRows) : [];
    const keywordDrops = includeRankChanges && previousRows ? detectKeywordDrops(rows, previousRows) : [];
    const contentGaps = detectContentGaps(rows);
    const serpAbsorption = analyzeSERPAbsorption(rows);
    const healthScore = computeSiteHealthScore(rows);
    const heatmap = generateOpportunityHeatmap(rows);

    const prompt = buildDiagnosticPrompt(siteUrl, rows, {
      periodDays: periodDays || 28,
      includeCannibalization: includeCannibalization !== false,
      includeRankChanges: !!(includeRankChanges && previousRows),
      serpAbsorption,
      contentGaps,
      healthScore,
      heatmap,
      rankChanges,
      keywordDrops,
      cannibalizations,
    });

    const aiResponse = await callMiniMax(SYSTEM_PROMPT, prompt, 4096);
    let parsed = null;
    try { parsed = JSON.parse(aiResponse.text); } catch { /* return raw text */ }

    return NextResponse.json({
      text: aiResponse.text,
      structured: parsed,
      heuristics: {
        cannibalizations: cannibalizations.slice(0, 50),
        rankChanges: rankChanges.slice(0, 50),
        keywordDrops: keywordDrops.slice(0, 50),
        contentGaps: contentGaps.slice(0, 50),
        serpAbsorption: serpAbsorption.slice(0, 30),
        healthScore,
        heatmap,
        keywordsByIntent: Object.fromEntries(
          (['transactional', 'informational', 'navigational', 'commercial', 'local', 'unknown'] as const)
            .map(intent => [intent, rows.filter(r => classifyKeywordIntent(r.query).intent === intent).map(r => r.query)])
        ) as Record<string, string[]>,
        pagePerformance: Object.fromEntries(
          [...new Set(rows.map(r => r.page))].map(page => {
            const pageRows = rows.filter(r => r.page === page);
            return [page, {
              totalClicks: pageRows.reduce((s, r) => s + r.clicks, 0),
              totalImpressions: pageRows.reduce((s, r) => s + r.impressions, 0),
              avgPosition: pageRows.reduce((s, r) => s + r.position, 0) / pageRows.length,
              queries: pageRows.length,
            }];
          })
        ),
        summary: {
          totalRows: rows.length,
          uniqueQueries: new Set(rows.map(r => r.query)).size,
          uniquePages: new Set(rows.map(r => r.page)).size,
          cannibalizationCount: cannibalizations.length,
          criticalCannibalizations: cannibalizations.filter(c => c.severity === 'Critical').length,
          warningCannibalizations: cannibalizations.filter(c => c.severity === 'Warning').length,
          rankChangesDetected: rankChanges.length,
          keywordDropsDetected: keywordDrops.length,
          contentGapCount: contentGaps.length,
          serpAbsorptionCount: serpAbsorption.filter(s => s.isFeatureBlocked).length,
          healthScore: healthScore.score,
          healthGrade: healthScore.grade,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

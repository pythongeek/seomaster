import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeGSCRows,
  buildSEOPrompt,
  detectCannibalization,
  detectRankChanges,
  detectKeywordDrops,
  classifyKeywordIntent,
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
      else if (parsed.error) errorMsg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
    } catch {}
    throw new Error(errorMsg);
  }

  const data = JSON.parse(responseText);
  if (data.error) throw new Error(data.error?.error?.message || data.error?.message || JSON.stringify(data.error));

  const text = data.content?.map((b: { text?: string }) => b.text || "").join("") || "";
  return { text };
}

const SYSTEM_PROMPT = `You are an expert SEO analyst agent with deep knowledge of:
- Google Search Console data analysis
- Industry CTR benchmarks by SERP position (Position 1: ~28.5%, Position 2: ~15.2%, Position 3: ~9.8%, Positions 4-10: 2.2-7.0%, Positions 11-20: 0.3-1.5%)
- Google AI Overview eligibility criteria (position ≤10, HowTo/FAQ content patterns, E-E-A-T signals)
- Keyword intent classification (informational, transactional, navigational, commercial, local)
- Content gap analysis and topic clustering
- CTR optimization through title/meta tag improvements
- Keyword cannibalization detection and resolution

You analyze GSC data step-by-step and provide structured, actionable recommendations. Always cite the specific data points that support your analysis.

Response format — ALWAYS return JSON with this exact structure:
{
  "summary": "2-3 sentence executive summary of the key findings",
  "findings": [
    {
      "category": "CTR Opportunity | Quick Win | Content Gap | AI Overview | Cannibalization | Rank Drop",
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

export async function POST(req: NextRequest) {
  try {
    const { siteUrl, rows, previousRows, periodDays, includeCannibalization, includeRankChanges }: AnalyzeRequest = await req.json();

    if (!siteUrl || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'siteUrl and rows array are required' }, { status: 400 });
    }

    if (rows.length > 25000) {
      return NextResponse.json({ error: 'rows cannot exceed 25000' }, { status: 400 });
    }

    const analysis = analyzeGSCRows(rows);
    const cannibalizations = includeCannibalization !== false ? detectCannibalization(rows) : [];
    const rankChanges = includeRankChanges && previousRows ? detectRankChanges(rows, previousRows) : [];
    const keywordDrops = includeRankChanges && previousRows ? detectKeywordDrops(rows, previousRows) : [];

    const prompt = buildSEOPrompt(siteUrl, rows, {
      periodDays: periodDays || 28,
      includeCannibalization: includeCannibalization !== false,
      includeRankChanges: !!(includeRankChanges && previousRows),
      previousRows,
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
        keywordsByIntent: analysis.keywordsByIntent,
        pagePerformance: analysis.pagePerformance,
        summary: {
          totalRows: rows.length,
          uniqueQueries: new Set(rows.map(r => r.query)).size,
          uniquePages: new Set(rows.map(r => r.page)).size,
          cannibalizationCount: cannibalizations.length,
          criticalCannibalizations: cannibalizations.filter(c => c.severity === 'Critical').length,
          warningCannibalizations: cannibalizations.filter(c => c.severity === 'Warning').length,
          rankChangesDetected: rankChanges.length,
          keywordDropsDetected: keywordDrops.length,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

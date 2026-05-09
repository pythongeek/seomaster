/**
 * Gemini Client — Search Intelligence Engine
 *
 * Uses Gemini 2.0 Flash with Google Search grounding for:
 *   1. AI Overview SERP Check — does an AI Overview appear for this query?
 *   2. Google Trends Enrichment — is this keyword growing/stable/declining?
 *   3. Competitor Analysis — who ranks for queries you don't?
 *
 * Gracefully stubs when GEMINI_API_KEY is not configured.
 * All live calls are rate-gated: only called for high-risk queries (risk > 40).
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── Response Types ───────────────────────────────────────────────────────────

export interface SERPCheckResult {
  query: string;
  hasAIOverview: boolean;
  featuredSnippetHolder: string | null;
  topDomains: string[];
  hasPAA: boolean;
  paaQuestions: string[];
  source: 'gemini' | 'stub';
  error?: string;
}

export interface TrendEnrichmentResult {
  query: string;
  trend: 'growing' | 'stable' | 'declining';
  confidence: number;   // 0–1
  relatedBreakouts: string[];
  source: 'gemini' | 'stub';
  error?: string;
}

export interface CompetitorGapResult {
  query: string;
  topCompetitors: string[];
  yourDomain: string | null;
  rankingPosition: number | null;
  competitorStrengths: string[];
  source: 'gemini' | 'stub';
  error?: string;
}

// ─── Stub Responses (when no API key) ────────────────────────────────────────

const STUB_SERP: Omit<SERPCheckResult, 'query'> = {
  hasAIOverview: false,
  featuredSnippetHolder: null,
  topDomains: [],
  hasPAA: false,
  paaQuestions: [],
  source: 'stub',
  error: 'GEMINI_API_KEY not configured — connect Gemini to enable live SERP checks',
};

const STUB_TREND: Omit<TrendEnrichmentResult, 'query'> = {
  trend: 'stable',
  confidence: 0,
  relatedBreakouts: [],
  source: 'stub',
  error: 'GEMINI_API_KEY not configured — connect Gemini to enable trend enrichment',
};

// ─── Gemini API Call ──────────────────────────────────────────────────────────

async function callGemini(prompt: string, maxOutputTokens: number = 1024): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],   // Google Search grounding
    generationConfig: {
      maxOutputTokens,
      temperature: 0.1,
    },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000), // 20s timeout
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text;
}

function extractJSON(text: string): unknown {
  // Try markdown-wrapped JSON first
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = match ? match[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in Gemini response');
  return JSON.parse(raw.substring(start, end + 1));
}

// ─── Tool 1: AI Overview SERP Check ──────────────────────────────────────────

export async function checkSERPForAIOverview(query: string): Promise<SERPCheckResult> {
  if (!GEMINI_API_KEY) return { query, ...STUB_SERP };

  const prompt = `Search Google for: "${query}"

Analyze the current Google SERP and return ONLY a JSON object with this exact structure:
{
  "hasAIOverview": true or false,
  "featuredSnippetHolder": "domain.com or null",
  "topDomains": ["domain1.com", "domain2.com", "domain3.com"],
  "hasPAA": true or false,
  "paaQuestions": ["question 1", "question 2"]
}

Answer based on what you observe in the current Google search results.`;

  try {
    const raw = await callGemini(prompt, 512);
    const parsed = extractJSON(raw) as Partial<SERPCheckResult>;
    return {
      query,
      hasAIOverview: Boolean(parsed.hasAIOverview),
      featuredSnippetHolder: parsed.featuredSnippetHolder ?? null,
      topDomains: Array.isArray(parsed.topDomains) ? parsed.topDomains.slice(0, 5) : [],
      hasPAA: Boolean(parsed.hasPAA),
      paaQuestions: Array.isArray(parsed.paaQuestions) ? parsed.paaQuestions.slice(0, 5) : [],
      source: 'gemini',
    };
  } catch (err) {
    console.error('[Gemini SERP Check Error]', err);
    return {
      query,
      ...STUB_SERP,
      source: 'stub',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ─── Tool 2: Google Trends Enrichment ────────────────────────────────────────

export async function enrichWithTrends(query: string): Promise<TrendEnrichmentResult> {
  if (!GEMINI_API_KEY) return { query, ...STUB_TREND };

  const prompt = `What are the recent search trends for the query: "${query}"?

Based on Google Search data and trends, analyze whether search interest is growing, stable, or declining over the last 6 months.

Return ONLY a JSON object with this exact structure:
{
  "trend": "growing" or "stable" or "declining",
  "confidence": 0.0 to 1.0,
  "relatedBreakouts": ["related query 1", "related query 2"]
}`;

  try {
    const raw = await callGemini(prompt, 256);
    const parsed = extractJSON(raw) as Partial<TrendEnrichmentResult>;
    const trend = ['growing', 'stable', 'declining'].includes(parsed.trend as string)
      ? (parsed.trend as TrendEnrichmentResult['trend'])
      : 'stable';
    return {
      query,
      trend,
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      relatedBreakouts: Array.isArray(parsed.relatedBreakouts) ? parsed.relatedBreakouts.slice(0, 5) : [],
      source: 'gemini',
    };
  } catch (err) {
    console.error('[Gemini Trends Error]', err);
    return {
      query,
      ...STUB_TREND,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ─── Tool 3: Competitor Gap Analysis ─────────────────────────────────────────

export async function analyzeCompetitorGap(query: string, yourDomain?: string): Promise<CompetitorGapResult> {
  if (!GEMINI_API_KEY) {
    return {
      query, yourDomain: yourDomain ?? null, topCompetitors: [],
      rankingPosition: null, competitorStrengths: [],
      source: 'stub', error: 'GEMINI_API_KEY not configured',
    };
  }

  const domainContext = yourDomain ? `Your domain is: ${yourDomain}.` : '';
  const prompt = `Search Google for: "${query}"

${domainContext}

Identify who currently ranks for this query and what makes their content strong.

Return ONLY a JSON object:
{
  "topCompetitors": ["competitor1.com", "competitor2.com", "competitor3.com"],
  "rankingPosition": null or a number (position of ${yourDomain ?? 'your domain'}),
  "competitorStrengths": ["strength 1", "strength 2", "strength 3"]
}`;

  try {
    const raw = await callGemini(prompt, 512);
    const parsed = extractJSON(raw) as Partial<CompetitorGapResult>;
    return {
      query,
      yourDomain: yourDomain ?? null,
      topCompetitors: Array.isArray(parsed.topCompetitors) ? parsed.topCompetitors.slice(0, 5) : [],
      rankingPosition: typeof parsed.rankingPosition === 'number' ? parsed.rankingPosition : null,
      competitorStrengths: Array.isArray(parsed.competitorStrengths) ? parsed.competitorStrengths.slice(0, 5) : [],
      source: 'gemini',
    };
  } catch (err) {
    return {
      query, yourDomain: yourDomain ?? null, topCompetitors: [],
      rankingPosition: null, competitorStrengths: [],
      source: 'stub', error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/** Check if Gemini is available (API key configured) */
export function isGeminiAvailable(): boolean {
  return Boolean(GEMINI_API_KEY);
}

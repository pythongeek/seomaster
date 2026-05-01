import { NextRequest, NextResponse } from 'next/server';
import { saveReport, initDB, saveGSCSnapshot } from '@/lib/db';

export const runtime = 'nodejs';

const BASE_URL = process.env.ANTHROPIC_BASE_URL || process.env.OPENROUTER_BASE_URL || "https://api.minimax.io/anthropic";
const API_KEY = process.env.ANTHROPIC_AUTH_TOKEN || process.env.OPENROUTER_API_KEY || "";
const MODEL = process.env.ANTHROPIC_MODEL || "MiniMax-M2.7";

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
  11: { ctr: 1.5, label: "Positions 11-20" },
  12: { ctr: 1.3, label: "Positions 11-20" },
  13: { ctr: 1.1, label: "Positions 11-20" },
  14: { ctr: 0.9, label: "Positions 11-20" },
  15: { ctr: 0.8, label: "Positions 11-20" },
  16: { ctr: 0.7, label: "Positions 11-20" },
  17: { ctr: 0.6, label: "Positions 11-20" },
  18: { ctr: 0.5, label: "Positions 11-20" },
  19: { ctr: 0.4, label: "Positions 11-20" },
  20: { ctr: 0.3, label: "Positions 11-20" },
};

const INTENT_CTR_MULTIPLIER: Record<string, number> = {
  navigational: 1.25, transactional: 0.85, commercial: 0.90, informational: 1.05, local: 0.95,
};

const CACHE = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const RATE_LIMIT = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 20;

interface GSCRow {
  query: string; page: string;
  clicks: number; impressions: number; ctr: number; position: number;
}

function getBenchmarkCTR(position: number, intent = 'informational'): number {
  if (position <= 0) return 0;
  if (position >= 20) return 0.2;
  const base = CTR_BENCHMARKS[Math.round(position)]?.ctr ?? 0.2;
  return base * (INTENT_CTR_MULTIPLIER[intent] ?? 1.0);
}

function classifyIntent(q: string): { intent: string; category: string; isQuestion: boolean } {
  const lower = q.toLowerCase();
  const isQuestion = /^(how|what|why|when|who|which|where|can|does|is|are|should|will|do)\b/i.test(lower);

  if (/\b(buy|order|purchase|checkout|add to cart|get started|sign up|download|install|hire|book|reserve|subscribe|pricing|price|cost|how much|discount|coupon|deal|cheap|free trial)\b/i.test(lower))
    return { intent: 'transactional', category: 'commerce', isQuestion };
  if (/\b(best|top|review|reviews|rated|rating|compare|comparison|vs\b|versus|alternative|alternatives|instead of|pros and cons|worth it|should i buy|recommended)\b/i.test(lower))
    return { intent: 'commercial', category: 'evaluation', isQuestion };
  if (/\b(near me|nearby|in [a-z]{3,}|local|location|open now|hours)\b/i.test(lower))
    return { intent: 'local', category: 'local', isQuestion };
  if (/\b(login|sign in|log in|account|dashboard|portal|official site|homepage)\b/i.test(lower))
    return { intent: 'navigational', category: 'navigation', isQuestion };

  return { intent: 'informational', category: 'educational', isQuestion };
}

function sanitizeString(str: string | undefined, maxLen = 500): string {
  if (!str) return '';
  return String(str).replace(/[<>]/g, '').slice(0, maxLen).trim();
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip);
  if (!entry || now > entry.resetAt) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function getCached<T>(key: string): T | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) { CACHE.delete(key); return null; }
  return entry.data as T;
}

function setCached<T>(key: string, data: T): void {
  CACHE.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

function cacheKey(type: string, data: unknown): string {
  return `${type}:${JSON.stringify(data).slice(0, 200)}`;
}

async function callMiniMax(systemPrompt: string, userContent: string, maxTokens = 4096): Promise<string> {
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
  return data.content?.map((b: { text?: string }) => b.text || "").join("") || "";
}

function parseJSONSafe<T>(text: string, fallback: T): T {
  try {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

const CTR_SYSTEM_PROMPT = `You are an expert SEO CTR optimization specialist with deep knowledge of:
- SERP click-through rate patterns by position (Position 1: ~28.5%, Position 2: ~15.2%, Position 3: ~9.8%, Position 4: ~7.0%, Position 5: ~5.4%)
- Title tag optimization: emotional triggers, power words, numbers, year, specificity, brand placement
- Meta description optimization: CTAs, value props, character limits (155-160 optimal), keyword matching
- Schema markup for SEO: FAQ, HowTo, Article, Product, Review schemas
- Intent-based CTR variation: transactional queries convert differently than informational

You generate actionable CTR improvement suggestions. Return ONLY valid JSON matching the schema. No markdown, no explanation outside JSON.`;

async function handleCtrOptimize(data: { keyword: string; currentTitle?: string; intent?: string; context?: string }) {
  const keyword = sanitizeString(data.keyword, 200);
  const currentTitle = sanitizeString(data.currentTitle || '', 200);
  const intent = sanitizeString(data.intent || 'informational', 50);
  const context = sanitizeString(data.context, 500);

  if (!keyword) throw new Error("keyword is required");

  const cacheKeyStr = cacheKey('ctr_optimize', { keyword, currentTitle, intent, context });
  const cached = getCached<{
    titleVariants: Array<{ title: string; predictedCTR: string; reasoning?: string }>;
    metaVariants: Array<{ text: string; charCount: number; cta: string; predictedCTR: string }>;
    schemaMarkup: string;
    keyword: string;
    searchIntent: string;
  }>(cacheKeyStr);
  if (cached) return { result: cached, cached: true };

  const intentMultiplier = INTENT_CTR_MULTIPLIER[intent] || 1.0;
  const baseCTR = intent === 'transactional' ? 3.5 : intent === 'commercial' ? 4.0 : 5.0;

  const prompt = `CTR OPTIMIZATION ANALYSIS

## Target Keyword
"${keyword}"

## Search Intent
${intent} (CTR multiplier: ${intentMultiplier}x applied to benchmarks)

## Current Title (if provided)
${currentTitle || 'Not provided'}

## Context / Related Keywords
${context || 'None provided'}

## Your Task
Generate 4 title tag variants and 3 meta description variants for the keyword above.

### Industry Benchmarks for Position 1:
- Informational queries: 28.5% CTR
- Commercial queries: 15.2% CTR
- Transactional queries: 7.0% CTR (lower intent-to-click ratio)

### Title Tag Best Practices:
- Front-load keyword when possible
- Add year (2025) for freshness signals
- Use numbers for lists ("7 Best...", "Top 10...")
- Include emotional/power words (Free, Ultimate, Proven, Complete)
- Keep under 60 characters for full display
- Add parentheticals (2025 Guide) not brackets

### Meta Description Best Practices:
- 150-160 characters optimal
- Include primary keyword
- Add CTA (Learn More, Get Started, Discover, Compare)
- Mirror searcher intent language
- End with brand name when character budget allows

### Schema Recommendations:
For question-based keywords → FAQ schema
For how-to/process → HowTo schema
For product reviews → Review/Product schema
For articles → Article schema

## OUTPUT FORMAT — Return ONLY this exact JSON (no markdown, no text outside JSON):
{
  "titleVariants": [
    { "title": "string (max 60 chars)", "predictedCTR": "string (e.g. '12.4%')", "reasoning": "string (1-2 sentences explaining why this title scores that CTR)" },
    ... (4 variants, best CTR first)
  ],
  "metaVariants": [
    { "text": "string (meta description text)", "charCount": number, "cta": "string (call-to-action used)", "predictedCTR": "string (e.g. '8.2%')" },
    ... (3 variants)
  ],
  "schemaMarkup": "string (recommended schema type: 'FAQ', 'HowTo', 'Article', 'Product', 'Review', or 'None' + brief reason)",
  "keyword": "string (the keyword being optimized)",
  "searchIntent": "string (classified intent)"
}`;

  const aiText = await callMiniMax(CTR_SYSTEM_PROMPT, prompt, 2500);
  const result = parseJSONSafe<{
    titleVariants: Array<{ title: string; predictedCTR: string; reasoning?: string }>;
    metaVariants: Array<{ text: string; charCount: number; cta: string; predictedCTR: string }>;
    schemaMarkup: string;
    keyword: string;
    searchIntent: string;
  }>(aiText, {
    titleVariants: [],
    metaVariants: [],
    schemaMarkup: 'None',
    keyword,
    searchIntent: intent,
  });

  setCached(cacheKeyStr, result);
  return { result, cached: false };
}

const KEYWORD_SYSTEM_PROMPT = `You are an expert SEO keyword researcher and content strategist. You analyze seed keywords, group them by semantic themes, identify modifiers and question keywords, and estimate search metrics. Return ONLY valid JSON matching the schema. No markdown, no text outside JSON.`;

async function handleKeywordResearch(data: { topic: string; seedKeywords: string[] }) {
  const topic = sanitizeString(data.topic, 200);
  const seedKeywords = (data.seedKeywords || [])
    .map(k => sanitizeString(k, 100))
    .filter(k => k.length > 1)
    .slice(0, 50);

  if (!topic || seedKeywords.length === 0) throw new Error("topic and seedKeywords (non-empty array) are required");

  const cacheKeyStr = cacheKey('keyword_research', { topic, seedKeywords });
  const cached = getCached<{
    topGroups: Array<{ keyword: string; volume: number; cpc: number; difficulty: string; opportunity: string; modifiers: Array<{ keyword: string; volume: number }> }>;
    questionKeywords: Array<{ keyword: string; volume: number; cpc: number; intent: string; bestFormat: string }>;
    topic: string;
  }>(cacheKeyStr);
  if (cached) return { result: cached, cached: true };

  const prompt = `KEYWORD RESEARCH & CLUSTERING ANALYSIS

## Topic
${topic}

## Seed Keywords
${seedKeywords.join('\n')}

## Your Task
1. Group seed keywords + related keywords into semantic clusters (5-8 groups)
2. Identify modifiers for each group head term
3. Find question-based keywords (high AI Overview potential) with best content formats
4. Estimate volumes and CPC for each (relative: Low <5K/mo, Medium 5-20K/mo, High 20K+/mo)

## Industry CTR Benchmarks for Reference:
- Position 1 CTR: ~28.5% (informational), ~15.2% (commercial), ~7.0% (transactional)
- AI Overview eligible queries typically: informational, question-format, position ≤10

## Intent Multipliers:
- Question keywords (how/what/why): High AI Overview potential
- Transactional (buy/price/order): High commercial intent
- Comparison (vs/best/top): Commercial evaluation intent

## OUTPUT FORMAT — Return ONLY valid JSON (no markdown, no text outside JSON):
{
  "topGroups": [
    {
      "keyword": "string (group head term, e.g. 'CRM software')",
      "volume": number (estimated monthly searches: use relative scale, e.g. 12000),
      "cpc": number (estimated cost-per-click in USD, e.g. 8.50),
      "difficulty": "string ('Easy' | 'Medium' | 'Hard')",
      "opportunity": "string ('Low' | 'Medium' | 'High' — based on volume vs difficulty)",
      "modifiers": [
        { "keyword": "string (modifier phrase, e.g. 'CRM for small business')", "volume": number },
        ... (3-5 modifiers per group)
      ]
    },
    ... (5-8 groups, ranked by opportunity)
  ],
  "questionKeywords": [
    {
      "keyword": "string (question-format keyword)",
      "volume": number (monthly searches),
      "cpc": number (USD),
      "intent": "string ('informational' | 'commercial')",
      "bestFormat": "string ('FAQ' | 'HowTo' | 'Guide' | 'Comparison' | 'List')"
    },
    ... (5-10 question keywords sorted by volume)
  ],
  "topic": "string (the topic being analyzed)"
}`;

  const aiText = await callMiniMax(KEYWORD_SYSTEM_PROMPT, prompt, 3000);
  const result = parseJSONSafe<{
    topGroups: Array<{ keyword: string; volume: number; cpc: number; difficulty: string; opportunity: string; modifiers: Array<{ keyword: string; volume: number }> }>;
    questionKeywords: Array<{ keyword: string; volume: number; cpc: number; intent: string; bestFormat: string }>;
    topic: string;
  }>(aiText, { topGroups: [], questionKeywords: [], topic });

  setCached(cacheKeyStr, result);
  return { result, cached: false };
}

const TOPIC_SYSTEM_PROMPT = `You are an expert SEO content strategist specializing in topic clustering and internal linking architecture. You take a seed topic and generate a complete topic cluster with pillar pages, subtopics, and strategic internal link suggestions. Return ONLY valid JSON matching the schema. No markdown, no text outside JSON.`;

async function handleTopicCluster(data: { seed: string }) {
  const seed = sanitizeString(data.seed, 200);
  if (!seed) throw new Error("seed keyword/topic is required");

  const cacheKeyStr = cacheKey('topic_cluster', { seed });
  const cached = getCached<{
    clusterStructure: Array<{ name: string; keywords: string[]; weight: number }>;
    internalLinkSuggestions: Array<{ from: string; to: string; anchor: string; strength: string }>;
    pillarTopic: string;
  }>(cacheKeyStr);
  if (cached) return { result: cached, cached: true };

  const prompt = `TOPIC CLUSTER BUILDER

## Seed Topic/Keyword
${seed}

## Your Task
Build a complete topic cluster for the seed topic above. Include:
1. Pillar topic (the seed) + supporting subtopics ranked by importance
2. 8-15 cluster keywords grouped under thematic headers
3. Internal linking suggestions: which pages should link to which others and with what anchor text

## Topic Cluster Best Practices:
- Pillar page targets the broad head term
- Cluster pages target long-tail modifiers and question variants
- Internal links should use keyword-rich anchor text
- Strong topical authority flows from pillar → subtopics
- Cluster pages should cross-link to related subtopics

## Cluster Weight Guidelines:
- Weight 10: Pillar page (main head term)
- Weight 7-9: Primary subtopics (major keyword themes)
- Weight 4-6: Secondary subtopics (long-tail modifiers)
- Weight 1-3: Tertiary pages (specific question variants)

## OUTPUT FORMAT — Return ONLY valid JSON (no markdown, no text outside JSON):
{
  "clusterStructure": [
    {
      "name": "string (cluster/subtopic name)",
      "keywords": ["string (keyword 1)", "string (keyword 2)", ...],
      "weight": number (1-10, pillar=10, primary subtopics 7-9, secondary 4-6, tertiary 1-3)
    },
    ... (8-15 clusters, pillar first then ranked by weight descending)
  ],
  "internalLinkSuggestions": [
    {
      "from": "string (page that should link out, e.g. 'Email Marketing Guide')",
      "to": "string (page being linked to, e.g. 'Email Marketing Automation')",
      "anchor": "string (anchor text for the link, e.g. 'automation tools')",
      "strength": "string ('Strong' | 'Medium' | 'Suggested' — based on topical relevance and cluster hierarchy)"
    },
    ... (8-12 link suggestions)
  ],
  "pillarTopic": "string (the pillar topic / seed)"
}`;

  const aiText = await callMiniMax(TOPIC_SYSTEM_PROMPT, prompt, 3000);
  const result = parseJSONSafe<{
    clusterStructure: Array<{ name: string; keywords: string[]; weight: number }>;
    internalLinkSuggestions: Array<{ from: string; to: string; anchor: string; strength: string }>;
    pillarTopic: string;
  }>(aiText, { clusterStructure: [], internalLinkSuggestions: [], pillarTopic: seed });

  setCached(cacheKeyStr, result);
  return { result, cached: false };
}

async function handleGscFull(rows: GSCRow[], options?: { siteUrl?: string; startDate?: string; endDate?: string }) {
  const totalRows = rows.length;
  const totalClicks = rows.reduce((s: number, r: GSCRow) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s: number, r: GSCRow) => s + r.impressions, 0);
  const avgCTR = rows.length ? rows.reduce((s: number, r: GSCRow) => s + r.ctr, 0) / rows.length : 0;
  const avgPosition = rows.length ? rows.reduce((s: number, r: GSCRow) => s + r.position, 0) / rows.length : 0;

  const scored = rows.map((r: GSCRow) => {
    const { intent } = classifyIntent(r.query);
    const bench = getBenchmarkCTR(r.position, intent);
    const ctrRatio = r.ctr / Math.max(bench, 0.01);
    const ctrGap = Math.max(0, bench - r.ctr);
    const impressionsScore = r.impressions >= 1000 ? 1.5 : r.impressions >= 200 ? 1.0 : 0.5;
    const positionMultiplier = r.position <= 3 ? 0.8 : r.position <= 5 ? 1.2 : r.position <= 10 ? 1.5 : 0.7;
    const opportunityScore = r.impressions * (ctrGap / 100) * impressionsScore * positionMultiplier;

    return {
      ...r, intent, benchCTR: parseFloat(bench.toFixed(2)),
      ctrGap: parseFloat(ctrGap.toFixed(2)), ctrRatio: parseFloat(ctrRatio.toFixed(3)),
      opportunityScore: parseFloat(opportunityScore.toFixed(2)),
    };
  });

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
      estimatedClicksLost: Math.round(Math.max(0, r.impressions * (r.ctrGap / 100))),
      opportunityScore: r.opportunityScore,
      performanceCategory: r.ctrRatio >= 1.3 ? 'Outperforming' : r.ctrRatio >= 0.9 ? 'At Benchmark' : r.ctrRatio >= 0.6 ? 'Underperforming' : 'Critical Gap',
      intent: r.intent,
      fix: r.position <= 3
        ? `CTR ${r.ctrRatio < 0.5 ? 'critically low' : 'below benchmark'} — optimize title/meta for immediate CTR boost`
        : `CTR gap of ${r.ctrGap.toFixed(1)}pp vs position ${r.position} benchmark — improve content + schema + internal links`,
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
      estimatedTrafficGain: Math.round(Math.max(0, r.impressions * (r.ctrGap / 100))),
      effort: r.position <= 6 ? 'Low' : 'Medium',
      action: `Improve content depth + E-E-A-T signals + internal links — pos ${r.position.toFixed(1)} can realistically reach top 3`,
    }));

  const contentGaps = rows
    .filter((r: GSCRow) => r.impressions >= 100 && r.clicks === 0)
    .sort((a: GSCRow, b: GSCRow) => b.impressions - a.impressions)
    .slice(0, 20)
    .map((r: GSCRow) => ({
      query: r.query, page: r.page, impressions: r.impressions, position: r.position,
      gapType: r.impressions > 5000 ? 'Volume Gap (P0 Critical)' : r.impressions > 1000 ? 'Volume Gap (P1 High)' : r.impressions > 500 ? 'Ranking Gap (P2 Medium)' : 'Opportunity (P3 Low)',
      priority: r.impressions > 5000 ? 'P0 Critical' : r.impressions > 1000 ? 'P1 High' : r.impressions > 500 ? 'P2 Medium' : 'P3 Low',
      action: r.impressions > 1000 ? 'Rewrite title and meta — 1K+ impressions with zero clicks indicates CTR issue' : 'Position too low or content not compelling — improve depth and internal links',
    }));

  const aiOverviewCandidates = scored
    .filter(r => r.impressions >= 50 && r.position <= 20)
    .filter(r => /^(how|what|why|when|who|which|where)\b/i.test(r.query) || /\b(list|top \d|tips|steps|examples|types of)\b/i.test(r.query))
    .map(r => ({
      query: r.query, page: r.page, impressions: r.impressions, position: r.position, ctr: r.ctr, intent: r.intent,
      aiScore: Math.min(100, (r.position <= 3 ? 30 : r.position <= 5 ? 20 : r.position <= 10 ? 10 : 0) + (r.impressions >= 1000 ? 20 : r.impressions >= 200 ? 10 : 5) + (/^(how|what|why)/.test(r.query) ? 20 : 0)),
      aiEligibility: r.position <= 5 ? 'High' : r.position <= 10 ? 'Medium' : 'Low',
      contentSuggestion: r.position > 5 ? `Position ${r.position.toFixed(1)} — need top 5 for AI Overview. Focus on E-E-A-T + structured content.` : `Top ${r.position} — optimize: direct answer in first 50 words + FAQ schema + lists/steps`,
    }))
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, 15);

  const cannibalMap: Record<string, GSCRow[]> = {};
  rows.forEach(r => {
    if (!r.query) return;
    if (!cannibalMap[r.query]) cannibalMap[r.query] = [];
    if (!cannibalMap[r.query].some(x => x.page === r.page)) cannibalMap[r.query].push(r);
  });

  const cannibalization = Object.entries(cannibalMap)
    .filter(([, urls]) => urls.length > 1)
    .map(([query, urls]) => {
      const sorted = [...urls].sort((a, b) => a.position - b.position);
      const dominant = sorted[0];
      const splitScore = sorted.length * (sorted.slice(1).reduce((s, u) => s + u.impressions, 0) / Math.max(dominant.impressions, 1));
      return {
        query,
        urls: sorted.map(u => ({ url: u.page, position: u.position, clicks: u.clicks, impressions: u.impressions, ctr: u.ctr })),
        dominantUrl: dominant.page,
        totalClicks: sorted.reduce((s, u) => s + u.clicks, 0),
        splitScore: parseFloat(splitScore.toFixed(2)),
        severity: splitScore > 0.5 ? 'High' : splitScore > 0.2 ? 'Medium' : 'Low',
        recommendation: sorted.length >= 3
          ? `CRITICAL: ${sorted.length} URLs competing. Canonical "${dominant.page}" as preferred. 301-redirect or noindex the weaker ${sorted.length - 1} URLs.`
          : `Redirect "${sorted[1].page}" to "${dominant.page}" or add canonical tag pointing to dominant URL.`,
      };
    })
    .filter(c => c.splitScore > 0.1)
    .sort((a, b) => b.splitScore - a.splitScore)
    .slice(0, 20);

  const intentCounts: Record<string, number> = {};
  scored.forEach(r => { intentCounts[r.intent] = (intentCounts[r.intent] || 0) + 1; });

  const perfDist: Record<string, number> = { Outperforming: 0, 'At Benchmark': 0, Underperforming: 0, 'Critical Gap': 0, 'No Clicks': 0 };
  scored.forEach(r => {
    const cat = r.ctrRatio >= 1.3 ? 'Outperforming' : r.ctrRatio >= 0.9 ? 'At Benchmark' : r.ctrRatio >= 0.6 ? 'Underperforming' : 'Critical Gap';
    (perfDist as Record<string, number>)[cat]++;
  });

  const top10Rows = rows.filter(r => r.position <= 10);
  const benchmarkClicks = top10Rows.reduce((s: number, r: GSCRow) => {
    const { intent } = classifyIntent(r.query);
    return s + r.impressions * getBenchmarkCTR(r.position, intent) / 100;
  }, 0);
  const potentialClicksGain = Math.round(Math.max(0, benchmarkClicks - totalClicks));

  const siteUrl = (options?.siteUrl as string) || 'unknown';
  const dateRange = `${options?.startDate || '2025-01-01'} to ${options?.endDate || '2025-04-01'}`;

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
    cannibalization,
    intentDistribution: intentCounts,
    ruleBasedRecommendations: [
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
    ].filter(Boolean).join(' | '),
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
${Object.entries(intentCounts).map(([k, v]) => `${k}: ${v}`).join(' | ')}

Provide expert SEO synthesis in this EXACT JSON structure (no markdown, no code fences):
{
  "summary": "2-3 sentence verdict on the site's SEO health",
  "topPriorityActions": ["Action 1 with specific data citation", "Action 2 with specific data citation", "Action 3 with specific data citation"],
  "aiOverviewStrategy": "Specific strategy for the top AI Overview candidates above",
  "contentStrategy": "Data-backed content recommendation based on intent distribution and gaps",
  "quickestWin": "Single highest-ROI action that can be done this week"
}`;

    const aiRaw = await callMiniMax(
      'You are a senior SEO strategist. You receive fully-processed algorithmic analysis. Return only valid JSON matching the schema. No markdown, no code fences, no explanation outside the JSON.',
      aiPrompt,
      2000
    );

    aiSynthesis = parseJSONSafe<Record<string, unknown>>(aiRaw, { summary: aiRaw.slice(0, 400), topPriorityActions: [], raw: true });
  } catch (aiErr) {
    console.warn('AI synthesis failed:', (aiErr as Error).message);
  }

  try {
    await saveGSCSnapshot({ site_url: siteUrl, date_range: dateRange, data: rows.slice(0, 500), metrics: ruleBasedResult.overview });
    await saveReport({
      report_type: 'gsc_full',
      title: `GSC — ${siteUrl} (${dateRange}) — ${rows.length} queries`,
      data: rows.slice(0, 100),
      summary: ruleBasedResult.overview,
    });
  } catch { /* non-fatal */ }

  return {
    result: ruleBasedResult,
    aiSynthesis,
    metadata: {
      analyzedAt: new Date().toISOString(),
      rowsAnalyzed: totalRows,
      siteUrl,
      dateRange,
      analysisMode: aiSynthesis ? 'hybrid (algorithmic + AI M2.7)' : 'algorithmic only',
      algorithmsRun: [
        'Industry CTR Benchmark Curve',
        'Intent Classification (multi-signal)',
        'Composite Opportunity Scoring',
        'AI Overview Eligibility Scoring',
        'Cannibalization Detection',
        'Content Gap Classification',
      ],
    }
  };
}

export async function POST(req: NextRequest) {
  try {
    await initDB();

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit exceeded. Max 20 requests/minute.' }, { status: 429 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    const body = await req.json().catch(() => ({}));
    const { type, data, options } = body;

    if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 });

    const validTypes = ['gsc_full', 'ctr_optimize', 'keyword_research', 'topic_cluster'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    let result: unknown;
    let cached = false;

    switch (type) {
      case 'ctr_optimize':
        ({ result, cached } = await handleCtrOptimize(data || {}));
        break;
      case 'keyword_research':
        ({ result, cached } = await handleKeywordResearch(data || {}));
        break;
      case 'topic_cluster':
        ({ result, cached } = await handleTopicCluster(data || {}));
        break;
      case 'gsc_full':
        if (!data || !Array.isArray(data)) {
          return NextResponse.json({ error: 'data (array of GSC rows) is required for gsc_full type' }, { status: 400 });
        }
        if (data.length > 25000) {
          return NextResponse.json({ error: 'data cannot exceed 25000 rows' }, { status: 400 });
        }
        ({ result } = await handleGscFull(data, options));
        break;
      default:
        return NextResponse.json({ error: `Unhandled type: ${type}` }, { status: 501 });
    }

    return NextResponse.json({ result, cached });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

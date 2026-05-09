/**
 * AI Overview Risk Scorer — A-05
 * 5-signal composite scorer (0–100) for AI Overview click-suppression risk.
 * Higher score = higher risk that Google's AI Overview is stealing clicks.
 */

import { TrendResult } from './trend-analyser';

export type AIRiskTier = 'standard' | 'featured_snippet_target' | 'data_pivot' | 'deprioritize';

export interface AIOverviewRiskResult {
  riskScore: number;          // 0–100
  riskTier: AIRiskTier;
  signals: string[];          // human-readable signal labels
  signalBreakdown: {
    ctrSuppression: number;   // 0–35
    intentPenalty: number;    // 0–25
    trendDecline: number;     // 0–20
    questionPattern: number;  // 0–12
    impressionVolume: number; // 0–8
  };
  counterStrategy: string;
  geminiCheckRecommended: boolean; // true if risk > 40 (call Gemini SERP check)
}

// ─── Counter-strategy map ────────────────────────────────────────────────────

function getCounterStrategy(score: number): string {
  if (score <= 30) return 'Standard optimisation — no special AI Overview action needed';
  if (score <= 60) return 'Target featured snippet — add structured data, FAQ schema, direct answer format in first 100 words';
  if (score <= 80) return 'Add unique data — original research, pivot title to comparison/data angle to differentiate from AI answer';
  return 'Deprioritise for organic CTR — redirect effort to transactional keyword variants or long-tail sub-queries';
}

function getRiskTier(score: number): AIRiskTier {
  if (score <= 30) return 'standard';
  if (score <= 60) return 'featured_snippet_target';
  if (score <= 80) return 'data_pivot';
  return 'deprioritize';
}

// ─── Main Scorer ─────────────────────────────────────────────────────────────

/**
 * Score AI Overview click-suppression risk for a single GSC row.
 *
 * @param row GSC data row (query, position, ctr, impressions, intent)
 * @param trend Output from trend-analyser (slope + pValue)
 */
export function scoreAIOverviewRisk(
  row: {
    query: string;
    position: number;
    ctr: number;          // as percentage (e.g. 2.5 = 2.5%)
    impressions: number;
    intent: string;       // informational | commercial | transactional | navigational | local | unknown
  },
  trend?: Pick<TrendResult, 'slope' | 'pValue'>,
): AIOverviewRiskResult {
  let score = 0;
  const signals: string[] = [];
  const breakdown = {
    ctrSuppression: 0,
    intentPenalty: 0,
    trendDecline: 0,
    questionPattern: 0,
    impressionVolume: 0,
  };

  // ── Signal 1: CTR Suppression (0–35 pts) ──────────────────────────────────
  // If ranking top-3 but CTR is below 5%, AI Overview is likely stealing clicks
  if (row.position <= 3 && row.ctr < 5) {
    const s1 = Math.min(35, (5 - row.ctr) * 7);
    breakdown.ctrSuppression = Math.round(s1);
    score += s1;
    signals.push(`CTR suppression at top-3 position (${row.ctr.toFixed(1)}% CTR, expected ≥5%)`);
  }

  // ── Signal 2: Informational intent penalty (0–25 pts) ─────────────────────
  const intentScoreMap: Record<string, number> = {
    informational: 25,
    commercial: 10,
    transactional: 0,
    navigational: 5,
    local: 3,
    unknown: 12,
  };
  const intentPenalty = intentScoreMap[row.intent] ?? 12;
  breakdown.intentPenalty = intentPenalty;
  score += intentPenalty;
  if (intentPenalty >= 10) {
    signals.push(`Intent: ${row.intent} — high AI Overview absorption rate`);
  }

  // ── Signal 3: CTR trend decline (0–20 pts) ────────────────────────────────
  // Declining CTR while position holds = AI Overview displacing clicks
  if (trend && trend.slope > 0 && trend.pValue < 0.10) {
    const s3 = Math.min(20, trend.slope * 400);
    breakdown.trendDecline = Math.round(s3);
    score += s3;
    signals.push('CTR declining while position holds — AI Overview displacement pattern');
  }

  // ── Signal 4: Question pattern (0–12 pts) ─────────────────────────────────
  const questionWords = ['what', 'how', 'why', 'when', 'who', 'which', 'where', 'is', 'can', 'does'];
  const queryLower = row.query.toLowerCase();
  const startsWithQuestion = questionWords.some(w => queryLower.startsWith(w + ' '));
  if (startsWithQuestion) {
    breakdown.questionPattern = 12;
    score += 12;
    signals.push('Question-form query — prime AI Overview target');
  } else if (row.query.includes('?')) {
    breakdown.questionPattern = 6;
    score += 6;
    signals.push('Contains question mark — partial AI Overview risk');
  }

  // ── Signal 5: High impression volume (0–8 pts) ────────────────────────────
  if (row.impressions > 5000) {
    breakdown.impressionVolume = 8;
    score += 8;
    signals.push('High impression volume (5K+) — AI Overview candidate for popular queries');
  } else if (row.impressions > 1000) {
    breakdown.impressionVolume = 4;
    score += 4;
    signals.push('Moderate impression volume (1K+)');
  }

  const finalScore = Math.min(100, Math.round(score));

  return {
    riskScore: finalScore,
    riskTier: getRiskTier(finalScore),
    signals,
    signalBreakdown: breakdown,
    counterStrategy: getCounterStrategy(finalScore),
    geminiCheckRecommended: finalScore > 40,
  };
}

/**
 * GEO (Generative Engine Optimisation) scoring.
 * Estimates how ready a page is to be cited by AI answers.
 * Returns a score 0–100 and a list of improvement signals.
 */
export function scoreGEOReadiness(
  row: {
    query: string;
    position: number;
    ctr: number;
    impressions: number;
    intent: string;
  },
): { geoScore: number; gaps: string[]; strengths: string[] } {
  let score = 0;
  const gaps: string[] = [];
  const strengths: string[] = [];

  // Position signal (top 10 = AI-citation eligible)
  if (row.position <= 3) { score += 30; strengths.push('Top-3 ranking — high AI citation probability'); }
  else if (row.position <= 10) { score += 15; strengths.push('Page-1 ranking'); }
  else { gaps.push('Off page 1 — ranking too low for AI citations'); }

  // CTR signal (good CTR = trusted result)
  if (row.ctr >= 5) { score += 20; strengths.push('Strong CTR signals relevance to intent'); }
  else if (row.ctr >= 2) { score += 10; }
  else { gaps.push('Low CTR may indicate intent mismatch — AI models deprioritise non-clicked results'); }

  // Impression volume (popular query = more AI training signal)
  if (row.impressions >= 1000) { score += 20; strengths.push('High search volume — commonly trained-on query'); }
  else if (row.impressions >= 200) { score += 10; }
  else { gaps.push('Low impression volume — less likely to be in AI training data'); }

  // Informational intent (AI loves informational content for citations)
  if (row.intent === 'informational') {
    score += 15;
    strengths.push('Informational intent — ideal for AI citations');
  } else if (row.intent === 'commercial') {
    score += 5;
  } else if (row.intent === 'transactional') {
    gaps.push('Transactional intent — rarely cited in AI Overviews');
  }

  // Question format (AI Overviews love Q&A)
  const queryLower = row.query.toLowerCase();
  if (/^(how|what|why|when|who|which|where)/.test(queryLower)) {
    score += 15;
    strengths.push('Question-form query — matches AI Overview Q&A format');
  } else {
    gaps.push('Non-question format — add FAQ section to improve AI citability');
  }

  return {
    geoScore: Math.min(100, score),
    gaps,
    strengths,
  };
}

/**
 * Opportunity Scorer — A-03
 * 4-component composite score (0–100) per GSC row.
 *
 * Components:
 *   A. Traffic Potential    (0–40 pts) — log-normalised impressions × CTR gap
 *   B. CTR Gap Urgency      (0–25 pts) — from CTR gap engine
 *   C. Effort Penalty       (−15 to 0) — position-based friction cost
 *   D. Trend Momentum       (−15 to +20) — from trend-analyser
 *
 * Also classifies effort level and assigns action type priority.
 */

import type { TrendResult } from './trend-analyser';

export type EffortLevel = 'low' | 'medium' | 'high';
export type ActionType =
  | 'cannibalization_fix'
  | 'ai_overview_pivot'
  | 'snippet_rewrite'
  | 'declining_near_p1'
  | 'technical_review'
  | 'quick_win_content'
  | 'content_creation'
  | 'monitor';

export interface OpportunityScore {
  score: number;            // 0–100 composite
  components: {
    A_traffic: number;      // 0–40
    B_ctrGap: number;       // 0–25
    C_effort: number;       // −15 to 0
    D_trend: number;        // −15 to +20
  };
  effort: EffortLevel;
  estimatedMonthlyGain: number; // extra clicks/month if CTR reaches benchmark
  urgencyScore: number;         // 0–25 raw urgency
}

// ─── 2026 CTR curve (per premium spec A-02) ──────────────────────────────────

const CTR_CURVE: Record<number, number> = {
  1: 34.0, 2: 17.0, 3: 11.0, 4: 8.0, 5: 6.5, 6: 5.1, 7: 4.0,
  8: 3.2, 9: 2.6, 10: 2.1, 11: 1.6, 12: 1.3, 13: 1.1, 14: 0.95,
  15: 0.85, 16: 0.77, 17: 0.70, 18: 0.63, 19: 0.57, 20: 0.78,
};
const CTR_DECAY_FACTOR = 0.88; // for positions > 20
const AI_OVERVIEW_MULT = 0.60; // CTR suppression at pos 1-3
const MOBILE_MULT = 0.80;      // mobile CTR discount

/** Interpolated CTR from 2026 curve */
export function getExpectedCTR(
  position: number,
  device: 'mobile' | 'desktop' | 'tablet' = 'desktop',
  aiOverlapRisk: number = 0, // 0–100
): number {
  let base: number;
  const pos = Math.max(1, position);

  if (pos <= 20) {
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) {
      base = CTR_CURVE[lo] ?? 0.5;
    } else {
      const t = pos - lo;
      base = (CTR_CURVE[lo] ?? 0.5) * (1 - t) + (CTR_CURVE[hi] ?? 0.5) * t;
    }
  } else {
    base = CTR_CURVE[20] * Math.pow(CTR_DECAY_FACTOR, pos - 20);
  }

  if (device === 'mobile') base *= MOBILE_MULT;
  if (aiOverlapRisk > 60 && pos <= 3) base *= AI_OVERVIEW_MULT;

  return Math.max(0.1, base);
}

/** CTR gap urgency score (0–25) */
function computeUrgency(ctrGap: number, expectedCTR: number): number {
  return Math.min(25, Math.max(0, Math.abs(ctrGap) / Math.max(expectedCTR, 0.1) * 25));
}

/** Log-normalise a value to 0–1 range */
function logNormalize(value: number, globalMax: number = 10000): number {
  if (value <= 0) return 0;
  return Math.min(1, Math.log10(value + 1) / Math.log10(globalMax + 1));
}

/** Effort penalty based on position (−15 to 0) */
function effortPenalty(position: number, hasCannibalisation: boolean): number {
  let penalty: number;
  if (position <= 10) penalty = 0;
  else if (position <= 20) penalty = -3 * ((position - 10) / 10); // interpolate -0 to -3
  else if (position <= 30) penalty = -8;
  else penalty = -15;

  if (hasCannibalisation) penalty -= 5;
  return Math.max(-15, penalty);
}

/** Effort level from action penalty */
function effortFromPenalty(penalty: number, position: number): EffortLevel {
  if (position <= 10 && Math.abs(penalty) <= 3) return 'low';
  if (Math.abs(penalty) <= 8) return 'medium';
  return 'high';
}

// ─── Main Scorer ─────────────────────────────────────────────────────────────

/**
 * Compute composite opportunity score for a single GSC row.
 */
export function scoreOpportunity(
  row: {
    query: string;
    page: string;
    position: number;
    ctr: number;          // actual CTR percentage (e.g. 2.5)
    impressions: number;
    clicks: number;
    device?: 'mobile' | 'desktop' | 'tablet';
    intent?: string;
    aiOverviewRisk?: number; // 0–100
    hasCannibalisation?: boolean;
  },
  trend?: Pick<TrendResult, 'momentum'>,
  globalMaxImpressions: number = 10000,
): OpportunityScore {
  const { position, ctr, impressions } = row;
  const aiRisk = row.aiOverviewRisk ?? 0;
  const device = row.device ?? 'desktop';
  const hasCannib = row.hasCannibalisation ?? false;

  // Expected CTR at pos 1 (for traffic potential calculation)
  const ctrAtPos1 = getExpectedCTR(1, device, aiRisk);
  const ctrAtCurrent = getExpectedCTR(position, device, aiRisk);

  // A. Traffic Potential (0–40 pts)
  const rawTraffic = impressions * (ctrAtPos1 - ctrAtCurrent) / 100;
  let A_traffic = logNormalize(rawTraffic, globalMaxImpressions) * 40;
  if (aiRisk > 60) A_traffic *= 0.60; // zero-click discount

  // B. CTR Gap Urgency (0–25 pts)
  const expectedCTR = getExpectedCTR(position, device, aiRisk);
  const ctrGap = expectedCTR - ctr; // positive = underperforming
  const B_ctrGap = computeUrgency(ctrGap, expectedCTR);

  // C. Effort Penalty (−15 to 0)
  const C_effort = effortPenalty(position, hasCannib);

  // D. Trend Momentum (−15 to +20)
  const D_trend = trend?.momentum ?? 0;

  const raw = A_traffic + B_ctrGap + C_effort + D_trend;
  const score = Math.min(100, Math.max(0, Math.round(raw)));

  // Estimated monthly gain
  const estimatedMonthlyGain = Math.max(0, Math.round(impressions * ctrGap / 100));

  return {
    score,
    components: {
      A_traffic: parseFloat(A_traffic.toFixed(1)),
      B_ctrGap: parseFloat(B_ctrGap.toFixed(1)),
      C_effort: parseFloat(C_effort.toFixed(1)),
      D_trend,
    },
    effort: effortFromPenalty(C_effort, position),
    estimatedMonthlyGain,
    urgencyScore: parseFloat(B_ctrGap.toFixed(1)),
  };
}

/**
 * Score a batch of rows and return top-N sorted by score.
 */
export function scoreOpportunityBatch(
  rows: Array<Parameters<typeof scoreOpportunity>[0]>,
  trends: Map<string, Pick<TrendResult, 'momentum'>>,
  topN: number = 25,
): Array<Parameters<typeof scoreOpportunity>[0] & { opportunityScore: OpportunityScore }> {
  const globalMaxImpressions = Math.max(...rows.map(r => r.impressions), 1000);

  return rows
    .map(row => ({
      ...row,
      opportunityScore: scoreOpportunity(
        row,
        trends.get(row.query),
        globalMaxImpressions,
      ),
    }))
    .sort((a, b) => b.opportunityScore.score - a.opportunityScore.score)
    .slice(0, topN);
}

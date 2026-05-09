/**
 * SEO Health Score — A-08
 * 6-dimension weighted composite score (0–100).
 *
 * Dimensions:
 *   1. CTR Performance      25% — % of rows above CTR benchmark
 *   2. Position Trends       20% — normalized average trend momentum
 *   3. Cannibalization       20% — penalizes per conflict found
 *   4. AI Overview Risk      15% — invert of average risk score
 *   5. Content Coverage      10% — ratio of queries with clicks
 *   6. Core Web Vitals       10% — stub (defaults to 70 if no CWV data)
 *
 * Weekly delta: current score vs. stored previous score.
 */

import type { TrendResult } from './trend-analyser';
import type { AIOverviewRiskResult } from './ai-overview-risk';

export interface HealthDimension {
  name: string;
  weight: number;
  score: number;       // 0–100
  label: string;       // human-readable assessment
}

export interface HealthScoreResult {
  overallScore: number;          // 0–100 weighted composite
  dimensions: HealthDimension[];
  weeklyDelta: number | null;    // null if no previous score available
  trend: '↑ Rising' | '→ Stable' | '↓ Declining';
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalOpportunities: number;
  resolvedThisWeek: number;
  estimatedMonthlyGain: number;  // total gain from open opportunities
}

// ─── Dimension Scorers ────────────────────────────────────────────────────────

interface HealthInput {
  rows: Array<{
    ctr: number;
    benchmarkCTR: number;   // expected CTR from opportunity-scorer
    clicks: number;
    impressions: number;
  }>;
  trends: TrendResult[];
  cannibalizationConflicts: number; // count of detected conflicts
  aiOverviewItems: AIOverviewRiskResult[];
  cwvScore?: number;               // 0–100, optional (from CrUX / PSI)
  previousScore?: number;          // stored last week's score
  totalOpportunities?: number;
  resolvedThisWeek?: number;
  estimatedMonthlyGain?: number;
}

function ctrScore(rows: HealthInput['rows']): { score: number; label: string } {
  if (rows.length === 0) return { score: 50, label: 'No data' };
  const aboveCurve = rows.filter(r => r.ctr >= r.benchmarkCTR).length;
  const pct = (aboveCurve / rows.length) * 100;
  const score = Math.min(100, Math.round(pct));
  const label = score >= 70 ? 'Most pages performing above CTR benchmark'
    : score >= 40 ? 'About half of pages at or above benchmark'
    : 'Most pages underperforming vs CTR benchmark';
  return { score, label };
}

function trendScore(trends: TrendResult[]): { score: number; label: string } {
  if (trends.length === 0) return { score: 50, label: 'No trend data' };
  const avgMomentum = trends.reduce((s, t) => s + t.momentum, 0) / trends.length;
  // Normalize from [−15, +20] → [0, 100]
  const score = Math.min(100, Math.max(0, Math.round(((avgMomentum + 15) / 35) * 100)));
  const label = score >= 70 ? 'Site trends mostly improving'
    : score >= 45 ? 'Mixed trend signals — some rising, some falling'
    : 'Site trends mostly declining — action needed';
  return { score, label };
}

function cannibalizationScore(conflicts: number): { score: number; label: string } {
  const score = Math.max(0, Math.min(100, 100 - conflicts * 15));
  const label = conflicts === 0 ? 'No cannibalization detected'
    : conflicts <= 3 ? `${conflicts} conflicts found — manageable`
    : `${conflicts} conflicts — significant cannibalization issue`;
  return { score, label };
}

function aiRiskScore(items: AIOverviewRiskResult[]): { score: number; label: string } {
  if (items.length === 0) return { score: 75, label: 'No high-risk queries detected' };
  const avgRisk = items.reduce((s, r) => s + r.riskScore, 0) / items.length;
  const score = Math.min(100, Math.max(0, Math.round(100 - avgRisk)));
  const label = score >= 70 ? 'Low AI Overview exposure'
    : score >= 45 ? 'Moderate AI Overview risk — some queries at risk'
    : 'High AI Overview risk — significant click suppression likely';
  return { score, label };
}

function contentCoverageScore(rows: HealthInput['rows']): { score: number; label: string } {
  if (rows.length === 0) return { score: 50, label: 'No data' };
  const withClicks = rows.filter(r => r.clicks > 0).length;
  const score = Math.min(100, Math.round((withClicks / rows.length) * 100));
  const label = score >= 70 ? 'Good content coverage — most queries getting clicks'
    : score >= 40 ? 'Moderate coverage — many zero-click queries'
    : 'Poor coverage — most queries getting no clicks';
  return { score, label };
}

// ─── Main Health Score ────────────────────────────────────────────────────────

export function computeHealthScore(input: HealthInput): HealthScoreResult {
  const d1 = ctrScore(input.rows);
  const d2 = trendScore(input.trends);
  const d3 = cannibalizationScore(input.cannibalizationConflicts);
  const d4 = aiRiskScore(input.aiOverviewItems);
  const d5 = contentCoverageScore(input.rows);
  const d6Score = input.cwvScore ?? 70; // default to 70 if no CWV data available

  const dimensions: HealthDimension[] = [
    { name: 'CTR Performance',  weight: 0.25, score: d1.score, label: d1.label },
    { name: 'Position Trends',  weight: 0.20, score: d2.score, label: d2.label },
    { name: 'Cannibalization',  weight: 0.20, score: d3.score, label: d3.label },
    { name: 'AI Overview Risk', weight: 0.15, score: d4.score, label: d4.label },
    { name: 'Content Coverage', weight: 0.10, score: d5.score, label: d5.label },
    { name: 'Core Web Vitals',  weight: 0.10, score: d6Score,  label: d6Score >= 70 ? 'Good Core Web Vitals' : 'Core Web Vitals need attention' },
  ];

  const overallScore = Math.round(
    dimensions.reduce((s, d) => s + d.score * d.weight, 0),
  );

  const weeklyDelta = input.previousScore !== undefined
    ? overallScore - input.previousScore
    : null;

  let trend: HealthScoreResult['trend'];
  if (weeklyDelta === null) trend = '→ Stable';
  else if (weeklyDelta > 3) trend = '↑ Rising';
  else if (weeklyDelta < -3) trend = '↓ Declining';
  else trend = '→ Stable';

  const grade: HealthScoreResult['grade'] =
    overallScore >= 90 ? 'A'
    : overallScore >= 75 ? 'B'
    : overallScore >= 60 ? 'C'
    : overallScore >= 40 ? 'D'
    : 'F';

  return {
    overallScore,
    dimensions,
    weeklyDelta,
    trend,
    grade,
    totalOpportunities: input.totalOpportunities ?? 0,
    resolvedThisWeek: input.resolvedThisWeek ?? 0,
    estimatedMonthlyGain: input.estimatedMonthlyGain ?? 0,
  };
}

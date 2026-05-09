/**
 * Progress Engine — Auto-resolution diff engine
 *
 * On each GSC import: fetches open opportunities, checks per-action-type
 * resolution conditions, marks resolved items, recalculates health score.
 *
 * Resolution conditions per action type:
 *   snippet_rewrite     → CTR gap closed to ≤ −1% (underperforming by less than 1%)
 *   cannibalization_fix → no longer 2+ pages ranking for same query
 *   quick_win_content   → page moved from pos 11-20 to pos ≤ 10
 *   content_creation    → page moved to pos ≤ 20
 *   ai_overview_pivot   → AI risk score dropped below 40
 *   declining_near_p1   → trend momentum changed to positive
 *   technical_review    → volatility changed from 'volatile' to 'stable'/'unstable'
 *   monitor             → never auto-resolved (only manual)
 */

import type { ActionType } from './action-router';
import type { TrendResult } from './trend-analyser';

export interface OpenOpportunity {
  id: number;
  siteId: number;
  query: string;
  page: string;
  actionType: ActionType;
  score: number;
  estimatedGain: number;
  priority: number;
  effort: string;
  actionPlan: unknown;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  createdAt: Date;
}

export interface ResolutionCheck {
  opportunityId: number;
  query: string;
  actionType: ActionType;
  shouldResolve: boolean;
  reason: string;
  method: 'auto_detected' | 'manually_marked';
}

export interface CurrentRowData {
  query: string;
  page: string;
  ctr: number;
  position: number;
  impressions: number;
  ctrGap?: number;        // actual - expected (negative = underperforming)
  aiRisk?: number;        // 0–100
}

// ─── Per-action resolution condition checks ───────────────────────────────────

function checkSnippetRewrite(
  opp: OpenOpportunity,
  currentRows: CurrentRowData[],
): ResolutionCheck {
  const current = currentRows.find(r => r.query === opp.query && r.page === opp.page);
  if (!current) {
    return { opportunityId: opp.id, query: opp.query, actionType: opp.actionType, shouldResolve: false, reason: 'Query no longer in GSC data', method: 'auto_detected' };
  }
  // Resolved if CTR gap is now ≤ 1% below benchmark
  const resolved = (current.ctrGap ?? -999) >= -1;
  return {
    opportunityId: opp.id, query: opp.query, actionType: opp.actionType,
    shouldResolve: resolved,
    reason: resolved ? `CTR gap closed to ${current.ctrGap?.toFixed(1)}% — within acceptable range` : `CTR gap still ${current.ctrGap?.toFixed(1)}%`,
    method: 'auto_detected',
  };
}

function checkCannibalization(
  opp: OpenOpportunity,
  currentRows: CurrentRowData[],
): ResolutionCheck {
  // Resolved if only 1 page now ranks for this query
  const pages = new Set(currentRows.filter(r => r.query === opp.query).map(r => r.page));
  const resolved = pages.size <= 1;
  return {
    opportunityId: opp.id, query: opp.query, actionType: opp.actionType,
    shouldResolve: resolved,
    reason: resolved ? 'Only 1 page now ranks for this query — conflict resolved' : `${pages.size} pages still competing`,
    method: 'auto_detected',
  };
}

function checkQuickWin(
  opp: OpenOpportunity,
  currentRows: CurrentRowData[],
): ResolutionCheck {
  const current = currentRows.find(r => r.query === opp.query && r.page === opp.page);
  if (!current) return { opportunityId: opp.id, query: opp.query, actionType: opp.actionType, shouldResolve: false, reason: 'Not in current data', method: 'auto_detected' };
  const resolved = current.position <= 10;
  return {
    opportunityId: opp.id, query: opp.query, actionType: opp.actionType,
    shouldResolve: resolved,
    reason: resolved ? `Page moved to position ${current.position.toFixed(1)} — now on page 1` : `Still at position ${current.position.toFixed(1)}`,
    method: 'auto_detected',
  };
}

function checkContentCreation(
  opp: OpenOpportunity,
  currentRows: CurrentRowData[],
): ResolutionCheck {
  const current = currentRows.find(r => r.query === opp.query && r.page === opp.page);
  if (!current) return { opportunityId: opp.id, query: opp.query, actionType: opp.actionType, shouldResolve: false, reason: 'Not yet ranking', method: 'auto_detected' };
  const resolved = current.position <= 20;
  return {
    opportunityId: opp.id, query: opp.query, actionType: opp.actionType,
    shouldResolve: resolved,
    reason: resolved ? `Page now ranking at position ${current.position.toFixed(1)}` : `Still at position ${current.position.toFixed(1)}`,
    method: 'auto_detected',
  };
}

function checkAIOverviewPivot(
  opp: OpenOpportunity,
  currentRows: CurrentRowData[],
): ResolutionCheck {
  const current = currentRows.find(r => r.query === opp.query);
  if (!current) return { opportunityId: opp.id, query: opp.query, actionType: opp.actionType, shouldResolve: false, reason: 'Not in current data', method: 'auto_detected' };
  const resolved = (current.aiRisk ?? 100) < 40;
  return {
    opportunityId: opp.id, query: opp.query, actionType: opp.actionType,
    shouldResolve: resolved,
    reason: resolved ? `AI risk score dropped to ${current.aiRisk} — below threshold` : `AI risk still at ${current.aiRisk}`,
    method: 'auto_detected',
  };
}

// ─── Main Diff Engine ─────────────────────────────────────────────────────────

/**
 * Run auto-resolution check for all open opportunities.
 * Returns a list of resolution results — the caller persists updates to DB.
 */
export function runResolutionDiff(
  openOpportunities: OpenOpportunity[],
  currentRows: CurrentRowData[],
  currentTrends?: Map<string, TrendResult>,
): ResolutionCheck[] {
  return openOpportunities.map(opp => {
    switch (opp.actionType) {
      case 'snippet_rewrite':
        return checkSnippetRewrite(opp, currentRows);
      case 'cannibalization_fix':
        return checkCannibalization(opp, currentRows);
      case 'quick_win_content':
      case 'declining_near_p1':
        return checkQuickWin(opp, currentRows);
      case 'content_creation':
        return checkContentCreation(opp, currentRows);
      case 'ai_overview_pivot':
        return checkAIOverviewPivot(opp, currentRows);
      case 'technical_review': {
        const trend = currentTrends?.get(opp.query);
        const resolved = trend?.volatility === 'stable';
        return {
          opportunityId: opp.id, query: opp.query, actionType: opp.actionType,
          shouldResolve: resolved,
          reason: resolved ? 'Ranking stabilized — no longer volatile' : 'Still volatile',
          method: 'auto_detected',
        };
      }
      default:
        return { opportunityId: opp.id, query: opp.query, actionType: opp.actionType, shouldResolve: false, reason: 'Manual review required', method: 'manually_marked' };
    }
  });
}

/**
 * Compute weekly progress summary from resolution results.
 */
export function computeWeeklySummary(
  checks: ResolutionCheck[],
  totalOpportunities: number,
): {
  resolvedCount: number;
  openCount: number;
  resolutionRate: number;
  milestoneTriggered: boolean; // true if 3+ resolved in one batch
  message: string;
} {
  const resolved = checks.filter(c => c.shouldResolve).length;
  const open = totalOpportunities - resolved;
  const rate = totalOpportunities > 0 ? Math.round((resolved / totalOpportunities) * 100) : 0;
  const milestone = resolved >= 3;

  const message = milestone
    ? `🎉 Milestone: You resolved ${resolved} SEO issues this batch! Your health score is improving.`
    : resolved > 0
    ? `✅ ${resolved} issue${resolved > 1 ? 's' : ''} auto-resolved. Keep it up!`
    : 'No automatic resolutions detected — check your open opportunities.';

  return { resolvedCount: resolved, openCount: open, resolutionRate: rate, milestoneTriggered: milestone, message };
}

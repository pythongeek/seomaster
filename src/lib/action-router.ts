/**
 * Action Router — A-07
 * Priority-ordered assignment of each GSC row to a typed action.
 * First matching priority wins.
 *
 * Priority order:
 *   1. cannibalization_fix     — competing pages, fix first
 *   2. ai_overview_pivot       — AI risk ≥60 AND pos ≤5
 *   3. snippet_rewrite         — CTR gap ≤−3% AND pos ≤10
 *   3. declining_near_p1       — pos 11-20 + falling trend
 *   3. technical_review        — volatile + pos ≤10
 *   4. quick_win_content       — pos 11-20 + rising trend
 *   5. content_creation        — pos >20 + score ≥50
 *  10. monitor                 — default
 */

import type { TrendResult } from './trend-analyser';
import type { OpportunityScore, ActionType, EffortLevel } from './opportunity-scorer';

// Re-export so callers can import ActionType from either module
export type { ActionType, EffortLevel } from './opportunity-scorer';


export interface ActionResult {
  actionType: ActionType;
  priority: 1 | 2 | 3 | 4 | 5 | 10;
  effort: EffortLevel;
  estimatedGain: number;     // clicks/month
  steps: ActionStep[];
  effortLabel: string;       // 'Low (30 min)' | 'Medium (2 hr)' | 'High (1 day)'
}

export interface ActionStep {
  stepNumber: number;
  title: string;
  description: string;
  timeEstimate: string;
  expectedLift: string;
}

// ─── Effort Labels ────────────────────────────────────────────────────────────

const EFFORT_LABELS: Record<EffortLevel, string> = {
  low: 'Low (30 min)',
  medium: 'Medium (2 hr)',
  high: 'High (1 day)',
};

// ─── Static step templates (AI generates richer versions at runtime) ──────────

function cannibalisationSteps(query: string, pages: string[]): ActionStep[] {
  return [
    {
      stepNumber: 1,
      title: 'Identify the canonical winner',
      description: `Compare the competing pages for "${query}": ${pages.join(', ')}. Pick the one with highest impressions and best average position as the keeper.`,
      timeEstimate: '15 min',
      expectedLift: 'Consolidates split ranking signal',
    },
    {
      stepNumber: 2,
      title: '301-redirect the loser(s)',
      description: 'Redirect all losing pages to the canonical winner URL. Update any internal links pointing to the old URLs.',
      timeEstimate: '20 min',
      expectedLift: '+35% click recovery estimated',
    },
    {
      stepNumber: 3,
      title: 'Add canonical tag (if 301 not possible)',
      description: 'If you cannot redirect (e.g. both pages must exist), add <link rel="canonical"> on the loser pointing to the winner.',
      timeEstimate: '10 min',
      expectedLift: 'Signals preferred URL to Google',
    },
    {
      stepNumber: 4,
      title: 'Update sitemap and resubmit',
      description: 'Remove losers from XML sitemap. Submit updated sitemap via Google Search Console.',
      timeEstimate: '5 min',
      expectedLift: 'Faster resolution in Google index',
    },
  ];
}

function snippetRewriteSteps(query: string, ctrGap: number): ActionStep[] {
  return [
    {
      stepNumber: 1,
      title: 'Rewrite title tag',
      description: `Include "${query}" near the start. Add power words or year. Keep under 60 characters. Test: power word + keyword + benefit.`,
      timeEstimate: '10 min',
      expectedLift: '+1.5–2% CTR lift',
    },
    {
      stepNumber: 2,
      title: 'Rewrite meta description',
      description: 'Add a clear call-to-action, include the keyword naturally, keep under 155 chars. Use active voice. Add a hook in the first 10 words.',
      timeEstimate: '10 min',
      expectedLift: '+1–1.5% CTR lift',
    },
    {
      stepNumber: 3,
      title: 'Add FAQ schema',
      description: 'Add FAQ structured data with 2–3 questions from "People Also Ask" for this query. Increases rich result probability.',
      timeEstimate: '15 min',
      expectedLift: '+2% CTR if featured in rich result',
    },
  ];
}

function quickWinSteps(query: string, position: number): ActionStep[] {
  return [
    {
      stepNumber: 1,
      title: 'Add semantic depth to the page',
      description: `Page is at position ${position} — add 300–500 words covering related subtopics, FAQs, and supporting data for "${query}".`,
      timeEstimate: '60 min',
      expectedLift: '+3–5 position improvement',
    },
    {
      stepNumber: 2,
      title: 'Build 2–3 internal links to this page',
      description: 'Find related pages on your site that can naturally link to this page using keyword-rich anchor text.',
      timeEstimate: '20 min',
      expectedLift: 'Improves PageRank flow to this page',
    },
    {
      stepNumber: 3,
      title: 'Optimise schema markup',
      description: 'Add appropriate schema (HowTo, FAQ, Article) to improve SERP appearance and click-through rate.',
      timeEstimate: '20 min',
      expectedLift: '+1–2% CTR from rich result',
    },
  ];
}

function contentCreationSteps(query: string): ActionStep[] {
  return [
    {
      stepNumber: 1,
      title: 'Generate AI content brief',
      description: `Use the Content Brief Generator to create a full outline for "${query}" with recommended H2s, word count, angle, and schema.`,
      timeEstimate: '2 min (AI generates)',
      expectedLift: 'Defines your content strategy',
    },
    {
      stepNumber: 2,
      title: 'Write the content',
      description: 'Follow the brief. Target 1,200–2,000 words. Include direct answers, data, and unique insights. Add original examples.',
      timeEstimate: '2–4 hours',
      expectedLift: 'New ranking opportunity',
    },
    {
      stepNumber: 3,
      title: 'Add internal links and publish',
      description: 'Link from 3+ existing pages using keyword-rich anchor text. Submit to Google via Search Console URL Inspection.',
      timeEstimate: '30 min',
      expectedLift: 'Faster indexing + authority transfer',
    },
  ];
}

function monitorSteps(query: string): ActionStep[] {
  return [
    {
      stepNumber: 1,
      title: 'Set a review reminder',
      description: `Add "${query}" to your weekly monitoring list. No action needed now — check again in 7–14 days for position or CTR changes.`,
      timeEstimate: '2 min',
      expectedLift: 'Proactive monitoring',
    },
  ];
}

function aiPivotSteps(query: string): ActionStep[] {
  return [
    {
      stepNumber: 1,
      title: 'Add unique data or original research',
      description: `For "${query}", add charts, statistics, or a proprietary angle that AI cannot replicate. Data-backed content gets cited in AI answers.`,
      timeEstimate: '60 min',
      expectedLift: 'Differentiates from AI-generated answers',
    },
    {
      stepNumber: 2,
      title: 'Pivot title to comparison or tool angle',
      description: 'Reframe the content as a comparison ("Best X vs Y 2026") or a tool/calculator to reduce zero-click risk.',
      timeEstimate: '20 min',
      expectedLift: 'Targets users who need more than an AI snippet',
    },
    {
      stepNumber: 3,
      title: 'Add Schema markup for AI visibility',
      description: 'Add FAQPage, HowTo, or Dataset schema. E-E-A-T signals: author byline, credentials, date updated.',
      timeEstimate: '30 min',
      expectedLift: 'Improves chance of being cited in AI Overview',
    },
  ];
}

function technicalReviewSteps(query: string): ActionStep[] {
  return [
    {
      stepNumber: 1,
      title: 'Check crawl and index status',
      description: `Use Google Search Console → URL Inspection for the ranking page for "${query}". Confirm indexing is not blocked.`,
      timeEstimate: '10 min',
      expectedLift: 'Rules out crawl/index issues',
    },
    {
      stepNumber: 2,
      title: 'Run Core Web Vitals check',
      description: 'Use PageSpeed Insights for this page. Fix LCP, INP, CLS if failing — volatile rankings often correlate with poor CWV.',
      timeEstimate: '20 min (diagnosis)',
      expectedLift: 'Stabilizes volatile rankings',
    },
    {
      stepNumber: 3,
      title: 'Check for manual actions or penalties',
      description: 'Review Search Console → Manual Actions. Look for link-related or spam penalties.',
      timeEstimate: '5 min',
      expectedLift: 'Eliminates penalty as cause',
    },
  ];
}

// ─── Main Router ─────────────────────────────────────────────────────────────

export function routeAction(
  row: {
    query: string;
    position: number;
    ctr: number;
    impressions: number;
    hasCannibalisation: boolean;
    cannibalisationPages?: string[];
    aiOverviewRisk: number;
    ctrGap: number;         // actual - expected (negative = underperforming)
  },
  trend: Pick<TrendResult, 'momentum' | 'volatility'>,
  opportunityScore: OpportunityScore,
): ActionResult {
  const { query, position, hasCannibalisation, aiOverviewRisk, ctrGap } = row;
  const { momentum, volatility } = trend;

  // Priority 1: Fix cannibalisation first
  if (hasCannibalisation) {
    const pages = row.cannibalisationPages ?? ['(multiple pages)'];
    return {
      actionType: 'cannibalization_fix',
      priority: 1,
      effort: 'medium',
      estimatedGain: Math.round(row.impressions * 0.35),
      steps: cannibalisationSteps(query, pages),
      effortLabel: 'Medium (2–4 hr)',
    };
  }

  // Priority 2: AI Overview pivot
  if (aiOverviewRisk >= 60 && position <= 5) {
    return {
      actionType: 'ai_overview_pivot',
      priority: 1,
      effort: 'high',
      estimatedGain: Math.round(opportunityScore.estimatedMonthlyGain * 0.4),
      steps: aiPivotSteps(query),
      effortLabel: 'High (1 day)',
    };
  }

  // Priority 3a: Snippet rewrite (CTR gap ≤ −3% at top 10)
  if (ctrGap <= -3 && position <= 10) {
    return {
      actionType: 'snippet_rewrite',
      priority: 2,
      effort: 'low',
      estimatedGain: opportunityScore.estimatedMonthlyGain,
      steps: snippetRewriteSteps(query, ctrGap),
      effortLabel: 'Low (30 min)',
    };
  }

  // Priority 3b: Declining in pos 11-20
  if (position >= 11 && position <= 20 && momentum < 0) {
    return {
      actionType: 'declining_near_p1',
      priority: 2,
      effort: 'medium',
      estimatedGain: opportunityScore.estimatedMonthlyGain,
      steps: quickWinSteps(query, position),
      effortLabel: 'Medium (2 hr)',
    };
  }

  // Priority 3c: Technical review for volatile top-10
  if (volatility === 'volatile' && position <= 10) {
    return {
      actionType: 'technical_review',
      priority: 3,
      effort: 'high',
      estimatedGain: 0,
      steps: technicalReviewSteps(query),
      effortLabel: 'High (dev needed)',
    };
  }

  // Priority 4: Quick win — pos 11-20 with positive or stable trend
  if (position >= 11 && position <= 20 && momentum >= 0) {
    return {
      actionType: 'quick_win_content',
      priority: 2,
      effort: 'medium',
      estimatedGain: opportunityScore.estimatedMonthlyGain,
      steps: quickWinSteps(query, position),
      effortLabel: 'Medium (2 hr)',
    };
  }

  // Priority 5: Content creation for deep positions with decent score
  if (position > 20 && opportunityScore.score >= 50) {
    return {
      actionType: 'content_creation',
      priority: 4,
      effort: 'high',
      estimatedGain: opportunityScore.estimatedMonthlyGain,
      steps: contentCreationSteps(query),
      effortLabel: 'High (3+ days)',
    };
  }

  // Default: Monitor
  return {
    actionType: 'monitor',
    priority: 10,
    effort: 'low',
    estimatedGain: 0,
    steps: monitorSteps(query),
    effortLabel: 'None',
  };
}

/**
 * Priority Action Feed selector — picks the single best next action.
 * Beginner mode: 1 item. Expert mode: top 3.
 */
export function selectPriorityActions(
  actions: Array<{ query: string; page: string; result: ActionResult; score: number }>,
  maxItems: number = 1,
): typeof actions {
  // Phase 1: P1 items sorted by estimated gain
  const p1 = actions
    .filter(a => a.result.priority === 1 && a.result.estimatedGain > 0)
    .sort((a, b) => b.result.estimatedGain - a.result.estimatedGain);

  if (p1.length > 0) return p1.slice(0, maxItems);

  // Phase 2: P2 items by effort-adjusted score
  const effortCost: Record<EffortLevel, number> = { low: 1, medium: 2, high: 4 };
  const p2 = actions
    .filter(a => a.result.priority === 2)
    .sort((a, b) => {
      const ra = a.score / effortCost[a.result.effort];
      const rb = b.score / effortCost[b.result.effort];
      return rb - ra;
    });

  if (p2.length > 0) return p2.slice(0, maxItems);

  // Phase 3+: Continue down priorities
  return actions
    .filter(a => a.result.priority <= 5)
    .sort((a, b) => a.result.priority - b.result.priority || b.score - a.score)
    .slice(0, maxItems);
}

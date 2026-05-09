import { NextRequest, NextResponse } from 'next/server';
import { getHealthHistory, getLatestHealthScore } from '@/db/queries';
import { initPremiumTables } from '@/db/queries';

export const runtime = 'nodejs';

/**
 * GET /api/health-score?siteUrl=...&weeks=12
 * Returns the current health score and weekly trend history.
 */
export async function GET(req: NextRequest) {
  try {
    await initPremiumTables(); // idempotent
    const siteUrl = req.nextUrl.searchParams.get('siteUrl');
    const weeks = parseInt(req.nextUrl.searchParams.get('weeks') ?? '12', 10);

    if (!siteUrl) {
      return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 });
    }

    const history = await getHealthHistory(siteUrl, weeks);
    const currentScore = await getLatestHealthScore(siteUrl);

    // Build a weekly trend series for the chart
    const trendSeries = history
      .slice()
      .reverse() // oldest → newest
      .map(h => ({
        week: h.recordedAt,
        score: h.overallScore,
        delta: h.weeklyDelta,
        totalOpportunities: h.totalOpportunities,
        resolvedThisWeek: h.resolvedThisWeek,
        estimatedMonthlyGain: h.estimatedMonthlyGain,
        dimensions: {
          ctrPerformance: h.ctrPerformance,
          positionTrends: h.positionTrends,
          cannibalization: h.cannibalization,
          aiOverviewRisk: h.aiOverviewRisk,
          contentCoverage: h.contentCoverage,
          cwvScore: h.cwvScore,
        },
      }));

    const latestEntry = history[0];
    const trend =
      latestEntry?.weeklyDelta === null ? '→ Stable'
      : (latestEntry?.weeklyDelta ?? 0) > 3 ? '↑ Rising'
      : (latestEntry?.weeklyDelta ?? 0) < -3 ? '↓ Declining'
      : '→ Stable';

    const grade =
      (currentScore ?? 0) >= 90 ? 'A'
      : (currentScore ?? 0) >= 75 ? 'B'
      : (currentScore ?? 0) >= 60 ? 'C'
      : (currentScore ?? 0) >= 40 ? 'D'
      : 'F';

    return NextResponse.json({
      siteUrl,
      currentScore,
      trend,
      grade,
      latestEntry,
      trendSeries,
    });
  } catch (err) {
    console.error('[/api/health-score GET]', err);
    return NextResponse.json({ error: 'Failed to fetch health score' }, { status: 500 });
  }
}

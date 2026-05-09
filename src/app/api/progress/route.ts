import { NextRequest, NextResponse } from 'next/server';
import { getOpenOpportunities, getAllOpportunities, markOpportunityResolved, markOpportunityStatus } from '@/db/queries';
import { initPremiumTables } from '@/db/queries';

export const runtime = 'nodejs';

/**
 * GET /api/progress?siteUrl=...&status=open|all
 * Returns opportunities for a site, optionally filtered by status.
 */
export async function GET(req: NextRequest) {
  try {
    await initPremiumTables(); // idempotent
    const siteUrl = req.nextUrl.searchParams.get('siteUrl');
    const status = req.nextUrl.searchParams.get('status') ?? 'open';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '25', 10);

    if (!siteUrl) {
      return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 });
    }

    const opps = status === 'all'
      ? await getAllOpportunities(siteUrl, limit)
      : await getOpenOpportunities(siteUrl, limit);

    return NextResponse.json({
      siteUrl,
      status,
      count: opps.length,
      opportunities: opps,
    });
  } catch (err) {
    console.error('[/api/progress GET]', err);
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
  }
}

/**
 * PATCH /api/progress
 * Mark an opportunity as resolved (or any status).
 * Body: { id: number, status: 'resolved' | 'dismissed' | 'in_progress', reason?: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id: number;
      status?: 'open' | 'in_progress' | 'resolved' | 'dismissed';
      reason?: string;
    };

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const newStatus = body.status ?? 'resolved';

    if (newStatus === 'resolved') {
      await markOpportunityResolved(body.id, body.reason ?? 'Manually marked as resolved');
    } else {
      await markOpportunityStatus(body.id, newStatus);
    }

    return NextResponse.json({ success: true, id: body.id, status: newStatus });
  } catch (err) {
    console.error('[/api/progress PATCH]', err);
    return NextResponse.json({ error: 'Failed to update opportunity' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { generateCSV, generatePDFHTML, generateClipboardText } from '@/lib/export-engine';
import { getAllOpportunities } from '@/db/queries';
import type { ExportOpportunity } from '@/lib/export-engine';

export const runtime = 'nodejs';

/**
 * POST /api/export
 * Generate a CSV, PDF HTML, or clipboard export of opportunities.
 *
 * Body: {
 *   format: 'csv' | 'pdf' | 'clipboard',
 *   siteUrl: string,
 *   dateRange?: string,
 *   healthScore?: number,
 *   aiSummary?: string,
 *   includeResolved?: boolean,
 *   opportunities?: ExportOpportunity[]  // optional override
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      format: 'csv' | 'pdf' | 'clipboard';
      siteUrl: string;
      dateRange?: string;
      healthScore?: number;
      aiSummary?: string;
      includeResolved?: boolean;
      opportunities?: ExportOpportunity[];
    };

    if (!body.format || !body.siteUrl) {
      return NextResponse.json({ error: 'format and siteUrl are required' }, { status: 400 });
    }

    // Fetch from DB if opportunities not provided in body
    let opps: ExportOpportunity[];
    if (body.opportunities && Array.isArray(body.opportunities) && body.opportunities.length > 0) {
      opps = body.opportunities;
    } else {
      const dbOpps = await getAllOpportunities(body.siteUrl, 100);
      opps = dbOpps.map(o => ({
        query: o.query,
        page: o.page,
        position: 0, // position not stored on opp — caller should pass their own
        ctr: 0,
        impressions: 0,
        clicks: 0,
        estimatedGain: o.estimatedGain ?? 0,
        opportunityScore: o.score,
        actionType: (o.actionType as ExportOpportunity['actionType']),
        effort: (o.effort as ExportOpportunity['effort']),
        priority: o.priority,
        status: (o.status as ExportOpportunity['status']),
      }));
    }

    const options = {
      format: body.format,
      siteUrl: body.siteUrl,
      dateRange: body.dateRange,
      healthScore: body.healthScore,
      aiSummary: body.aiSummary,
      includeResolved: body.includeResolved ?? false,
    };

    switch (body.format) {
      case 'csv': {
        const csv = generateCSV(opps, options);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="seomaster-${body.siteUrl.replace(/[^a-z0-9]/gi, '-')}-export.csv"`,
          },
        });
      }
      case 'pdf': {
        const html = generatePDFHTML(opps, options);
        return new NextResponse(html, {
          headers: { 'Content-Type': 'text/html' },
        });
      }
      case 'clipboard': {
        const text = generateClipboardText(opps, options);
        return NextResponse.json({ text });
      }
      default:
        return NextResponse.json({ error: 'Unknown format' }, { status: 400 });
    }
  } catch (err) {
    console.error('[/api/export]', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

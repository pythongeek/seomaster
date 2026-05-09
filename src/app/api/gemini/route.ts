import { NextRequest, NextResponse } from 'next/server';
import { checkSERPForAIOverview, enrichWithTrends, analyzeCompetitorGap, isGeminiAvailable } from '@/lib/gemini-client';

export const runtime = 'nodejs';

/**
 * POST /api/gemini
 * Proxy for Gemini Search Intelligence calls.
 * Only fires for high-risk queries (caller should gate on aiRisk > 40).
 *
 * Body: { tool: 'serp_check' | 'trends' | 'competitor_gap', query: string, domain?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      tool: 'serp_check' | 'trends' | 'competitor_gap';
      query: string;
      domain?: string;
    };

    if (!body.query || !body.tool) {
      return NextResponse.json({ error: 'query and tool are required' }, { status: 400 });
    }

    if (!isGeminiAvailable()) {
      return NextResponse.json({
        available: false,
        stub: true,
        message: 'Add GEMINI_API_KEY to .env.local to enable live search intelligence',
      });
    }

    switch (body.tool) {
      case 'serp_check': {
        const result = await checkSERPForAIOverview(body.query);
        return NextResponse.json(result);
      }
      case 'trends': {
        const result = await enrichWithTrends(body.query);
        return NextResponse.json(result);
      }
      case 'competitor_gap': {
        const result = await analyzeCompetitorGap(body.query, body.domain);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: `Unknown tool: ${body.tool}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[/api/gemini] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    available: isGeminiAvailable(),
    tools: ['serp_check', 'trends', 'competitor_gap'],
    note: isGeminiAvailable() ? 'Gemini ready' : 'Add GEMINI_API_KEY to enable',
  });
}

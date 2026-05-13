import { NextRequest, NextResponse } from 'next/server';
import { callMiniMaxRaw, callGeminiRaw, callAIValidated } from '@/lib/ai-client';
import { AgenticAnalysisSchema } from '@/lib/ai-schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userContent, mode } = await req.json();
    const engine = req.headers.get('x-ai-engine') === 'gemini' ? 'gemini' : 'minimax';

    if (!systemPrompt || !userContent) {
      return NextResponse.json({ error: 'systemPrompt and userContent are required' }, { status: 400 });
    }

    if (mode === 'agentic') {
      const systemPromptAgentic = `You are an expert SEO analyst. Your job: turn raw GSC data into precise, ranked recommendations.

ANALYTICAL METHODOLOGY:
1. Calculate CTR benchmark vs actual for each position (position 1 ≈ 31%, position 2 ≈ 20%, position 3 ≈ 13%, position 4-10 ≈ 5-2%)
2. Identify gap = benchmark CTR - actual CTR → this is your opportunity
3. Flag ranking clusters: same query across multiple URLs = cannibalization
4. Cross-reference position with search intent — position 4-10 with high impressions = prime for title/meta fix
5. Check AI Overview eligibility: position < 10, informational intent, structured content present

OUTPUT FORMAT:
- score: 0-100 SEO health score
- findings: list every issue with exact metric, diagnosis (why), and specific recommendation
- topPriorityActions: 3 actions ranked by impact/effort ratio
- aiOverviewCandidates: queries ranking 5-10 with informational intent
- cannibalizationSignals: any query showing across 3+ URLs
- quickWins: any fix requiring < 30 min

CRITICAL: Cite specific data points in every finding. "CTR is low" is useless. "CTR 1.2% at position 7 vs 3.1% benchmark = 1.9pp gap = ~240 lost clicks/month" is useful.

Always include: diagnosis (why) + specific recommendation (what exact change). Never generic advice.`;

      const structured = await callAIValidated(systemPromptAgentic, userContent, AgenticAnalysisSchema, engine);
      return NextResponse.json({ text: JSON.stringify(structured), structured });
    }

    // Standard AI call
    const text = engine === 'gemini'
      ? await callGeminiRaw(systemPrompt, userContent)
      : await callMiniMaxRaw(systemPrompt, userContent);
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

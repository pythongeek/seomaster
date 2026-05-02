import { NextRequest, NextResponse } from 'next/server';
import { callMiniMaxRaw, callAIValidated } from '@/lib/ai-client';
import { AgenticAnalysisSchema } from '@/lib/ai-schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userContent, mode } = await req.json();

    if (!systemPrompt || !userContent) {
      return NextResponse.json({ error: 'systemPrompt and userContent are required' }, { status: 400 });
    }

    if (mode === 'agentic') {
      const systemPromptAgentic = `You are an expert SEO analyst agent with deep knowledge of:
- Google Search Console data analysis
- Industry CTR benchmarks by SERP position
- Google AI Overview eligibility criteria
- Keyword intent classification
- Content gap analysis and topic clustering
- CTR optimization through title/meta tag improvements

You analyze GSC data step-by-step and provide structured, actionable recommendations. Always cite the specific data points that support your analysis.`;

      const structured = await callAIValidated(systemPromptAgentic, userContent, AgenticAnalysisSchema);
      return NextResponse.json({ text: JSON.stringify(structured), structured });
    }

    // Standard AI call
    const text = await callMiniMaxRaw(systemPrompt, userContent);
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

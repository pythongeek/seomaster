import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { systemPrompt, userContent } = await req.json();

    if (!systemPrompt || !userContent) {
      return NextResponse.json({ error: 'systemPrompt and userContent are required' }, { status: 400 });
    }

    const BASE_URL = process.env.OPENROUTER_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://api.minimax.io/anthropic";
    const API_KEY = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || "";
    const MODEL = process.env.ANTHROPIC_MODEL || "MiniMax-M2.7";

    if (!API_KEY) {
      return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 });
    }

    const resp = await fetch(`${BASE_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        stream: false,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) {
      const error = await resp.text();
      return NextResponse.json({ error: `AI API error ${resp.status}: ${error}` }, { status: resp.status });
    }

    const data = await resp.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 });

    const text = data.content?.map((b: { text?: string }) => b.text || "").join("") || "";
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

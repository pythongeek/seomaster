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

    if (!API_KEY) {
      return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 });
    }

    // MiniMax API compatible format
    const resp = await fetch(`${BASE_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "MiniMax-M2.7",
        max_tokens: 4096,
        stream: false,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const responseText = await resp.text();

    if (!resp.ok) {
      // Try to parse error from response, handle nested JSON
      let errorMsg = `AI API error ${resp.status}: ${responseText}`;
      try {
        const parsed = JSON.parse(responseText);
        // Handle nested error format from MiniMax
        if (parsed.error?.error?.message) {
          errorMsg = parsed.error.error.message;
        } else if (parsed.error?.message) {
          errorMsg = parsed.error.message;
        } else if (parsed.error) {
          errorMsg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
        }
      } catch {
        // Use raw text as error message
      }
      return NextResponse.json({ error: errorMsg }, { status: resp.status });
    }

    const data = JSON.parse(responseText);
    if (data.error) {
      const msg = data.error?.error?.message || data.error?.message || JSON.stringify(data.error);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const text = data.content?.map((b: { text?: string }) => b.text || "").join("") || "";
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

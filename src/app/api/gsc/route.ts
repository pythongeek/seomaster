import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { siteUrl, startDate, endDate, dimensions, rowLimit } = await req.json();

    if (!siteUrl) {
      return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 });
    }

    if (siteUrl.length > 500 || (startDate && startDate.length > 20) || (endDate && endDate.length > 20)) {
      return NextResponse.json({ error: 'Invalid input length' }, { status: 400 });
    }

    const email = process.env.GSC_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GSC_SERVICE_ACCOUNT_KEY;

    if (!email || !key) {
      return NextResponse.json(
        { error: 'GSC Service Account not configured. Add GSC_SERVICE_ACCOUNT_EMAIL and GSC_SERVICE_ACCOUNT_KEY to Vercel env vars.' },
        { status: 500 }
      );
    }

    // Replace escaped newlines with real newlines (Vercel stores them as literal \n)
    const privateKey = key.replace(/\\n/g, '\n');

    // Create JWT client from service account credentials
    const client = new JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    // Get access token
    await client.authorize();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to obtain GSC access token. Check Service Account credentials.' }, { status: 500 });
    }

    // Call GSC API
    const gscResp = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate || '2025-01-01',
          endDate: endDate || '2025-04-01',
          dimensions: dimensions || ['query', 'page'],
          rowLimit: rowLimit || 5000,
        }),
      }
    );

    if (!gscResp.ok) {
      const error = await gscResp.text();
      return NextResponse.json({ error: `GSC API error ${gscResp.status}: ${error}` }, { status: gscResp.status });
    }

    const data = await gscResp.json();

    const rows = (data.rows || []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
      query: r.keys?.[0] || '',
      page: r.keys?.[1] || '',
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: (r.ctr || 0) * 100,
      position: r.position || 0,
    }));

    return NextResponse.json({ rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

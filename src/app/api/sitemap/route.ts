import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface SitemapResult {
  success: boolean;
  validated: boolean;
  sitemapUrl: string;
  validationStatus: number | null;
  validationMessage: string;
  pingStatus: number | null;
  pingMessage: string;
  pingedAt: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const { sitemapUrl } = await req.json() as { sitemapUrl: string };

    if (!sitemapUrl || typeof sitemapUrl !== 'string') {
      return NextResponse.json({ error: 'sitemapUrl is required' }, { status: 400 });
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sitemapUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid sitemap URL format' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are supported' }, { status: 400 });
    }

    const result: SitemapResult = {
      success: false,
      validated: false,
      sitemapUrl,
      validationStatus: null,
      validationMessage: '',
      pingStatus: null,
      pingMessage: '',
      pingedAt: null,
    };

    // Step 1: Validation — HEAD request to sitemap
    try {
      const validateResp = await fetch(sitemapUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'SEOMaster/1.0 (Crawl Budget Analyzer)',
          'Accept': 'application/xml, text/xml, application/xhtml+xml, text/html',
        },
        redirect: 'follow',
      });

      result.validationStatus = validateResp.status;

      if (validateResp.ok) {
        result.validated = true;
        result.validationMessage = `HTTP ${validateResp.status} — Sitemap is accessible and returns valid response.`;
      } else if (validateResp.status === 401 || validateResp.status === 403) {
        result.validationMessage = `HTTP ${validateResp.status} — Authentication required or access forbidden. Check sitemap permissions.`;
      } else if (validateResp.status === 404) {
        result.validationMessage = `HTTP 404 — Sitemap not found at ${sitemapUrl}. Verify the URL is correct and the file exists.`;
      } else {
        result.validationMessage = `HTTP ${validateResp.status} — Unexpected response. Sitemap may be inaccessible.`;
      }
    } catch (e) {
      result.validationStatus = null;
      result.validationMessage = `Network error: ${e instanceof Error ? e.message : 'Failed to reach sitemap URL'}. Check URL spelling and DNS resolution.`;
    }

    // Step 2: If valid, ping Google
    if (result.validated) {
      const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
      try {
        // Use no-cors mode to avoid CORS issues — Google doesn't respond with usable CORS headers
        await fetch(pingUrl, {
          method: 'GET',
          mode: 'no-cors',
          headers: {
            'User-Agent': 'SEOMaster/1.0',
          },
        });
        // With no-cors, we get a opaque response — treat as success if no error thrown
        result.pingStatus = 0;
        result.pingMessage = 'Ping sent to Google. Note: Google does not return a CORS-usable response for sitemap pings — check GSC to confirm update was processed.';
        result.pingedAt = new Date().toISOString();
      } catch (e) {
        result.pingStatus = null;
        result.pingMessage = `Ping failed: ${e instanceof Error ? e.message : 'Unknown error'}. You can manually submit via GSC.`;
      }
    }

    result.success = result.validated;

    return NextResponse.json({ result, reportTitle: `Sitemap Validation — ${sitemapUrl}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

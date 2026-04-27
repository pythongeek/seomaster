import { NextRequest, NextResponse } from 'next/server';
import { sql, saveReport, initDB } from '@/lib/db';

export const runtime = 'nodejs';

interface DiagnoseRequest {
  rawText: string;
}

interface IndexEntry {
  url: string;
  status: string;
  reason: string;
}

interface PatternGroup {
  pattern: string;
  patternLabel: string;
  count: number;
  urls: string[];
  diagnosis: string;
  resolution: string;
  priority: 'High' | 'Medium' | 'Low';
}

function parseRawText(rawText: string): IndexEntry[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const entries: IndexEntry[] = [];

  for (const line of lines) {
    // Try tab-separated first (typical GSC export)
    const tabParts = line.split('\t');
    if (tabParts.length >= 2) {
      const url = tabParts[0].trim();
      const status = tabParts[1].trim();
      if (url && status) {
        entries.push({ url, status, reason: status });
      }
      continue;
    }

    // Try comma-separated
    const commaParts = line.split(',');
    if (commaParts.length >= 2) {
      const url = commaParts[0].trim();
      const status = commaParts[1].trim();
      if (url && status) {
        entries.push({ url, status, reason: status });
      }
      continue;
    }

    // Try "URL | Reason" format
    const pipeMatch = line.match(/^(.+?)\s*[\|•]\s*(.+)$/);
    if (pipeMatch) {
      entries.push({ url: pipeMatch[1].trim(), status: pipeMatch[2].trim(), reason: pipeMatch[2].trim() });
      continue;
    }

    // Fallback: treat whole line as URL if it looks like one
    if (line.includes('http') || line.startsWith('/')) {
      entries.push({ url: line, status: 'Unknown', reason: 'Status not detected' });
    }
  }

  return entries;
}

function extractURLPattern(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://example.com${url}`);
    const path = u.pathname;
    const segments = path.split('/').filter(Boolean);

    if (segments.length === 0) return 'root';
    if (segments.length === 1) return `/${segments[0]}`;
    if (segments.length === 2) return `/${segments[0]}/${segments[1]}`;

    // Detect pagination, filters, faceted navigation
    if (/page=\d+/.test(u.search)) return `paginated:${segments[0]}`;
    if (/sort=|order=|filter=/i.test(u.search)) return `filtered:${segments[0]}`;
    if (/\?.*=/.test(u.search) && segments.length === 1) return `querystring:${segments[0]}`;
    if (/\d+/.test(segments[segments.length - 1]) && segments.length > 2) return `detail:${segments[0]}/${segments[1]}`;
    return `section:${segments[0]}/${segments[1]}`;
  } catch {
    return url.substring(0, 50);
  }
}

function classifyPattern(pattern: string): { label: string; diagnosis: string; resolution: string; priority: 'High' | 'Medium' | 'Low' } {
  if (pattern.startsWith('paginated:')) {
    return {
      label: 'Paginated Listing Pages',
      diagnosis: 'Googlebot detected paginated pages and chose not to index — likely thin content or crawl budget concerns from infinite pagination patterns.',
      resolution: 'Add <link rel="prev" rel="next"> tags and ensure each page has unique, valuable content. Consider adding noindex,follow on page 2+ if content is duplicative.',
      priority: 'Medium',
    };
  }
  if (pattern.startsWith('filtered:')) {
    return {
      label: 'Filtered/Sorted Views',
      diagnosis: 'Filtered URLs (sort, order, filter parameters) are not indexed — duplicate content signals or faceted navigation overwhelming crawl budget.',
      resolution: 'Add to robots.txt: Disallow: /*?*sort= Disallow: /*?*order= Disallow: /*?*filter= OR implement JavaScript-based filtering with pushState and noindex on parameter-based URLs.',
      priority: 'High',
    };
  }
  if (pattern.startsWith('detail:')) {
    return {
      label: 'Detail/Parameter Pages',
      diagnosis: 'Product/detail pages with tracking parameters are not indexed — URL parameters create duplicate content or Google sees them as session identifiers.',
      resolution: 'Implement canonical tags on all parameter variants pointing to clean URL. Add GSC URL parameter setting: "Googlebot should follow links and let me specify URL parameters to ignore."',
      priority: 'High',
    };
  }
  if (pattern.startsWith('querystring:')) {
    return {
      label: 'URLs with Query Strings',
      diagnosis: 'Dynamic URLs with query parameters are not indexed — these typically indicate tracking, session, or filter parameters that dilute crawl budget.',
      resolution: 'Remove tracking parameters (utm_*, fbclid, gclid) via GSC URL parameter settings. For filter params: add noindex meta tag or canonical pointing to base URL.',
      priority: 'High',
    };
  }
  if (pattern.startsWith('section:')) {
    return {
      label: 'Section/Category Pages',
      diagnosis: 'Non-indexed section pages — may indicate thin content, too few unique words, or pages deemed non-essential to site value.',
      resolution: 'Audit for thin content. Add unique intro text (100+ words) to each section landing page. Consider noindex if content is duplicated across sibling pages.',
      priority: 'Medium',
    };
  }
  if (pattern === 'root') {
    return {
      label: 'Root/Homepage',
      diagnosis: 'Root URL is not indexed — critical issue. Usually caused by incorrect robots.txt blocking, noindex meta tag, or canonical pointing elsewhere.',
      resolution: 'Check robots.txt does not block /. Verify page has no noindex meta tag. Check canonical tag does not point to different URL. Check XML sitemap includes root URL.',
      priority: 'High',
    };
  }
  return {
    label: pattern,
    diagnosis: 'Pattern analysis could not determine specific root cause. Manual audit recommended.',
    resolution: 'Review each URL individually in GSC. Check robots.txt, canonical tags, noindex meta tags, and XML sitemap inclusion.',
    priority: 'Medium',
  };
}

function diagnoseStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('crawled') && s.includes('not indexed')) return 'Crawled but excluded — Googlebot visited but chose not to index, usually due to thin/duplicate content or manual action.';
  if (s.includes('discovered')) return 'Discovered but not yet crawled — URL was found but Googlebot has not visited. Likely crawl budget issue or new URL.';
  if (s.includes('blocked')) return 'Blocked by robots.txt — URL cannot be crawled. Check if this is intentional or if the block should be removed.';
  if (s.includes('duplicate')) return 'Duplicate URL — another URL is considered canonical. Find the preferred URL and set redirect or canonical tag.';
  if (s.includes('not found')) return '404 Not Found — page no longer exists. Implement 410 Gone for permanent removals or restore content.';
  if (s.includes('soft 404')) return 'Soft 404 — page looks like a 404 but returns 200. Fix server to return actual 404 or redirect to relevant page.';
  if (s.includes('indexed')) return 'Already indexed — this entry may be redundant or the status changed since export.';
  if (s.includes('mobile')) return 'Mobile-specific issue — mobile page differs from desktop in ways that cause indexing problems.';
  if (s.includes('canonical')) return 'Canonical tag conflict — URL points to different canonical URL but both exist. Consolidate with redirect.';
  return 'Status requires manual investigation — cannot determine root cause from available data.';
}

function buildPatternGroups(entries: IndexEntry[]): PatternGroup[] {
  const patternMap: Record<string, IndexEntry[]> = {};

  entries.forEach(entry => {
    const pattern = extractURLPattern(entry.url);
    if (!patternMap[pattern]) patternMap[pattern] = [];
    patternMap[pattern].push(entry);
  });

  return Object.entries(patternMap)
    .map(([pattern, groupEntries]) => {
      const { label, diagnosis, resolution, priority } = classifyPattern(pattern);
      const firstReason = groupEntries[0]?.reason || '';
      const fullDiagnosis = firstReason && firstReason !== 'Unknown'
        ? `${diagnosis}\n\nStatus from GSC: "${firstReason}" — ${diagnoseStatus(firstReason)}`
        : diagnosis;

      return {
        pattern,
        patternLabel: label,
        count: groupEntries.length,
        urls: groupEntries.map(e => e.url),
        diagnosis: fullDiagnosis,
        resolution,
        priority: priority as 'High' | 'Medium' | 'Low',
      };
    })
    .sort((a, b) => {
      const pOrder = { High: 0, Medium: 1, Low: 2 };
      return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
    });
}

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const { rawText } = await req.json() as DiagnoseRequest;

    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json({ error: 'rawText is required and must be a string' }, { status: 400 });
    }

    const entries = parseRawText(rawText);
    if (entries.length === 0) {
      return NextResponse.json({ error: 'Could not parse any URLs from the provided text. Make sure it contains URL + status pairs (tab or comma separated).' }, { status: 400 });
    }

    const patternGroups = buildPatternGroups(entries);

    const totalUrls = entries.length;
    const uniquePatterns = patternGroups.length;
    const highPriority = patternGroups.filter(g => g.priority === 'High').length;
    const mediumPriority = patternGroups.filter(g => g.priority === 'Medium').length;

    const result = {
      totalUrls,
      uniquePatterns,
      patternGroups,
      executiveSummary: `Analysis of ${totalUrls} URLs identified ${uniquePatterns} distinct URL patterns requiring attention. ${highPriority > 0 ? `${highPriority} HIGH priority pattern(s) detected — these are likely causing significant indexation loss.` : ''} ${mediumPriority > 0 ? `${mediumPriority} MEDIUM priority pattern(s) need review.` : ''} Pattern-based diagnosis enables batch resolution rather than fixing URLs one-by-one.`,
      quickFixes: patternGroups
        .filter(g => g.priority === 'High')
        .slice(0, 3)
        .map(g => `[${g.priority}] ${g.patternLabel}: ${g.resolution.split('\n')[0]}`),
    };

    try {
      await saveReport({ report_type: 'index_diagnostic', title: `Index Diagnostic — ${uniquePatterns} patterns`, data: { rawText }, summary: { totalUrls, uniquePatterns, highPriority, mediumPriority } });
    } catch {}

    return NextResponse.json({ result, reportTitle: `Index Diagnostic — ${uniquePatterns} patterns` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

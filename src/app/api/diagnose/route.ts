import { NextRequest, NextResponse } from 'next/server';
import { initDB, saveReport } from '@/lib/db';

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
  statusBreakdown: string[];
  diagnosis: string;
  resolution: string;
  priority: 'P0 Critical' | 'P1 High' | 'P2 Medium' | 'P3 Low';
}

function parseRawText(rawText: string): IndexEntry[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  const entries: IndexEntry[] = [];
  for (const line of lines) {
    const tabParts = line.split('\t');
    if (tabParts.length >= 2) { entries.push({ url: tabParts[0].trim(), status: tabParts[1].trim(), reason: tabParts[1].trim() }); continue; }
    const commaParts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    if (commaParts.length >= 2) { entries.push({ url: commaParts[0].replace(/"/g,'').trim(), status: commaParts[1].replace(/"/g,'').trim(), reason: commaParts[1].replace(/"/g,'').trim() }); continue; }
    const pipeMatch = line.match(/^(.+?)\s*[|•]\s*(.+)$/);
    if (pipeMatch) { entries.push({ url: pipeMatch[1].trim(), status: pipeMatch[2].trim(), reason: pipeMatch[2].trim() }); continue; }
    if (/https?:\/\//.test(line)) entries.push({ url: line.trim(), status: 'Unknown', reason: 'Status not detected' });
  }
  return entries;
}

function urlPattern(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://example.com${url}`);
    const segs = u.pathname.split('/').filter(Boolean);
    if (u.search && /page=\d+/i.test(u.search)) return `paginated/${segs[0]||'root'}`;
    if (u.search && /sort=|order=|filter=/i.test(u.search)) return `filtered/${segs[0]||'root'}`;
    if (u.search && u.search.length > 1) return `query-string/${segs[0]||'root'}`;
    if (!segs.length) return 'root';
    if (segs.length === 1) return `top-level/${segs[0]}`;
    return `section/${segs[0]}/${segs[1]}`;
  } catch { return 'parse-error'; }
}

function patternDiagnosis(pattern: string): string {
  if (pattern.startsWith('paginated')) return 'Paginated pages with thin content — implement rel=prev/next or consolidate with noindex,follow';
  if (pattern.startsWith('filtered')) return 'Faceted navigation — use robots.txt Disallow for param URLs or add noindex to filter combinations';
  if (pattern.startsWith('query-string')) return 'URL parameters creating duplicate content — configure parameter handling in GSC or use canonical tags';
  if (pattern.startsWith('top-level')) return 'Top-level section pages — usually thin category/tag pages. Add unique intro content or noindex if no unique value.';
  if (pattern === 'root') return 'CRITICAL: Homepage not indexed. Check robots.txt, noindex tag, and canonical settings immediately.';
  if (pattern === 'parse-error') return 'URL could not be parsed — manual investigation required for these entries.';
  return 'Section pages — check for thin content, duplicate templates, or crawl budget constraints';
}

function diagnoseStatus(status: string): { rootCause: string; fix: string; priority: 'P0 Critical' | 'P1 High' | 'P2 Medium' | 'P3 Low' } {
  const s = status.toLowerCase();
  if (s.includes('crawled') && (s.includes('not indexed') || s.includes('currently')))
    return { rootCause: 'Thin/duplicate content or manual action — Googlebot visited but excluded page from index', fix: 'Audit content quality: add ≥300 words of unique value, remove near-duplicate sections. Add internal links from high-authority pages. Check manual actions in GSC.', priority: 'P1 High' };
  if (s.includes('discovered') && !s.includes('crawled'))
    return { rootCause: 'Crawl budget exhaustion — Googlebot found the URL but hasn\'t visited yet', fix: 'Submit URL via GSC URL Inspection. Add page to XML sitemap with <lastmod>. Strengthen internal links from crawled pages to this URL.', priority: 'P2 Medium' };
  if (s.includes('blocked') || s.includes('robots'))
    return { rootCause: 'robots.txt blocking — Googlebot cannot access this URL', fix: 'Check robots.txt Disallow rules. If blocking is unintentional, remove the rule. Verify with robots.txt tester in GSC.', priority: 'P0 Critical' };
  if (s.includes('duplicate') || s.includes('canonical'))
    return { rootCause: 'Duplicate URL — Google chose a different canonical URL as the index target', fix: 'Add <link rel="canonical" href="[preferred-url]"> to the non-canonical version. Or implement a 301 redirect to the canonical URL.', priority: 'P1 High' };
  if (s.includes('404') || s.includes('not found'))
    return { rootCause: '404 Not Found — page no longer exists', fix: 'Return 410 Gone for permanent removals. For moved content: 301 redirect to the new URL. Update all internal links pointing here.', priority: 'P1 High' };
  if (s.includes('soft 404'))
    return { rootCause: 'Soft 404 — page returns 200 but appears empty/useless to Googlebot', fix: 'Fix server to return actual 404 status code, or add meaningful content to the page. Remove noindex and let Googlebot assess genuine value.', priority: 'P2 Medium' };
  if (s.includes('redirect'))
    return { rootCause: 'Redirect loop or excessive redirect chain', fix: 'Map all redirects in this chain. Ensure A→B redirects resolve in ≤2 hops. Use 301 for permanent, 302 only for temporary moves.', priority: 'P2 Medium' };
  if (s.includes('noindex'))
    return { rootCause: 'noindex tag present — intentionally excluded from index', fix: 'If exclusion is unintentional, remove the noindex meta tag or X-Robots-Tag header. If intentional, this URL is working as designed.', priority: 'P3 Low' };
  return { rootCause: 'Unknown status — manual investigation required', fix: 'Use GSC URL Inspection tool to get the exact current status. Check server response headers and page source for noindex or canonical signals.', priority: 'P3 Low' };
}

function buildPatternGroups(entries: IndexEntry[]): PatternGroup[] {
  const patternMap: Record<string, IndexEntry[]> = {};
  for (const e of entries) {
    const pat = urlPattern(e.url);
    if (!patternMap[pat]) patternMap[pat] = [];
    patternMap[pat].push(e);
  }

  return Object.entries(patternMap)
    .map(([pattern, groupEntries]) => {
      const priorities = groupEntries.map(e => diagnoseStatus(e.status).priority);
      const topPriority = (priorities.includes('P0 Critical') ? 'P0 Critical' :
        priorities.includes('P1 High') ? 'P1 High' :
        priorities.includes('P2 Medium') ? 'P2 Medium' : 'P3 Low') as 'P0 Critical' | 'P1 High' | 'P2 Medium' | 'P3 Low';
      const firstDiagnosis = diagnoseStatus(groupEntries[0].status);
      return {
        pattern,
        patternLabel: pattern.replace('/', ' → '),
        count: groupEntries.length,
        urls: groupEntries.map(i => i.url),
        statusBreakdown: [...new Set(groupEntries.map(i => i.status))].slice(0, 3),
        diagnosis: `${patternDiagnosis(pattern)}\n\nRoot cause: ${firstDiagnosis.rootCause}`,
        resolution: firstDiagnosis.fix,
        priority: topPriority,
      };
    })
    .sort((a, b) => {
      const order: Record<string, number> = { 'P0 Critical': 0, 'P1 High': 1, 'P2 Medium': 2, 'P3 Low': 3 };
      return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
    });
}

export async function POST(req: NextRequest) {
  try {
    await initDB();
    const { rawText } = await req.json() as DiagnoseRequest;
    if (!rawText || typeof rawText !== 'string') return NextResponse.json({ error: 'rawText required' }, { status: 400 });

    const entries = parseRawText(rawText);
    if (entries.length === 0) return NextResponse.json({ error: 'No URL/status pairs found. Paste tab- or comma-separated data from GSC indexation report.' }, { status: 400 });

    const patternGroups = buildPatternGroups(entries);
    const highCount = patternGroups.filter(g => g.priority === 'P0 Critical' || g.priority === 'P1 High').length;
    const criticalCount = patternGroups.filter(g => g.priority === 'P0 Critical').length;

    const result = {
      totalUrls: entries.length,
      uniquePatterns: patternGroups.length,
      patternGroups,
      severitySummary: {
        label: criticalCount > 0 ? 'CRITICAL' : highCount > 0 ? 'ATTENTION NEEDED' : 'HEALTHY',
        count: criticalCount || highCount || 0,
        color: criticalCount > 0 ? '#EF4444' : highCount > 0 ? '#F59E0B' : '#10B981',
      },
      executiveSummary: `${entries.length} non-indexed URLs grouped into ${patternGroups.length} URL patterns. ${criticalCount > 0 ? `${criticalCount} CRITICAL pattern(s) require immediate action. ` : ''}${highCount > 0 ? `${highCount} high-priority pattern(s) need attention. ` : ''}Pattern-based fixes enable batch resolution.`,
      quickFixes: patternGroups.filter(g => g.priority === 'P0 Critical' || g.priority === 'P1 High').slice(0, 3).map(g => `[${g.priority}] ${g.patternLabel} (${g.count} URLs): ${g.resolution.split('\n')[0]}`),
    };

    try { await saveReport({ report_type: 'index_diagnostic', title: `Index Diagnostic — ${entries.length} URLs, ${patternGroups.length} patterns`, data: { rawText: rawText.slice(0, 500) }, summary: { totalUrls: entries.length, uniquePatterns: patternGroups.length, highCount } }); } catch {}

    return NextResponse.json({ result, reportTitle: `Index Diagnostic — ${patternGroups.length} patterns` });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
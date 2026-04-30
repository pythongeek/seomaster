import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

interface StatusGroup { code: string; pct: number; status: 'Healthy'|'Warning'|'Critical'; recommendation: string; }
interface FileGroup { type: string; pct: number; status: 'Healthy'|'Warning'|'Critical'; recommendation: string; }
interface PurposeGroup { purpose: string; pct: number; status: 'Healthy'|'Warning'|'Critical'; recommendation: string; }

function parsePercents(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const rx = /([\w\s\-\/]+?)\s*[:\-—]\s*(\d+(?:\.\d+)?)\s*%/gi;
  let m;
  while ((m = rx.exec(text)) !== null) {
    const key = m[1].trim().toLowerCase();
    out[key] = parseFloat(m[2]);
  }
  return out;
}

function analyseStatusCodes(data: Record<string, number>): StatusGroup[] {
  const groups: StatusGroup[] = [];
  for (const [key, pct] of Object.entries(data)) {
    if (/2[0-9]{2}/.test(key) || key.includes('200') || key.includes('ok')) {
      groups.push({ code: '2xx OK', pct, status: pct < 70 ? 'Warning' : 'Healthy', recommendation: pct < 70 ? `Only ${pct}% success responses — investigate what is causing non-2xx responses` : 'Healthy response rate' });
    } else if (key.includes('301') || key.includes('302') || key.includes('redirect')) {
      groups.push({ code: key.includes('302') ? '302 Redirect' : '301 Redirect', pct, status: pct > 15 ? 'Critical' : pct > 8 ? 'Warning' : 'Healthy', recommendation: pct > 15 ? `${pct}% redirects is excessive — audit chains, update internal links to point directly to destination URLs` : pct > 8 ? `Elevated redirect rate (${pct}%) — check for redirect chains > 2 hops` : 'Normal redirect rate' });
    } else if (key.includes('304') || key.includes('not modified')) {
      groups.push({ code: '304 Not Modified', pct, status: 'Healthy', recommendation: 'Cache headers working correctly — Googlebot uses etags/last-modified efficiently' });
    } else if (key.includes('404') || key.includes('not found')) {
      groups.push({ code: '404 Not Found', pct, status: pct > 5 ? 'Critical' : pct > 2 ? 'Warning' : 'Healthy', recommendation: pct > 5 ? `${pct}% 404s is critically high. Implement 410 for permanent removals. Audit all internal links. Set up custom 404 page with site navigation.` : `Monitor 404 rate. Set up 404→relevant redirect for top broken URLs` });
    } else if (/5[0-9]{2}/.test(key) || key.includes('server error') || key.includes('5xx')) {
      groups.push({ code: '5xx Server Error', pct, status: pct > 0 ? 'Critical' : 'Healthy', recommendation: pct > 0 ? `${pct}% 5xx errors — Googlebot WILL reduce crawl rate. Check error logs immediately. Scale capacity, fix slow endpoints, check DB connections.` : 'No server errors' });
    }
  }
  return groups;
}

function analyseFileTypes(data: Record<string, number>): FileGroup[] {
  const groups: FileGroup[] = [];
  for (const [key, pct] of Object.entries(data)) {
    const type = key.includes('html') ? 'HTML' : key.includes('js') || key.includes('javascript') ? 'JavaScript' : key.includes('css') ? 'CSS' : key.includes('image') || key.includes('jpeg') || key.includes('png') || key.includes('webp') ? 'Images' : key.includes('json') ? 'JSON' : key.includes('pdf') ? 'PDF' : key.includes('xml') ? 'XML' : null;
    if (!type) continue;
    let status: 'Healthy'|'Warning'|'Critical' = 'Healthy';
    let recommendation = '';
    if (type === 'HTML') { status = pct < 40 ? 'Warning' : 'Healthy'; recommendation = pct < 40 ? `HTML crawl share (${pct}%) is low — non-HTML assets consuming disproportionate budget` : `HTML dominates crawl — good signal of content-focused site architecture`; }
    else if (type === 'JavaScript') { status = pct > 25 ? 'Critical' : pct > 15 ? 'Warning' : 'Healthy'; recommendation = pct > 25 ? `${pct}% JS crawl is severely high. Add to nginx: \`location ~* \\.js$ { expires 1y; add_header Cache-Control "public,immutable"; }\`. Consider disallowing JS in robots.txt if not needed for rendering.` : pct > 15 ? `JS at ${pct}% — implement cache-control: max-age=31536000 for versioned bundles` : `JS crawl share is acceptable`; }
    else if (type === 'CSS') { status = pct > 15 ? 'Warning' : 'Healthy'; recommendation = pct > 15 ? `CSS consuming ${pct}% of crawl budget. Add cache headers: \`Cache-Control: public, max-age=31536000\`. Consider disallowing CSS in robots.txt.` : `CSS share is acceptable`; }
    else if (type === 'Images') { status = pct > 35 ? 'Warning' : 'Healthy'; recommendation = pct > 35 ? `Images at ${pct}% — implement lazy loading (loading="lazy"), convert to WebP, add Cache-Control: max-age=31536000` : `Image crawl share is normal`; }
    else if (type === 'JSON') { status = pct > 10 ? 'Warning' : 'Healthy'; recommendation = pct > 10 ? `JSON endpoints consuming crawl budget (${pct}%). Add X-Robots-Tag: noindex to API responses, or add cache headers to reduce repeat crawling` : `JSON crawl share is acceptable`; }
    else { status = 'Warning'; recommendation = `${type} files consuming ${pct}% of budget — add cache headers and consider disallowing in robots.txt if not essential`; }
    groups.push({ type, pct, status, recommendation });
  }
  return groups;
}

function analyseCrawlPurpose(data: Record<string, number>): PurposeGroup[] {
  const groups: PurposeGroup[] = [];
  for (const [key, pct] of Object.entries(data)) {
    const purpose = key.includes('discover') ? 'Discovery' : key.includes('refresh') || key.includes('re-crawl') ? 'Refresh' : key.includes('click') ? 'Click Tracking' : null;
    if (!purpose) continue;
    let status: 'Healthy'|'Warning'|'Critical' = 'Healthy';
    let recommendation = '';
    if (purpose === 'Discovery') {
      status = pct < 5 ? 'Critical' : pct < 12 ? 'Warning' : 'Healthy';
      recommendation = pct < 5 ? `Discovery at ${pct}% — Googlebot cannot find new content. Submit XML sitemap immediately. Audit internal linking — new pages must be 1-3 clicks from homepage.` : pct < 12 ? `Low discovery (${pct}%) — refresh XML sitemap, improve internal linking to new content, check sitemap is submitted in GSC` : `Discovery crawl is healthy`;
    } else if (purpose === 'Refresh') {
      status = pct > 85 ? 'Warning' : 'Healthy';
      recommendation = pct > 85 ? `Very high refresh rate (${pct}%) — Googlebot re-crawling existing content excessively. Implement lastmod dates in XML sitemap. Review content freshness strategy.` : `Refresh ratio is normal`;
    } else {
      status = 'Healthy';
      recommendation = `Click tracking at ${pct}% — normal user behaviour signal collection`;
    }
    groups.push({ purpose, pct, status, recommendation });
  }
  return groups;
}

export async function POST(req: NextRequest) {
  try {
    const { crawlStatsText } = await req.json();
    if (!crawlStatsText) return NextResponse.json({ error: 'crawlStatsText required' }, { status: 400 });

    const parsed = parsePercents(crawlStatsText);
    const statusGroups = analyseStatusCodes(parsed);
    const fileGroups = analyseFileTypes(parsed);
    const purposeGroups = analyseCrawlPurpose(parsed);

    const criticalCount = [...statusGroups, ...fileGroups, ...purposeGroups].filter(g => g.status === 'Critical').length;
    const warningCount = [...statusGroups, ...fileGroups, ...purposeGroups].filter(g => g.status === 'Warning').length;
    const severitySummary = {
      label: criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'ATTENTION NEEDED' : 'HEALTHY',
      count: criticalCount || warningCount || 0,
      color: criticalCount > 0 ? '#EF4444' : warningCount > 0 ? '#F59E0B' : '#10B981',
    };

    const issues = [
      ...statusGroups.filter(g => g.status !== 'Healthy').map(g => ({
        category: 'HTTP Status Codes', severity: g.status as 'Critical'|'Warning',
        description: `${g.code}: ${g.pct}%`, fix: g.recommendation,
        devOpsChecklist: g.code.includes('5xx') ? ['Check error logs: `tail -f /var/log/nginx/error.log`','Verify DB connection pool is not exhausted','Check application memory and CPU usage','Set up alerting for 5xx rate > 0.1%']
          : g.code.includes('404') ? ['Audit internal links: find all links to 404 pages','Implement custom 404.html with search and popular pages','Set up 301 redirects for removed pages that have inbound links','Use 410 Gone for intentional permanent removals']
          : ['Audit redirect chains: ensure max 1 hop A→B','Update internal links to point directly to destination','Check for redirect loops using `curl -IL [url]`'],
      })),
      ...purposeGroups.filter(g => g.status !== 'Healthy').map(g => ({
        category: 'Crawl Purpose', severity: g.status as 'Critical'|'Warning',
        description: `${g.purpose}: ${g.pct}%`, fix: g.recommendation,
        devOpsChecklist: g.purpose === 'Discovery' ? ['Submit sitemap at: https://search.google.com/search-console/sitemaps','Audit sitemap for missing pages: `curl -s domain.com/sitemap.xml | grep -c "<loc>"`','Check robots.txt is not blocking important sections','Improve internal linking from homepage to new content'] : ['Review XML sitemap lastmod accuracy','Consider reducing crawl rate in GSC settings if server strain detected','Prioritise high-value pages in sitemap by listing them first'],
      })),
      ...fileGroups.filter(g => g.status !== 'Healthy').map(g => ({
        category: 'Crawl Budget Waste', severity: g.status as 'Critical'|'Warning',
        description: `${g.type}: ${g.pct}% of crawl`, fix: g.recommendation,
        devOpsChecklist: g.type === 'JavaScript' || g.type === 'CSS' ? ['Add cache headers in nginx: `expires 1y; add_header Cache-Control "public,immutable";`','Consider adding to robots.txt: `Disallow: /*.js$` (if not needed for rendering)','Enable HTTP/2 to reduce connection overhead for multiple JS/CSS files'] : ['Add lazy loading to images below the fold','Convert images to WebP format for better compression','Add Cache-Control: max-age=31536000 for static images'],
      })),
    ];

    const executiveSummary = `Crawl analysis: ${criticalCount} critical + ${warningCount} warning signals detected. `
      + (statusGroups.find(g => g.code.includes('5xx'))?.pct ? `Server errors present (${statusGroups.find(g=>g.code.includes('5xx'))?.pct}%) — will reduce Googlebot crawl rate. ` : '')
      + (purposeGroups.find(g => g.purpose === 'Discovery')?.pct ? `Discovery crawl: ${purposeGroups.find(g=>g.purpose==='Discovery')?.pct}%. ` : '')
      + `${issues.length} actionable fixes identified.`;

    return NextResponse.json({ result: { statusGroups, fileGroups, purposeGroups, issues, severitySummary, executiveSummary } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
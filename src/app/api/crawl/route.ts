import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface DiagnoseRequest {
  crawlStatsText: string;
}

interface StatusCodeGroup {
  code: string;
  percentage: number;
  count: number;
  status: 'Healthy' | 'Warning' | 'Critical';
  recommendation: string;
}

interface FileTypeGroup {
  type: string;
  percentage: number;
  bytes: number;
  status: 'Healthy' | 'Waste' | 'Critical';
  recommendation: string;
}

interface PurposeGroup {
  purpose: string;
  percentage: number;
  status: 'Healthy' | 'Warning' | 'Critical';
  recommendation: string;
}

interface CrawlIssue {
  category: string;
  severity: 'High' | 'Medium' | 'Low';
  description: string;
  fix: string;
  devOpsChecklist?: string[];
}

function parseStatusCodePercents(text: string): StatusCodeGroup[] {
  const groups: StatusCodeGroup[] = [];
  // Match patterns like "404 Not Found — 2.5%" or "200 OK — 85.0%"
  const statusMatches = text.matchAll(/(\d{3})\s+(?:OK|Not Found|Found|Moved Permanently|Server Error|Bad Request|Forbidde|Timed Out|[^\s—]+)\s*[—\-]\s*(\d+(?:\.\d+)?)%/gi);
  for (const match of statusMatches) {
    const code = match[1];
    const pct = parseFloat(match[2]);
    let status: 'Healthy' | 'Warning' | 'Critical' = 'Healthy';
    let recommendation = 'No action needed.';

    if (code.startsWith('2')) {
      status = 'Healthy';
      recommendation = 'Healthy response rate. Monitor for any sudden drops.';
    } else if (code === '301' || code === '302') {
      status = pct > 10 ? 'Warning' : 'Healthy';
      recommendation = pct > 10
        ? `Excessive redirect rate (${pct}%). Audit redirect chains — each redirect adds latency and consumes crawl budget. Use 301 for permanent moves, 302 only for temporary. Consolidate chained redirects.`
        : 'Normal redirect rate. Ensure no redirect loops.';
    } else if (code === '304') {
      status = 'Healthy';
      recommendation = 'Not Modified responses are efficient — Googlebot is using cached content.';
    } else if (code === '404' || code === '410') {
      status = pct > 5 ? 'Critical' : pct > 2 ? 'Warning' : 'Healthy';
      recommendation = pct > 5
        ? `High 404/410 rate (${pct}%). Set up 404.html with helpful navigation. Use 410 Gone for permanent removals. Audit internal links pointing to dead URLs.`
        : `Monitor 404 rate. Implement custom 404 with search and popular links.`;
    } else if (code.startsWith('5')) {
      status = 'Critical';
      recommendation = `5xx errors detected (${pct}%). This directly impacts crawling. Check server logs for errors. Scale capacity or optimize slow endpoints immediately.`;
    } else if (code === '403') {
      status = 'Warning';
      recommendation = 'Forbidden responses may indicate access restrictions blocking Googlebot. Verify robots.txt is not blocking needed resources.';
    } else {
      status = 'Warning';
      recommendation = `Unexpected status code ${code}. Investigate server configuration.`;
    }

    groups.push({ code, percentage: pct, count: 0, status, recommendation });
  }
  return groups;
}

function parseFileTypeBreakdown(text: string): FileTypeGroup[] {
  const groups: FileTypeGroup[] = [];
  const typeMatches = text.matchAll(/(HTML|HTM|PHP|ASPX|JSON|XML|JS|CSS|Images?|JPEG|PNG|GIF|WebP|SVG|PDF| DOC| TXT| ZIP| Other)\s*[—\-]\s*(\d+(?:\.\d+)?)%/gi);
  for (const match of typeMatches) {
    const type = match[1].trim();
    const pct = parseFloat(match[2]);
    let status: 'Healthy' | 'Waste' | 'Critical' = 'Healthy';
    let recommendation = 'Normal resource consumption.';

    if (['JS', 'CSS'].includes(type)) {
      status = pct > 30 ? 'Waste' : 'Healthy';
      recommendation = pct > 30
        ? `High JS/CSS crawl ratio (${pct}%). Implement cache-control: max-age=31536000 for versioned assets. Use <link rel="preload"> for critical JS. Minify and combine where possible.`
        : 'JS/CSS ratio is normal. Ensure cache headers are set for assets.';
    } else if (['JSON', 'XML'].includes(type)) {
      status = pct > 15 ? 'Waste' : 'Healthy';
      recommendation = pct > 15
        ? `Excessive JSON/XML crawling (${pct}%). Audit API endpoints Googlebot hits. Add cache headers or noindex on low-value JSON endpoints.`
        : 'JSON/XML consumption is normal.';
    } else if (['Images?', 'JPEG', 'PNG', 'GIF', 'WebP', 'SVG'].some(t => type.includes(t))) {
      status = pct > 40 ? 'Waste' : 'Healthy';
      recommendation = pct > 40
        ? `High image crawling ratio (${pct}%). Implement lazy loading. Use WebP format. Add cache headers to reduce repeat crawling of unchanged images.`
        : 'Image crawl ratio is normal. Continue optimizing with modern formats.';
    } else if (['PDF', 'DOC', 'ZIP'].some(t => type.includes(t))) {
      status = 'Waste';
      recommendation = `Non-HTML resource crawling (${pct}%). Ensure these files are not consuming disproportionate crawl budget. Add Content-Type headers and cache directives.`;
    } else {
      status = pct > 60 ? 'Healthy' : 'Healthy';
      recommendation = 'HTML content dominates crawling — good signal of content-focused site.';
    }

    groups.push({ type, percentage: pct, bytes: 0, status, recommendation });
  }
  return groups;
}

function parseCrawlPurpose(text: string): PurposeGroup[] {
  const groups: PurposeGroup[] = [];
  const purposeMatches = text.matchAll(/(Discovery|Refresh|Click tracking|Indexed|URL submission|Site-move)\s*[—\-]\s*(\d+(?:\.\d+)?)%/gi);
  for (const match of purposeMatches) {
    const purpose = match[1].trim();
    const pct = parseFloat(match[2]);
    let status: 'Healthy' | 'Warning' | 'Critical' = 'Healthy';
    let recommendation = 'Normal crawl purpose distribution.';

    if (purpose === 'Discovery') {
      status = pct < 5 ? 'Critical' : pct < 15 ? 'Warning' : 'Healthy';
      recommendation = pct < 5
        ? `Discovery crawl is extremely low (${pct}%). Your XML sitemap may be missing or outdated. Check sitemap is submitted in GSC. Audit internal linking — Googlebot cannot discover new pages.`
        : pct < 15
          ? `Discovery crawl is low (${pct}%). Submit/refresh XML sitemap. Improve internal linking to new content.`
          : 'Discovery crawl is healthy. Googlebot is finding new content regularly.';
    } else if (purpose === 'Refresh') {
      status = pct > 60 ? 'Critical' : pct > 40 ? 'Warning' : 'Healthy';
      recommendation = pct > 60
        ? `Excessive refresh crawling (${pct}%). Googlebot is spending too much time re-indexing existing pages instead of discovering new ones. Improve content freshness signals to reduce refresh frequency.`
        : pct > 40
          ? `High refresh crawl (${pct}%). Consider adding lastmod dates to XML sitemap. Improve change frequency signals in content.`
          : 'Refresh crawl ratio is healthy.';
    } else if (purpose === 'Click tracking') {
      status = pct > 20 ? 'Warning' : 'Healthy';
      recommendation = pct > 20 ? `High click tracking ratio (${pct}%) — usually normal but confirm no anomalous behavior.` : 'Normal click tracking ratio.';
    } else {
      status = 'Healthy';
      recommendation = `Crawl purpose ${purpose} is within normal parameters.`;
    }

    groups.push({ purpose, percentage: pct, status, recommendation });
  }
  return groups;
}

function buildCrawlIssues(statusGroups: StatusCodeGroup[], purposeGroups: PurposeGroup[], fileGroups: FileTypeGroup[]): CrawlIssue[] {
  const issues: CrawlIssue[] = [];

  // Status code issues
  statusGroups.filter(g => g.status !== 'Healthy').forEach(g => {
    issues.push({
      category: 'HTTP Status Codes',
      severity: g.status === 'Critical' ? 'High' : 'Medium',
      description: `HTTP ${g.code} at ${g.percentage}% — ${g.status === 'Critical' ? 'CRITICAL issue' : 'warning'}`,
      fix: g.recommendation,
      devOpsChecklist: g.code.startsWith('5') ? [
        'Check server error logs for root cause',
        'Identify failing endpoints: `grep " 500 " /var/log/nginx/access.log`',
        'Scale server capacity or optimize slow endpoints',
        'Set up alerting for 5xx error rate > 1%',
      ] : g.code === '404' || g.code === '410' ? [
        'Audit all internal links: `awk NF /var/log/nginx/access.log | grep 404`',
        'Set up custom 404.html with search and popular links',
        'For 410 Gone: confirm intentional permanent removal',
        'Redirect removed URLs to relevant live pages where possible',
      ] : g.code === '301' || g.code === '302' ? [
        'Map all redirects: `nginx -T | grep rewrite`',
        'Eliminate chains: ensure A→B→C becomes A→C',
        'Use 301 for permanent moves, 302 for temporary',
        'Update internal links to point directly to destination',
      ] : [
        'Investigate server configuration for HTTP ' + g.code,
        'Verify robots.txt is correctly configured',
        'Check CloudFlare/CDN settings if applicable',
      ],
    });
  });

  // Purpose issues
  purposeGroups.filter(g => g.status !== 'Healthy').forEach(g => {
    issues.push({
      category: 'Crawl Purpose Distribution',
      severity: g.status === 'Critical' ? 'High' : 'Medium',
      description: `${g.purpose} crawl at ${g.percentage}% — ${g.status === 'Critical' ? 'CRITICAL' : 'warning'}`,
      fix: g.recommendation,
      devOpsChecklist: g.purpose === 'Discovery' ? [
        'Submit XML sitemap to Google Search Console',
        'Audit sitemap for missing new pages: `curl -s domain.com/sitemap.xml | grep "<loc>"`',
        'Improve internal linking structure',
        'Add new pages to XML sitemap with lastmod dates',
        'Check robots.txt is not blocking crawl of important sections',
      ] : g.purpose === 'Refresh' ? [
        'Review content freshness signals (structured data dateModified)',
        'Update XML sitemap with accurate lastmod dates',
        'Optimize CMS to reduce unnecessary re-crawl of unchanged pages',
        'Consider using Google Search Console "URL inspection" for important pages',
      ] : [
        'Review Google Search Console crawl reports',
        'Monitor crawl stats weekly for pattern changes',
      ],
    });
  });

  // File type waste
  fileGroups.filter(g => g.status !== 'Healthy').forEach(g => {
    issues.push({
      category: 'Crawl Budget Waste',
      severity: g.status === 'Critical' ? 'High' : 'Medium',
      description: `${g.type} files consuming ${g.percentage}% of crawl budget — ${g.status === 'Critical' ? 'HIGH waste' : 'waste detected'}`,
      fix: g.recommendation,
      devOpsChecklist: ['JS', 'CSS'].includes(g.type) ? [
        'Add to nginx.conf: `location ~* \\.(js|css)$ { expires 1y; add_header Cache-Control "public, immutable"; }`',
        'Enable HTTP/2 server push for critical JS',
        'Minify and concatenate JS/CSS files',
        'Use Cloudflare Workers or CDN for asset caching',
      ] : ['JSON', 'XML'].includes(g.type) ? [
        'Audit which JSON endpoints Googlebot is crawling',
        'Add noindex to low-value API responses: `X-Robots-Tag: noindex`',
        'Implement cache headers for API responses',
      ] : [
        'Implement lazy loading for images',
        'Convert images to WebP format',
        'Add cache headers: `expires 1y` for unchanged images',
        'Use responsive images to reduce data transfer',
      ],
    });
  });

  // General high-level checklist
  issues.push({
    category: 'Crawl Budget Optimization',
    severity: 'Medium',
    description: 'General crawl budget optimization checklist',
    fix: 'Implement these server and CDN optimizations to maximize Googlebot efficiency.',
    devOpsChecklist: [
      'Enable gzip/brotli compression for all text-based resources',
      'Set cache headers: HTML (5 min), CSS/JS (1 year with versioned filenames), Images (1 year)',
      'Audit robots.txt — ensure no important sections are accidentally blocked',
      'Submit XML sitemap and monitor for errors in GSC',
      'Use Cloudflare or CDN for static asset caching',
      'Set up Vary: Accept-Encoding for compressed responses',
      'Implement HTTP/2 for multiplexed connections',
      'Monitor server response times — target < 200ms for HTML',
      'Use lastmod dates in XML sitemap for large sites',
    ],
  });

  return issues;
}

function classifySeverity(issues: CrawlIssue[]): { label: string; count: number; color: string } {
  const high = issues.filter(i => i.severity === 'High').length;
  const medium = issues.filter(i => i.severity === 'Medium').length;
  return { label: high > 0 ? 'CRITICAL' : medium > 0 ? 'ATTENTION NEEDED' : 'HEALTHY', count: high || medium || 0, color: high > 0 ? '#EF4444' : medium > 0 ? '#F59E0B' : '#10B981' };
}

export async function POST(req: NextRequest) {
  try {
    const { crawlStatsText } = await req.json() as DiagnoseRequest;

    if (!crawlStatsText || typeof crawlStatsText !== 'string') {
      return NextResponse.json({ error: 'crawlStatsText is required' }, { status: 400 });
    }

    const statusGroups = parseStatusCodePercents(crawlStatsText);
    const fileGroups = parseFileTypeBreakdown(crawlStatsText);
    const purposeGroups = parseCrawlPurpose(crawlStatsText);
    const issues = buildCrawlIssues(statusGroups, purposeGroups, fileGroups);
    const severitySummary = classifySeverity(issues);

    const result = {
      statusGroups,
      fileGroups,
      purposeGroups,
      issues,
      severitySummary,
      executiveSummary: `Crawl analysis found ${issues.length} issue(s): ${issues.filter(i => i.severity === 'High').length} HIGH severity, ${issues.filter(i => i.severity === 'Medium').length} MEDIUM severity. ${statusGroups.filter(s => s.code.startsWith('2')).reduce((s, g) => s + g.percentage, 0)}% healthy 2xx responses. Discovery crawl at ${purposeGroups.find(p => p.purpose === 'Discovery')?.percentage || 0}%. ${fileGroups.find(f => ['JS', 'CSS'].includes(f.type))?.percentage ? `JS/CSS consuming ${fileGroups.find(f => ['JS', 'CSS'].includes(f.type))?.percentage}% of crawl.` : ''}`,
    };

    return NextResponse.json({ result, reportTitle: `Crawl Analysis — ${severitySummary.label}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

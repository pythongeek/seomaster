export type KeywordIntent = 'transactional' | 'informational' | 'navigational' | 'commercial' | 'local' | 'unknown';

export interface KeywordAnalysis {
  query: string;
  intent: KeywordIntent;
  isLocal: boolean;
  isTransactional: boolean;
  isInformational: boolean;
}

export interface CannibalizationEntry {
  query: string;
  severity: 'Critical' | 'Warning' | 'Minor';
  totalImpressions: number;
  totalClicks: number;
  pageCount: number;
  pages: Array<{
    page: string;
    impressions: number;
    clicks: number;
    position: number;
  }>;
  recommendation: string;
}

export interface RankChangeEntry {
  query: string;
  currentPosition: number;
  previousPosition: number;
  change: number;
  direction: 'improved' | 'declined';
  impressions: number;
}

export interface KeywordDropEntry {
  query: string;
  currentPosition: number;
  previousPosition: number;
  positionDelta: number;
  impressions: number;
  isSignificant: boolean;
}

const TRANSACTIONAL_PATTERNS = [
  /\b(buy|purchase|order|shop|checkout|cart|add to cart|price|pricing|cost|afford)\b/i,
  /\b(discount|deal|offer|sale| clearance|cheap|bargain|promo)\b/i,
  /\b(subscribe|subscription|plan|premium|membership|license|buy now)\b/i,
  /\b(rent|lease|financing|Financing|payment plan)\b/i,
  /\b(where to buy|how to buy|buy near|store near me)\b/i,
];

const INFORMATIONAL_PATTERNS = [
  /\b(how to|what is|what are|why does|guide|tutorial|learn|explain)\b/i,
  /\b(tips|tricks|best practices|strategy|strategy|approach)\b/i,
  /\b(review|vs|comparison|versus|alternative|代替)\b/i,
  /\b(difference|vs|versus|comparing|compared to)\b/i,
  /\b(meaning|definition|define|example|understand)\b/i,
  /\b(how do i|can i|should i|is it|are there)\b/i,
];

const NAVIGATIONAL_PATTERNS = [
  /\b(login|signin|sign in|log in|account|profile|settings)\b/i,
  /\b(contact us|about us|home|homepage|main page)\b/i,
  /\b(portal|dashboard|my account|customer service)\b/i,
];

const LOCAL_PATTERNS = [
  /\b(near me|nearby|closest|local|临近|in [city name])\b/i,
  /\b([A-Z][a-z]+ )+(store|shop|restaurant|cafe|bar|clinic|doctor|lawyer|plumber| electrician| HVAC)\b/i,
  /\b(New York|Los Angeles|Chicago|Houston|Phoenix|Philadelphia|San Antonio|San Diego|Dallas|San Jose| Austin|Jacksonville| Jacksonville|San Francisco|Indianapolis|Columbus|Charlotte|Seattle|Denver|Boston|Detroit|Nashville|Portland|Madrid|Barcelona|London|Manchester|Liverpool|Edinburgh| Dublin|Cork|Galway)\b/i,
  /\b\+\d{1,3}\s?\d{3,4}\s?\d{3,4}/,
  /\b\d{5}(-\d{4})?/,
];

const LOCAL_SERVICE_KEYWORDS = /\b(plumber|electrician| HVAC|roofer|landscaper|painter|mover|cleaner| mechanic|handyman|contractor|photographer)c?\b/i;

const COMMERCIAL_PATTERNS = [
  /\b(best|top|recommended|review|rated|comparison)\b/i,
  /\b(featured|leading|popular|trending)\b/i,
];

export function classifyKeywordIntent(query: string): KeywordAnalysis {
  const lowerQuery = query.toLowerCase();

  let isTransactional = TRANSACTIONAL_PATTERNS.some(p => p.test(query));
  let isInformational = INFORMATIONAL_PATTERNS.some(p => p.test(query));
  let isNavigational = NAVIGATIONAL_PATTERNS.some(p => p.test(query));
  let isLocal = LOCAL_PATTERNS.some(p => p.test(query));

  if (isLocal && LOCAL_SERVICE_KEYWORDS.test(query)) {
    isLocal = true;
  }

  let intent: KeywordIntent = 'unknown';
  if (isTransactional) intent = 'transactional';
  else if (isInformational) intent = 'informational';
  else if (isNavigational) intent = 'navigational';
  else if (isLocal) intent = 'local';
  else if (COMMERCIAL_PATTERNS.some(p => p.test(query))) intent = 'commercial';

  return {
    query,
    intent,
    isLocal,
    isTransactional,
    isInformational,
  };
}

export function detectCannibalization(rows: Array<{
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number;
}>): CannibalizationEntry[] {
  const groups: Record<string, Array<{
    page: string;
    impressions: number;
    clicks: number;
    position: number;
  }>> = {};

  rows.forEach(row => {
    const q = row.query;
    if (!groups[q]) groups[q] = [];
    groups[q].push({
      page: row.page,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      position: row.position || 0,
    });
  });

  const cannibalizations: CannibalizationEntry[] = [];

  for (const [query, pages] of Object.entries(groups)) {
    if (pages.length < 2) continue;

    const significantPages = pages.filter(p => p.impressions > 10);
    let severity: 'Critical' | 'Warning' | 'Minor' = 'Minor';
    if (significantPages.length >= 3) severity = 'Critical';
    else if (significantPages.length >= 2) severity = 'Warning';

    const sorted = pages.sort((a, b) => b.impressions - a.impressions);
    cannibalizations.push({
      query,
      severity,
      totalImpressions: pages.reduce((s, p) => s + p.impressions, 0),
      totalClicks: pages.reduce((s, p) => s + p.clicks, 0),
      pageCount: pages.length,
      pages: sorted,
      recommendation: `Keep: ${sorted[0].page}`,
    });
  }

  return cannibalizations.sort((a, b) => b.totalImpressions - a.totalImpressions);
}

export function detectRankChanges(
  currentRows: Array<{ query: string; impressions: number; position: number }>,
  previousRows: Array<{ query: string; position: number }>,
  minDelta = 2
): RankChangeEntry[] {
  const prevMap: Record<string, number> = {};
  previousRows.forEach(r => { prevMap[r.query] = r.position; });

  const changes: RankChangeEntry[] = currentRows
    .map(r => {
      const prevPos = prevMap[r.query];
      if (prevPos === undefined) return null;

      const delta = prevPos - r.position;
      if (Math.abs(delta) < minDelta) return null;

      return {
        query: r.query,
        currentPosition: r.position,
        previousPosition: prevPos,
        change: delta,
        direction: delta > 0 ? 'improved' : 'declined',
        impressions: r.impressions,
      };
    })
    .filter((c): c is RankChangeEntry => c !== null)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  return changes;
}

export function detectKeywordDrops(
  currentRows: Array<{ query: string; impressions: number; position: number }>,
  previousRows: Array<{ query: string; position: number }>,
  dropThreshold = 5
): KeywordDropEntry[] {
  const prevMap: Record<string, number> = {};
  previousRows.forEach(r => { prevMap[r.query] = r.position; });

  const drops: KeywordDropEntry[] = currentRows
    .map(r => {
      const prevPos = prevMap[r.query];
      if (prevPos === undefined) return null;

      const delta = prevPos - r.position;
      if (delta >= dropThreshold) {
        return {
          query: r.query,
          currentPosition: r.position,
          previousPosition: prevPos,
          positionDelta: delta,
          impressions: r.impressions,
          isSignificant: delta >= 10,
        };
      }
      return null;
    })
    .filter((d): d is KeywordDropEntry => d !== null)
    .sort((a, b) => b.positionDelta - a.positionDelta);

  return drops;
}

export function analyzeGSCRows(rows: Array<{
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number;
}>): {
  cannibalizations: CannibalizationEntry[];
  keywordsByIntent: Record<KeywordIntent, string[]>;
  pagePerformance: Record<string, {
    totalClicks: number;
    totalImpressions: number;
    avgPosition: number;
    queries: number;
  }>;
} {
  const cannibalizations = detectCannibalization(rows);

  const keywordsByIntent: Record<KeywordIntent, string[]> = {
    transactional: [],
    informational: [],
    navigational: [],
    commercial: [],
    local: [],
    unknown: [],
  };

  const seenQueries = new Set<string>();
  rows.forEach(row => {
    if (!seenQueries.has(row.query)) {
      seenQueries.add(row.query);
      const analysis = classifyKeywordIntent(row.query);
      keywordsByIntent[analysis.intent].push(row.query);
    }
  });

  const pagePerformance: Record<string, {
    totalClicks: number;
    totalImpressions: number;
    avgPosition: number;
    queries: number;
  }> = {};

  rows.forEach(row => {
    if (!pagePerformance[row.page]) {
      pagePerformance[row.page] = {
        totalClicks: 0,
        totalImpressions: 0,
        avgPosition: 0,
        queries: 0,
      };
    }
    pagePerformance[row.page].totalClicks += row.clicks;
    pagePerformance[row.page].totalImpressions += row.impressions;
    pagePerformance[row.page].avgPosition += row.position;
    pagePerformance[row.page].queries += 1;
  });

  for (const page of Object.keys(pagePerformance)) {
    const perf = pagePerformance[page];
    perf.avgPosition = perf.queries > 0 ? perf.avgPosition / perf.queries : 0;
  }

  return {
    cannibalizations,
    keywordsByIntent,
    pagePerformance,
  };
}

export function buildSEOPrompt(
  siteUrl: string,
  rows: Array<{
    query: string;
    page: string;
    clicks: number;
    impressions: number;
    position: number;
  }>,
  options?: {
    periodDays?: number;
    includeCannibalization?: boolean;
    includeRankChanges?: boolean;
    previousRows?: Array<{ query: string; impressions: number; position: number }>;
  }
): string {
  const analysis = analyzeGSCRows(rows);
  const { periodDays = 28, includeCannibalization = true, includeRankChanges = true, previousRows } = options || {};

  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  const startDate = new Date(today.getTime() - periodDays * 86400000).toISOString().split('T')[0];

  let prompt = `# SEO Analysis Request for ${siteUrl}
**Period:** ${startDate} to ${endDate} (${periodDays} days)

## Summary Statistics
- Total query-page combinations: ${rows.length}
- Unique queries: ${new Set(rows.map(r => r.query)).size}
- Unique pages: ${new Set(rows.map(r => r.page)).size}

## Keyword Intent Distribution
`;

  for (const [intent, queries] of Object.entries(analysis.keywordsByIntent)) {
    if (queries.length > 0) {
      prompt += `- **${intent.charAt(0).toUpperCase() + intent.slice(1)}**: ${queries.length} unique queries\n`;
    }
  }

  if (includeCannibalization && analysis.cannibalizations.length > 0) {
    prompt += `\n## Cannibalization Issues (${analysis.cannibalizations.length} detected)\n`;
    const critical = analysis.cannibalizations.filter(c => c.severity === 'Critical');
    const warning = analysis.cannibalizations.filter(c => c.severity === 'Warning');
    const minor = analysis.cannibalizations.filter(c => c.severity === 'Minor');

    prompt += `- Critical: ${critical.length} | Warning: ${warning.length} | Minor: ${minor.length}\n\n`;

    prompt += `### Top 10 Cannibalization Issues\n`;
    analysis.cannibalizations.slice(0, 10).forEach((c, i) => {
      prompt += `${i + 1}. **Query:** "${c.query}" | **Severity:** ${c.severity} | **Pages:** ${c.pageCount} | **Total Impressions:** ${c.totalImpressions.toLocaleString()}\n`;
      prompt += `   **Pages competing:**\n`;
      c.pages.slice(0, 3).forEach(p => {
        prompt += `   - ${p.page} (impressions: ${p.impressions.toLocaleString()}, position: ${p.position.toFixed(1)})\n`;
      });
      prompt += `   **Recommendation:** ${c.recommendation}\n\n`;
    });
  }

  if (includeRankChanges && previousRows && previousRows.length > 0) {
    const rankChanges = detectRankChanges(rows, previousRows);
    const drops = detectKeywordDrops(rows, previousRows);

    prompt += `\n## Rank Position Changes\n`;
    prompt += `- Total significant changes: ${rankChanges.length}\n`;
    prompt += `- Improved: ${rankChanges.filter(c => c.direction === 'improved').length}\n`;
    prompt += `- Declined: ${rankChanges.filter(c => c.direction === 'declined').length}\n`;

    if (drops.length > 0) {
      prompt += `\n### Keyword Drops (${drops.length} queries dropped ≥5 positions)\n`;
      drops.slice(0, 10).forEach((d, i) => {
        prompt += `${i + 1}. **Query:** "${d.query}" | **Position change:** ${d.previousPosition.toFixed(1)} → ${d.currentPosition.toFixed(1)} (${d.positionDelta > 0 ? '+' : ''}${d.positionDelta}) | **Impressions:** ${d.impressions.toLocaleString()}\n`;
      });
    }

    if (rankChanges.filter(c => c.direction === 'declined').length > 0) {
      prompt += `\n### Top Declined Queries\n`;
      rankChanges
        .filter(c => c.direction === 'declined')
        .slice(0, 5)
        .forEach((c, i) => {
          prompt += `${i + 1}. **Query:** "${c.query}" | **${c.previousPosition.toFixed(1)} → ${c.currentPosition.toFixed(1)} | **Impressions:** ${c.impressions.toLocaleString()}\n`;
        });
    }
  }

  prompt += `\n## Top Pages by Performance\n`;
  const topPages = Object.entries(analysis.pagePerformance)
    .sort((a, b) => b[1].totalClicks - a[1].totalClicks)
    .slice(0, 10);

  topPages.forEach(([page, perf], i) => {
    prompt += `${i + 1}. **${page}**\n`;
    prompt += `   - Clicks: ${perf.totalClicks.toLocaleString()} | Impressions: ${perf.totalImpressions.toLocaleString()} | Avg Position: ${perf.avgPosition.toFixed(1)} | Queries: ${perf.queries}\n`;
  });

  prompt += `
## Request
Based on the data above, provide a structured, page-specific SEO action plan. For each critical issue identified, recommend specific, actionable steps that can be taken to improve search performance. Focus on the highest-impact opportunities first.

Return your response as a JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary",
  "findings": [
    {
      "category": "CTR Opportunity | Quick Win | Content Gap | AI Overview | Cannibalization | Rank Drop",
      "severity": "Critical | High | Medium | Low",
      "query": "specific query or 'Multiple queries'",
      "page": "specific URL or 'Multiple pages'",
      "metric": "key metric with context",
      "recommendation": "specific actionable fix",
      "citations": ["data point 1", "data point 2"],
      "effort": "Low | Medium | High",
      "impact": "estimated clicks gained per month"
    }
  ],
  "topPriorityActions": ["top 3 actions ranked by effort-to-impact ratio"],
  "aiOverviewCandidates": [
    {
      "query": "query with AI Overview potential",
      "currentPosition": number,
      "action": "content optimization to reach top 5"
    }
  ]
}`;

  return prompt;
}

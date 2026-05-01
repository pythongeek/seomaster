export type KeywordIntent = 'transactional' | 'informational' | 'navigational' | 'commercial' | 'local' | 'unknown';
export type SubIntent = 'research' | 'evaluation' | 'purchase' | 'support' | 'comparison' | 'definition' | 'howto' | 'opinion' | 'news' | 'resource';
export type SERPFeature = 'featured_snippet' | 'people_also_ask' | 'knowledge_panel' | 'local_pack' | 'image_pack' | 'video' | 'news' | 'shopping' | 'none';
export type QueryModifier = 'brand' | 'location' | 'temporal' | 'competitor' | 'question' | 'comparison' | 'none';

export interface KeywordAnalysis {
  query: string;
  intent: KeywordIntent;
  subIntent: SubIntent;
  modifiers: QueryModifier[];
  confidence: number;
  isLocal: boolean;
  isTransactional: boolean;
  isInformational: boolean;
  isQuestion: boolean;
  isLongTail: boolean;
  wordCount: number;
  serpFeature: SERPFeature;
}

export interface ScoredKeyword extends KeywordAnalysis {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  benchCTR: number;
  ctrGap: number;
  ctrRatio: number;
  clicksLost: number;
  opportunityScore: number;
  trafficValue: number;
  competitiveDensity: number;
  performanceLabel: 'Outperforming' | 'At Benchmark' | 'Underperforming' | 'Critical Gap' | 'No Clicks';
  fixRecommendation: string;
}

export interface CannibalizationEntry {
  query: string;
  severity: 'Critical' | 'Warning' | 'Minor';
  totalImpressions: number;
  totalClicks: number;
  pageCount: number;
  pages: Array<{ page: string; impressions: number; clicks: number; position: number; ctr: number; shareOfClicks: number }>;
  dominantPage: string;
  splitScore: number;
  recommendation: string;
}

export interface RankChangeEntry {
  query: string;
  currentPosition: number;
  previousPosition: number;
  change: number;
  direction: 'improved' | 'declined' | 'stable';
  impressions: number;
  isSignificant: boolean;
  urgency: 'immediate' | 'watch' | 'monitor';
}

export interface KeywordDropEntry {
  query: string;
  currentPosition: number;
  previousPosition: number;
  positionDelta: number;
  impressions: number;
  isSignificant: boolean;
  isRecoverable: boolean;
  estimatedTrafficLoss: number;
}

export interface ContentGapEntry {
  query: string;
  page: string;
  impressions: number;
  clicks: number;
  position: number;
  gapType: 'impression_only' | 'ctr_gap' | 'volume' | 'ranking';
  priority: 'P0_Critical' | 'P1_High' | 'P2_Medium' | 'P3_Low';
  rootCause: string;
  action: string;
}

export interface SERPAnalysis {
  query: string;
  page: string;
  position: number;
  featuresPresent: SERPFeature[];
  featureAbsorptionRate: number;
  isFeatureBlocked: boolean;
  recommendedResponse: string;
}

export interface FilterPreset {
  id: string;
  label: string;
  pattern: string;
  description: string;
  scope: 'query' | 'page' | 'both';
}

export interface RegexFilterResult {
  matchedRows: number;
  totalRows: number;
  matchRate: number;
  topQueries: Array<{ query: string; impressions: number; ctr: number; position: number }>;
  intentDistribution: Record<string, number>;
  suggestedRefinements: string[];
}

export interface AdvancedFilterPipeline {
  presetFilters: FilterPreset[];
  customRegex: string | null;
  intentFilter: KeywordIntent | null;
  minImpressions: number;
  minPosition: number;
  maxPosition: number;
  dateRange: { start: string; end: string } | null;
}

const CTR_BENCHMARKS: Record<number, number> = {
  1: 28.5, 2: 15.2, 3: 9.8, 4: 7.0, 5: 5.4, 6: 4.2, 7: 3.4, 8: 3.0, 9: 2.6, 10: 2.2,
  11: 1.5, 12: 1.3, 13: 1.1, 14: 0.9, 15: 0.8, 16: 0.6, 17: 0.5, 18: 0.5, 19: 0.4, 20: 0.3,
};

const INTENT_MULTIPLIER: Record<KeywordIntent, number> = {
  transactional: 0.85, commercial: 0.90, informational: 1.05, navigational: 1.25, local: 0.95, unknown: 1.0,
};

const QUESTION_PREFIXES = /^(how|what|why|when|who|which|where|can|does|is|are|should|will|do|shouldn't|would|could|won't|can't)\b/i;
const TEMPORAL_PATTERNS = /\b(2025|2024|2023|2022|january|february|march|april|may|june|july|august|september|october|november|december|this year|last year|next year|quarter|weekly|daily|tonight|today|now|current|latest|recent|new|updated)\b/i;
const LOCATION_PATTERNS = /\b(near me|nearby|local|closest|in [a-z]{3,15}|in the [a-z]+|at the|store|shop|cafe|restaurant|clinic|pharmacy)\b/i;
const BRAND_PATTERNS = /\b(apple|microsoft|google|amazon|facebook|meta|tesla|netflix|adobe|oracle|salesforce|hubspot|zendesk|shopify|stripe|slack|zoom|atlassian|jira|github)\b/i;
const COMPETITOR_PATTERN = /\bvs\b|\bversus\b|\bversus\b|\bcompare\b|\balternative\b|\binstead of\b|\binstead of\b/i;
const PURCHASE_INTENT = /\b(buy|purchase|order|shop|checkout|cart|add to cart|price|pricing|cost|afford|discount|deal|sale|clearance|cheap|bargain|promo|subscribe|subscription|plan|premium|membership|license|rent|lease|financing|payment plan|buy now|where to buy|how to buy|store near me)\b/i;
const INFO_INTENT = /\b(how to|what is|what are|why does|guide|tutorial|learn|explain|tips|tricks|best practices|strategy|approach|meaning|definition|define|example|understand|how do i|can i|should i|is it|are there|difference|comparing)\b/i;
const COMMERCIAL_INTENT = /\b(best|top|recommended|review|reviews|rated|rating|compare|comparison|vs\b|versus|alternative|alternatives|pros and cons|worth it|should i buy|ranking|leading|popular|trending|featured)\b/i;
const NAVIGATIONAL_INTENT = /\b(login|signin|sign in|log in|account|profile|settings|portal|dashboard|my account|customer service|contact us|about us|home|homepage|main page|official)\b/i;
const SERP_FEATURE_PATTERNS = {
  featured_snippet: /\b(what is|how to|define|definition|meaning)\b/i,
  people_also_ask: /\b(how|what|why|when|where|who)\b.*\b\?/i,
  knowledge_panel: /\b(founder|CEO|company|born|established|headquarters)\b/i,
  local_pack: /\b(near me|nearby|local|closest|open now|hours)\b/i,
  image_pack: /\b(image|photo|picture|gallery|visual)\b/i,
  video: /\b(video|watch|stream|youtube|tutorial)\b/i,
  news: /\b(news|latest|breaking|report|announced)\b/i,
  shopping: /\b(buy|price|cost|shop|product|deal|discount)\b/i,
};

const FILTER_PRESETS: FilterPreset[] = [
  { id: 'brand_protect', label: 'Brand Keywords', pattern: '(your brand name|your brand)', description: 'Protect brand queries', scope: 'query' },
  { id: 'competitor_steal', label: 'Competitor Branded', pattern: '(competitor a|competitor b|vs competitor)', description: 'Find competitor comparison queries', scope: 'query' },
  { id: 'local_nearme', label: 'Local "Near Me"', pattern: '(near me|nearby|closest|local)', description: 'High-intent local queries', scope: 'query' },
  { id: 'question_how', label: 'How-To Questions', pattern: '^(how to|how do i|how can)', description: 'AI Overview eligible', scope: 'query' },
  { id: 'question_what', label: 'What-Is Questions', pattern: '^(what is|what are|what does)', description: 'Definition queries for featured snippets', scope: 'query' },
  { id: 'purchase_intent', label: 'Purchase Intent', pattern: '(buy|purchase|price|discount|deal|order|shop)', description: 'Transaction-ready queries', scope: 'query' },
  { id: 'zero_clicks', label: 'Zero Clicks', pattern: '(impressions:[1-9]\\d{3,}|clicks:0)', description: 'Impressions with no clicks', scope: 'both' },
  { id: 'long_tail', label: 'Long-tail Keywords', pattern: '(.{30,})', description: 'Keywords with 5+ words', scope: 'query' },
  { id: 'page1_gap', label: 'Page 1 CTG Gap', pattern: '(position:[1-9]|position:10)', description: 'Positions 1-10 but low CTR', scope: 'both' },
];

function benchCTR(position: number, intent: KeywordIntent = 'informational'): number {
  if (position <= 0) return 0;
  if (position >= 20) return 0.2;
  const base = CTR_BENCHMARKS[Math.round(position)] ?? 0.2;
  return base * (INTENT_MULTIPLIER[intent] ?? 1.0);
}

function detectSERPFeatures(query: string, position: number): SERPFeature[] {
  const features: SERPFeature[] = [];
  if (position > 10) return ['none'];
  if (SERP_FEATURE_PATTERNS.featured_snippet.test(query)) features.push('featured_snippet');
  if (SERP_FEATURE_PATTERNS.people_also_ask.test(query)) features.push('people_also_ask');
  if (SERP_FEATURE_PATTERNS.knowledge_panel.test(query)) features.push('knowledge_panel');
  if (SERP_FEATURE_PATTERNS.local_pack.test(query)) features.push('local_pack');
  if (SERP_FEATURE_PATTERNS.image_pack.test(query)) features.push('image_pack');
  if (SERP_FEATURE_PATTERNS.video.test(query)) features.push('video');
  if (SERP_FEATURE_PATTERNS.news.test(query)) features.push('news');
  if (SERP_FEATURE_PATTERNS.shopping.test(query)) features.push('shopping');
  return features.length > 0 ? features : ['none'];
}

function detectQueryModifiers(query: string): QueryModifier[] {
  const modifiers: QueryModifier[] = [];
  if (QUESTION_PREFIXES.test(query)) modifiers.push('question');
  if (BRAND_PATTERNS.test(query)) modifiers.push('brand');
  if (LOCATION_PATTERNS.test(query)) modifiers.push('location');
  if (TEMPORAL_PATTERNS.test(query)) modifiers.push('temporal');
  if (COMPETITOR_PATTERN.test(query)) modifiers.push('competitor');
  if (/\bvs\b|\bversus\b|\bcompare\b/i.test(query)) modifiers.push('comparison');
  return modifiers.length > 0 ? modifiers : ['none'];
}

function detectSubIntent(query: string, intent: KeywordIntent): SubIntent {
  const lower = query.toLowerCase();
  if (intent === 'informational') {
    if (/^(how to|how do i|how can i)/i.test(lower)) return 'howto';
    if (/^(what is|what are|definition|meaning)/i.test(lower)) return 'definition';
    if (/\b(review|vs|versus|compare|comparison|pros and cons)\b/i.test(lower)) return 'comparison';
    if (/\b(opinion|taste|feel|think|believe|prefer)\b/i.test(lower)) return 'opinion';
    if (/\b(news|latest|breaking|announced|recent)\b/i.test(lower)) return 'news';
    if (/\b(resource|guide|tutorial|learn|download)\b/i.test(lower)) return 'resource';
    return 'research';
  }
  if (intent === 'commercial') {
    if (/\b(buy|purchase|order|shop|checkout| subscribe)\b/i.test(lower)) return 'purchase';
    if (/\b(review|vs|versus|compare|best|top)\b/i.test(lower)) return 'evaluation';
    return 'evaluation';
  }
  if (intent === 'transactional') return 'purchase';
  if (intent === 'navigational') return 'support';
  return 'research';
}

export function classifyKeywordIntent(query: string): KeywordAnalysis {
  const lower = query.toLowerCase();
  const words = lower.split(/\s+/);
  const wordCount = words.length;
  const isQuestion = QUESTION_PREFIXES.test(query);
  const isLongTail = wordCount >= 4;
  const modifiers = detectQueryModifiers(query);

  let isTransactional = PURCHASE_INTENT.test(query);
  let isInformational = INFO_INTENT.test(query);
  let isNavigational = NAVIGATIONAL_INTENT.test(query);
  let isCommercial = COMMERCIAL_INTENT.test(query);
  let isLocal = LOCATION_PATTERNS.test(query) || (/\b(near me|nearby|local)\b/i.test(lower) && /\b(store|shop|restaurant|clinic|cafe)\b/i.test(lower));

  let intent: KeywordIntent = 'unknown';
  let confidence = 0.5;

  if (isTransactional) { intent = 'transactional'; confidence = 0.85; }
  else if (isNavigational && !isCommercial) { intent = 'navigational'; confidence = 0.9; }
  else if (isLocal) { intent = 'local'; confidence = 0.8; }
  else if (isCommercial) {
    intent = 'commercial';
    confidence = COMPETITOR_PATTERN.test(query) ? 0.9 : 0.75;
  }
  else if (isInformational) { intent = 'informational'; confidence = 0.8; }

  if (modifiers.includes('brand') && intent === 'unknown') {
    intent = 'navigational';
    confidence = 0.7;
  }

  const serpFeature = detectSERPFeatures(query, 1)[0];

  return {
    query,
    intent,
    subIntent: detectSubIntent(query, intent),
    modifiers,
    confidence,
    isLocal,
    isTransactional,
    isInformational,
    isQuestion,
    isLongTail,
    wordCount,
    serpFeature,
  };
}

export function scoreKeyword(row: { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }): ScoredKeyword {
  const analysis = classifyKeywordIntent(row.query);
  const bench = benchCTR(row.position, analysis.intent);
  const ctrGap = bench - row.ctr;
  const ctrRatio = row.ctr / Math.max(bench, 0.01);

  const serpAbsorption = analysis.serpFeature !== 'none' ? 0.3 : 0;
  const impressionQuality = row.impressions >= 5000 ? 2.0 : row.impressions >= 1000 ? 1.5 : row.impressions >= 200 ? 1.0 : 0.5;
  const positionMultiplier = row.position <= 3 ? 0.7 : row.position <= 5 ? 1.2 : row.position <= 10 ? 1.5 : row.position <= 20 ? 0.9 : 0.4;
  const intentValue = analysis.intent === 'transactional' ? 1.4 : analysis.intent === 'commercial' ? 1.2 : analysis.intent === 'informational' ? 1.0 : 0.8;

  const clicksLost = Math.round(Math.max(0, row.impressions * ctrGap / 100));
  const trafficValue = row.clicks * intentValue * (row.position <= 10 ? 1.5 : 1.0);
  const competitiveDensity = row.impressions > 0 ? (row.clicks / row.impressions) / Math.max(ctrRatio, 0.01) : 1;
  const opportunityScore = row.impressions * (ctrGap / 100) * impressionQuality * positionMultiplier * intentValue * (1 - serpAbsorption);

  let performanceLabel: ScoredKeyword['performanceLabel'] = 'No Clicks';
  if (row.clicks > 0) {
    if (ctrRatio >= 1.3) performanceLabel = 'Outperforming';
    else if (ctrRatio >= 0.9) performanceLabel = 'At Benchmark';
    else if (ctrRatio >= 0.6) performanceLabel = 'Underperforming';
    else performanceLabel = 'Critical Gap';
  }

  let fixRecommendation = '';
  if (ctrGap < 0.5) {
    fixRecommendation = 'CTR at or above benchmark — maintain quality';
  } else if (analysis.intent === 'transactional') {
    fixRecommendation = ctrGap > 5
      ? `Add power words + price anchoring: "Get [Product] Today — Free Shipping" — recover ${ctrGap.toFixed(1)}pp`
      : `Add transactional CTA to title: "Buy | Shop | Order [keyword]"`;
  } else if (analysis.intent === 'commercial') {
    fixRecommendation = `Reframe as list/comparison: "Best ${row.query} in 2025 — [N] Options Compared"`;
  } else if (analysis.isQuestion) {
    fixRecommendation = `How-To format with numeric specificity: "How to ${row.query.replace(/^(how to |how do i )/i, '')} ([3/5/7] Steps)"`;
  } else if (ctrGap > 8) {
    fixRecommendation = `Severe CTR underperformance (${ctrGap.toFixed(1)}pp gap). Test: (1) Add year [2025], (2) Number-led title, (3) Emotional trigger`;
  } else {
    fixRecommendation = `Add meta description urgency cue + exact keyword match in title — recover ~${clicksLost} clicks/mo`;
  }

  return {
    ...analysis,
    page: row.page,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
    benchCTR: parseFloat(bench.toFixed(2)),
    ctrGap: parseFloat(ctrGap.toFixed(2)),
    ctrRatio: parseFloat(ctrRatio.toFixed(3)),
    clicksLost,
    opportunityScore: parseFloat(opportunityScore.toFixed(2)),
    trafficValue: parseFloat(trafficValue.toFixed(2)),
    competitiveDensity: parseFloat(competitiveDensity.toFixed(2)),
    performanceLabel,
    fixRecommendation,
  };
}

export function detectCannibalization(rows: Array<{ query: string; page: string; clicks: number; impressions: number; position: number; ctr: number }>): CannibalizationEntry[] {
  const groups: Record<string, Array<{ page: string; impressions: number; clicks: number; position: number; ctr: number }>> = {};

  rows.forEach(row => {
    if (!row.query) return;
    if (!groups[row.query]) groups[row.query] = [];
    if (!groups[row.query].some(x => x.page === row.page)) {
      groups[row.query].push({ page: row.page, impressions: row.impressions, clicks: row.clicks, position: row.position, ctr: row.ctr });
    }
  });

  return Object.entries(groups)
    .filter(([, pages]) => pages.length > 1)
    .map(([query, pages]) => {
      const sorted = [...pages].sort((a, b) => b.impressions - a.impressions);
      const dominant = sorted[0];
      const totalImpressions = sorted.reduce((s, p) => s + p.impressions, 0);
      const totalClicks = sorted.reduce((s, p) => s + p.clicks, 0);

      const impressionShare = sorted.slice(1).reduce((s, p) => s + p.impressions, 0) / Math.max(dominant.impressions, 1);
      const clickShare = sorted.slice(1).reduce((s, p) => s + p.clicks, 0) / Math.max(dominant.clicks, 1);
      const splitScore = parseFloat((sorted.length * (impressionShare + clickShare) / 2).toFixed(3));

      let severity: 'Critical' | 'Warning' | 'Minor' = 'Minor';
      if (sorted.length >= 3 && splitScore > 0.3) severity = 'Critical';
      else if (sorted.length >= 2 && splitScore > 0.2) severity = 'Warning';

      const pagesWithShare = sorted.map(p => ({
        page: p.page,
        impressions: p.impressions,
        clicks: p.clicks,
        position: p.position,
        ctr: p.ctr,
        shareOfClicks: totalClicks > 0 ? parseFloat((p.clicks / totalClicks * 100).toFixed(1)) : 0,
      }));

      return {
        query,
        severity,
        totalImpressions,
        totalClicks,
        pageCount: sorted.length,
        pages: pagesWithShare,
        dominantPage: dominant.page,
        splitScore,
        recommendation: sorted.length >= 3
          ? `CRITICAL: ${sorted.length} URLs competing. Canonical "${dominant.page}" as preferred. 301-redirect or noindex the weaker ${sorted.length - 1} URLs.`
          : `Redirect "${sorted[1].page}" to "${dominant.page}" or add canonical tag pointing to dominant URL.`,
      };
    })
    .filter(c => c.splitScore > 0.1)
    .sort((a, b) => b.totalImpressions - a.totalImpressions);
}

export function detectRankChanges(
  currentRows: Array<{ query: string; impressions: number; position: number }>,
  previousRows: Array<{ query: string; position: number }>,
  minDelta = 2
): RankChangeEntry[] {
  const prevMap: Record<string, number> = {};
  previousRows.forEach(r => { prevMap[r.query] = r.position; });

  return currentRows
    .map(r => {
      const prevPos = prevMap[r.query];
      if (prevPos === undefined) return null;

      const delta = prevPos - r.position;
      if (Math.abs(delta) < minDelta) return null;

      let urgency: RankChangeEntry['urgency'] = 'monitor';
      if (r.position > 10 && delta < -5) urgency = 'immediate';
      else if (r.position > 5 && delta < -3) urgency = 'watch';

      return {
        query: r.query,
        currentPosition: r.position,
        previousPosition: prevPos,
        change: delta,
        direction: delta > 0 ? 'improved' : 'declined',
        impressions: r.impressions,
        isSignificant: Math.abs(delta) >= 5 || (r.position <= 10 && Math.abs(delta) >= 3),
        urgency,
      };
    })
    .filter((c): c is RankChangeEntry => c !== null)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

export function detectKeywordDrops(
  currentRows: Array<{ query: string; impressions: number; position: number }>,
  previousRows: Array<{ query: string; position: number }>,
  dropThreshold = 5
): KeywordDropEntry[] {
  const prevMap: Record<string, number> = {};
  previousRows.forEach(r => { prevMap[r.query] = r.position; });

  return currentRows
    .map(r => {
      const prevPos = prevMap[r.query];
      if (prevPos === undefined) return null;

      const delta = prevPos - r.position;
      if (delta < dropThreshold) return null;

      const currentBench = CTR_BENCHMARKS[Math.min(Math.round(r.position), 20)] ?? 0.2;
      const prevBench = CTR_BENCHMARKS[Math.min(Math.round(prevPos), 20)] ?? 0.2;
      const trafficLoss = Math.round(r.impressions * (prevBench - currentBench) / 100);

      return {
        query: r.query,
        currentPosition: r.position,
        previousPosition: prevPos,
        positionDelta: delta,
        impressions: r.impressions,
        isSignificant: delta >= 10,
        isRecoverable: r.position <= 10 && delta <= 15,
        estimatedTrafficLoss: Math.max(0, trafficLoss),
      };
    })
    .filter((d): d is KeywordDropEntry => d !== null)
    .sort((a, b) => b.positionDelta - a.positionDelta);
}

export function detectContentGaps(rows: Array<{ query: string; page: string; impressions: number; clicks: number; position: number }>): ContentGapEntry[] {
  return rows
    .filter(r => r.clicks === 0)
    .map(r => {
      let gapType: ContentGapEntry['gapType'] = 'impression_only';
      let priority: ContentGapEntry['priority'] = 'P3_Low';
      let rootCause = '';
      let action = '';

      if (r.impressions > 5000) {
        gapType = 'impression_only'; priority = 'P0_Critical';
        rootCause = 'Severe title/meta mismatch or SERP feature blocking — 5K+ impressions with zero clicks';
        action = 'Immediate rewrite of title tag and meta description; check for SERP feature absorption';
      } else if (r.impressions > 1000) {
        gapType = 'ctr_gap'; priority = 'P1_High';
        rootCause = 'Title/meta not compelling enough despite ranking — CTR issue, not ranking issue';
        action = 'Rewrite title with power words, numbers, year; improve meta description with CTA';
      } else if (r.impressions > 500) {
        gapType = 'ranking'; priority = 'P2_Medium';
        rootCause = r.position > 10 ? 'Position too low to earn clicks — need backlinks + content depth' : 'Content not compelling enough at current position';
        action = 'Improve content depth, E-E-A-T signals, and internal links; build backlinks';
      } else {
        gapType = 'volume'; priority = 'P3_Low';
        rootCause = 'Low-volume zero-click — may be featured snippet or PAA absorbing clicks';
        action = 'Monitor; add FAQ schema and direct answers to capture SERP features';
      }

      return { query: r.query, page: r.page, impressions: r.impressions, clicks: r.clicks, position: r.position, gapType, priority, rootCause, action };
    })
    .sort((a, b) => {
      const pOrder = { P0_Critical: 0, P1_High: 1, P2_Medium: 2, P3_Low: 3 };
      return pOrder[a.priority] - pOrder[b.priority] || b.impressions - a.impressions;
    });
}

export function applyAdvancedRegexFilter(
  rows: Array<{ query: string; page: string; impressions: number; clicks: number; ctr: number; position: number }>,
  filters: AdvancedFilterPipeline
): RegexFilterResult {
  let filtered = [...rows];

  if (filters.intentFilter) {
    filtered = filtered.filter(r => classifyKeywordIntent(r.query).intent === filters.intentFilter);
  }

  if (filters.customRegex) {
    try {
      const rx = new RegExp(filters.customRegex, 'i');
      filtered = filtered.filter(r => rx.test(r.query) || rx.test(r.page));
    } catch { /* invalid regex, skip */ }
  }

  if (filters.minImpressions > 0) {
    filtered = filtered.filter(r => r.impressions >= filters.minImpressions);
  }

  if (filters.maxPosition > 0) {
    filtered = filtered.filter(r => r.position <= filters.maxPosition);
  }

  if (filters.minPosition > 0) {
    filtered = filtered.filter(r => r.position >= filters.minPosition);
  }

  filtered = filtered.sort((a, b) => b.impressions - a.impressions).slice(0, 150);

  const intentDist: Record<string, number> = {};
  filtered.forEach(r => {
    const intent = classifyKeywordIntent(r.query).intent;
    intentDist[intent] = (intentDist[intent] || 0) + 1;
  });

  const suggestedRefinements: string[] = [];
  const matchedIntentCount = Object.values(intentDist).reduce((a, b) => a + b, 0);
  if (matchedIntentCount < 10 && filters.minImpressions < 200) {
    suggestedRefinements.push('Try increasing minImpressions threshold to reduce noise');
  }
  if (matchedIntentCount > 100 && !filters.customRegex) {
    suggestedRefinements.push('Add a custom regex to narrow results — e.g. "(best|top|review)" for commercial queries');
  }

  return {
    matchedRows: filtered.length,
    totalRows: rows.length,
    matchRate: rows.length > 0 ? parseFloat((filtered.length / rows.length * 100).toFixed(1)) : 0,
    topQueries: filtered.slice(0, 10).map(r => ({ query: r.query, impressions: r.impressions, ctr: r.ctr, position: r.position })),
    intentDistribution: intentDist,
    suggestedRefinements,
  };
}

export function analyzeSERPAbsorption(rows: Array<{ query: string; page: string; impressions: number; clicks: number; position: number; ctr: number }>): SERPAnalysis[] {
  return rows
    .filter(r => r.clicks === 0 && r.impressions > 100 && r.position <= 20)
    .map(r => {
      const analysis = classifyKeywordIntent(r.query);
      const features = detectSERPFeatures(r.query, r.position);
      const featureAbsorptionRate = features[0] !== 'none' ? 0.4 : 0;
      const isFeatureBlocked = r.position <= 5 && r.clicks === 0 && features[0] !== 'none';

      let recommendedResponse = '';
      if (isFeatureBlocked) {
        if (features.includes('featured_snippet')) {
          recommendedResponse = 'Optimize for featured snippet: add a direct 40-60 word answer in the first paragraph, formatted as a clear definition or step-by-step.';
        } else if (features.includes('people_also_ask')) {
          recommendedResponse = 'Address People Also Ask questions with clear Q&A formatting using H2/H3 headings and concise paragraphs.';
        } else if (features.includes('local_pack')) {
          recommendedResponse = 'Optimize Google Business Profile with complete NAP, categories, photos, and reviews.';
        } else {
          recommendedResponse = `Reduce SERP feature competition by targeting more specific long-tail variants of this query.`;
        }
      }

      return {
        query: r.query,
        page: r.page,
        position: r.position,
        featuresPresent: features,
        featureAbsorptionRate,
        isFeatureBlocked,
        recommendedResponse,
      };
    })
    .filter(r => r.isFeatureBlocked || r.featuresPresent[0] !== 'none')
    .sort((a, b) => b.featureAbsorptionRate - a.featureAbsorptionRate);
}

export function computeSiteHealthScore(rows: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>): { score: number; grade: string; breakdown: Record<string, number>; label: string } {
  if (!rows.length) return { score: 0, grade: 'N/A', breakdown: {}, label: 'No Data' };

  const avgPos = rows.reduce((s, r) => s + r.position, 0) / rows.length;
  const avgCTR = rows.reduce((s, r) => s + r.ctr, 0) / rows.length;
  const p1Ratio = rows.filter(r => r.position <= 10).length / rows.length;
  const zeroClickRatio = rows.filter(r => r.clicks === 0).length / rows.length;
  const highCTRRatio = rows.filter(r => {
    const analysis = classifyKeywordIntent(r.query);
    const bench = benchCTR(r.position, analysis.intent);
    return r.ctr >= bench * 0.9;
  }).length / rows.length;
  const top3Ratio = rows.filter(r => r.position <= 3).length / rows.length;

  const posScore = Math.max(0, 100 - (avgPos - 1) * 3.5);
  const ctrScore = Math.min(100, (avgCTR / 6) * 100);
  const coverageScore = p1Ratio * 100;
  const zeroClickPenalty = (1 - zeroClickRatio) * 100;
  const efficiencyScore = highCTRRatio * 100;
  const topPositionBonus = top3Ratio * 50;

  const composite = posScore * 0.22 + ctrScore * 0.22 + coverageScore * 0.18 + zeroClickPenalty * 0.15 + efficiencyScore * 0.15 + topPositionBonus * 0.08;
  const score = Math.round(Math.min(100, Math.max(0, composite)));

  let grade: string;
  if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';
  else grade = 'F';

  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : score >= 40 ? 'Poor' : 'Critical';

  return {
    score,
    grade,
    label,
    breakdown: {
      positionScore: Math.round(posScore),
      ctrScore: Math.round(ctrScore),
      coverageScore: Math.round(coverageScore),
      zeroClickPenalty: Math.round(zeroClickPenalty),
      efficiencyScore: Math.round(efficiencyScore),
      topPositionBonus: Math.round(topPositionBonus),
    },
  };
}

export function scoreKeywordCluster(
  queries: string[],
  rows: Array<{ query: string; impressions: number; clicks: number; position: number; ctr: number }>
): {
  clusterIntent: KeywordIntent;
  totalVolume: number;
  avgPosition: number;
  totalClicks: number;
  topOpportunityQuery: string;
  clusterDifficulty: 'Easy' | 'Medium' | 'Hard';
  recommendedStrategy: string;
} {
  const analyses = queries.map(q => classifyKeywordIntent(q));
  const intentCounts: Record<string, number> = {};
  analyses.forEach(a => { intentCounts[a.intent] = (intentCounts[a.intent] || 0) + 1; });

  const clusterIntent = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] as KeywordIntent || 'unknown';

  const querySet = new Set(queries);
  const clusterRows = rows.filter(r => querySet.has(r.query));

  const totalVolume = clusterRows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = clusterRows.reduce((s, r) => s + r.clicks, 0);
  const avgPosition = clusterRows.length > 0 ? clusterRows.reduce((s, r) => s + r.position, 0) / clusterRows.length : 0;

  const topOpportunityQuery = clusterRows
    .filter(r => r.impressions > 0)
    .sort((a, b) => {
      const aAnalysis = classifyKeywordIntent(a.query);
      const bAnalysis = classifyKeywordIntent(b.query);
      const aScore = a.impressions * (benchCTR(a.position, aAnalysis.intent) - a.ctr) / 100;
      const bScore = b.impressions * (benchCTR(b.position, bAnalysis.intent) - b.ctr) / 100;
      return bScore - aScore;
    })[0]?.query || queries[0];

  const clusterDifficulty: 'Easy' | 'Medium' | 'Hard' =
    avgPosition <= 5 ? 'Easy' : avgPosition <= 15 ? 'Medium' : 'Hard';

  const longTailRatio = analyses.filter(a => a.isLongTail).length / analyses.length;
  const questionRatio = analyses.filter(a => a.isQuestion).length / analyses.length;

  let recommendedStrategy = '';
  if (clusterIntent === 'transactional') {
    recommendedStrategy = 'Focus on conversion-optimized landing pages with clear CTAs, price anchoring, and trust signals.';
  } else if (clusterIntent === 'informational') {
    if (questionRatio > 0.5) {
      recommendedStrategy = 'Build FAQ schema content with direct answers in first 50 words; target AI Overview eligibility.';
    } else {
      recommendedStrategy = 'Develop comprehensive pillar content with clear structure, E-E-A-T signals, and internal linking.';
    }
  } else if (clusterIntent === 'commercial') {
    recommendedStrategy = 'Create comparison content with detailed feature tables, user reviews, and expert roundups.';
  } else if (clusterIntent === 'local') {
    recommendedStrategy = 'Optimize for local pack with Google Business Profile, local citations, and location-specific landing pages.';
  } else {
    recommendedStrategy = 'Develop topic authority through cluster content strategy and internal link architecture.';
  }

  if (longTailRatio > 0.6) {
    recommendedStrategy += ' High long-tail ratio suggests creating dedicated landing pages for each query theme.';
  }

  return {
    clusterIntent,
    totalVolume,
    avgPosition: parseFloat(avgPosition.toFixed(1)),
    totalClicks,
    topOpportunityQuery,
    clusterDifficulty,
    recommendedStrategy,
  };
}

export function generateOpportunityHeatmap(rows: Array<{ query: string; page: string; impressions: number; clicks: number; ctr: number; position: number }>): Record<string, Array<{ query: string; opportunity: number; quadrant: string }>> {
  const scored = rows.map(r => {
    const analysis = classifyKeywordIntent(r.query);
    const bench = benchCTR(r.position, analysis.intent);
    const ctrGap = bench - r.ctr;
    const opportunity = r.impressions * ctrGap / 100 * (analysis.intent === 'transactional' ? 1.4 : 1.0);
    return { query: r.query, page: r.page, opportunity, position: r.position, impressions: r.impressions };
  });

  const highImpressions = scored.filter(r => r.impressions > 1000);
  const lowImpressions = scored.filter(r => r.impressions <= 1000);

  const highOpportunities = scored.filter(r => r.opportunity > 100);
  const lowOpportunities = scored.filter(r => r.opportunity <= 100);

  const result: Record<string, Array<{ query: string; opportunity: number; quadrant: string }>> = {
    'High Impact (Act Now)': highOpportunities.filter(r => r.impressions > 1000).map(r => ({ query: r.query, opportunity: Math.round(r.opportunity), quadrant: 'High Impact' })),
    'Quick Wins (Low Effort)': lowOpportunities.filter(r => r.impressions > 1000 && r.position <= 10).map(r => ({ query: r.query, opportunity: Math.round(r.opportunity), quadrant: 'Quick Wins' })),
    'Growth Potential': highOpportunities.filter(r => r.impressions <= 1000).map(r => ({ query: r.query, opportunity: Math.round(r.opportunity), quadrant: 'Growth Potential' })),
    'Monitor': lowOpportunities.filter(r => r.impressions <= 1000).map(r => ({ query: r.query, opportunity: Math.round(r.opportunity), quadrant: 'Monitor' })),
  };

  return result;
}

export function getFilterPresets(): FilterPreset[] {
  return FILTER_PRESETS;
}

export function suggestFilterRefinements(rows: Array<{ query: string; page: string; impressions: number; clicks: number; ctr: number; position: number }>): string[] {
  const suggestions: string[] = [];
  const analyses = rows.map(r => ({ ...classifyKeywordIntent(r.query), row: r }));

  const zeroClickCount = analyses.filter(a => a.row.clicks === 0).length;
  if (zeroClickCount > rows.length * 0.3) {
    suggestions.push('High zero-click rate detected — check for SERP feature absorption or title/meta mismatches');
  }

  const avgCTR = rows.reduce((s, r) => s + r.ctr, 0) / rows.length;
  if (avgCTR < 2) {
    suggestions.push('Average CTR below 2% — consider CTR optimization for top-performing queries');
  }

  const highPositionLowCTR = analyses.filter(a => {
    const gap = benchCTR(a.row.position, a.intent) - a.row.ctr;
    return a.row.position <= 5 && gap > 3;
  });
  if (highPositionLowCTR.length > 5) {
    suggestions.push(`${highPositionLowCTR.length} queries in positions 1-5 with CTR gaps >3pp — title/meta audit recommended`);
  }

  const localCount = analyses.filter(a => a.isLocal).length;
  if (localCount > 0) {
    suggestions.push(`${localCount} local queries detected — ensure Google Business Profile optimization`);
  }

  const longTailCount = analyses.filter(a => a.isLongTail).length;
  if (longTailCount > rows.length * 0.4) {
    suggestions.push('Many long-tail queries — consider creating dedicated landing pages for high-volume long-tail themes');
  }

  return suggestions;
}

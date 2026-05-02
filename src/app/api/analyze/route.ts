import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const AI_TIMEOUT_MS = 90000;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface GSCRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  data_date?: string;
  country?: string;
  device?: string;
}

interface EnrichedRow extends GSCRow {
  benchmarkCTR: number;
  ctrGap: number;
  ctrRatio: number;
  zScore: number;
  intent: IntentProfile;
  commercialValue: number;
  trafficValue: number;
  priorityScore: number;
  opportunityTier: OpportunityTier;
  serpFeatures: SERPFeature[];
  isCannibalized: boolean;
  cannibalPages: string[];
  trendDirection: 'rising' | 'falling' | 'stable';
  deviceBreakdown?: Record<string, { clicks: number; impressions: number; ctr: number; position: number }>;
}

interface IntentProfile {
  intent: 'informational' | 'transactional' | 'navigational' | 'commercial' | 'local';
  category: string;
  commercialSignals: number;
  questionForm: boolean;
  listIntent: boolean;
}

interface SERPFeature {
  type: 'featured_snippet' | 'people_also_ask' | 'video' | 'image' | 'news' | 'shopping' | 'local_pack';
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

type OpportunityTier = 'critical' | 'high' | 'medium' | 'low';

interface AnalysisResult {
  overview: OverviewMetrics;
 ctrAnalysis: CTRAnalysis;
  quickWins: QuickWin[];
  contentGaps: ContentGap[];
  cannibalization: CannibalizationGroup[];
  serpAnalysis: SERPAnalysis;
  deviceAnalysis: DeviceBreakdown[];
  intentAnalysis: IntentBreakdown;
  pageHealth: PageHealth[];
  aiOverviewCandidates: AIOvOverviewCandidate[];
  priorityMatrix: PriorityItem[];
  competitiveGaps: CompetitiveGap[];
  recommendations: string[];
  aiSynthesis?: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK DATA — stratified by position + device adjustment
// ─────────────────────────────────────────────────────────────────────────────

const CTR_BENCHMARKS: Record<number, number> = {
  1: 28.5, 2: 15.2, 3: 9.8, 4: 7.0, 5: 5.4,
  6: 4.2, 7: 3.4, 8: 3.0, 9: 2.6, 10: 2.2,
  11: 1.5, 12: 1.3, 13: 1.1, 14: 0.9, 15: 0.8,
  16: 0.7, 17: 0.6, 18: 0.5, 19: 0.4, 20: 0.3,
};

const MOBILE_CTR_DISCOUNT: Record<number, number> = {
  1: 0.72, 2: 0.75, 3: 0.78, 4: 0.80, 5: 0.82,
  6: 0.83, 7: 0.84, 8: 0.85, 9: 0.85, 10: 0.86,
  11: 0.87, 12: 0.88, 13: 0.88, 14: 0.89, 15: 0.89,
  16: 0.90, 17: 0.90, 18: 0.91, 19: 0.91, 20: 0.92,
};

function getBenchmarkCTR(position: number, isMobile = false): number {
  if (position <= 0) return 0;
  const pos = Math.min(Math.round(position), 20);
  const base = CTR_BENCHMARKS[pos] ?? 0.2;
  if (!isMobile) return base;
  const discount = MOBILE_CTR_DISCOUNT[pos] ?? 0.90;
  return Math.max(base * discount, 0.1);
}

// ─────────────────────────────────────────────────────────────────────────────
// SERP PATTERN DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const SERP_PATTERNS: Array<{ pattern: RegExp; feature: SERPFeature['type']; impact: SERPFeature['impact']; desc: string }> = [
  { pattern: /\b(how to|how do|how can|how does|how is)\b/i, feature: 'featured_snippet', impact: 'negative', desc: 'Featured snippet likely stealing clicks' },
  { pattern: /\b(what is|what are|what does|what's)\b/i, feature: 'featured_snippet', impact: 'negative', desc: 'Featured snippet / People Also Ask competition' },
  { pattern: /\b(why is|why do|why does|why did)\b/i, feature: 'people_also_ask', impact: 'negative', desc: 'People Also Ask stealing clicks' },
  { pattern: /\b(list of|top|bestreviews|best|top 10|top 5)\b/i, feature: 'featured_snippet', impact: 'negative', desc: 'List featured snippet competition' },
  { pattern: /\b(review|reviews|rating|vs |versus|compare)\b/i, feature: 'shopping', impact: 'negative', desc: 'Shopping/Review SERP features' },
  { pattern: /\b(near me|nearby|best.*near|closest)\b/i, feature: 'local_pack', impact: 'positive', desc: 'Local pack opportunity' },
  { pattern: /\b(video|watch|streaming|tutorial)\b/i, feature: 'video', impact: 'negative', desc: 'Video result competition' },
  { pattern: /\b(image|photo|picture|gallery)\b/i, feature: 'image', impact: 'negative', desc: 'Image pack competition' },
  { pattern: /\b(news|latest|breaking|recent)\b/i, feature: 'news', impact: 'neutral', desc: 'News result competition' },
];

function detectSERPFeatures(query: string, position: number): SERPFeature[] {
  if (position > 10) return [];
  return SERP_PATTERNS
    .filter(p => p.pattern.test(query))
    .map(p => ({ type: p.feature, impact: p.impact, description: p.desc }));
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT CLASSIFICATION — enhanced
// ─────────────────────────────────────────────────────────────────────────────

const INTENT_SIGNALS = {
  transactional: [
    'buy', 'price', 'cost', 'pricing', 'discount', 'deal', 'order', 'checkout',
    'purchase', 'quote', 'buy now', 'get started', 'sign up', 'subscribe',
    'free trial', 'demo', 'book now', 'reserve', 'rent', 'lease', 'hire',
    'cheap', 'affordable', 'best price', ' cheapest',
  ],
  commercial: [
    'best', 'top', 'vs ', 'versus', 'compare', 'comparison', 'alternative',
    'review', 'reviews', 'rating', 'ranked', 'ranking', 'recommend',
    'features', 'pros cons', 'pros and cons', 'should i', 'which is better',
  ],
  navigational: [
    'login', 'sign in', 'app', 'download', 'official website', 'homepage',
    'contact us', 'about us', 'youtube', 'facebook', 'twitter', 'linkedin',
  ],
  local: [
    'near me', 'nearby', 'local', 'location', 'store', 'shop hours',
    'directions', 'address', 'phone', 'open now', 'closed', 'hours',
  ],
  informational: [
    'how to', 'how do', 'how can', 'how is', 'how are', 'why is', 'why do',
    'what is', 'what are', 'what does', 'what\'s', 'when is', 'when did',
    'where is', 'where do', 'who is', 'which is', 'guide', 'tutorial',
    'learn', 'understand', 'explain', 'meaning', 'definition', 'example',
  ],
};

function classifyIntent(query: string): IntentProfile {
  const q = query.toLowerCase();
  const words = q.split(/\s+/);

  let intent: IntentProfile['intent'] = 'informational';
  let maxSignals = 0;
  let commercialSignals = 0;
  const questionForm = /^(how|what|why|when|where|who|which|is|can|should)/i.test(q);
  const listIntent = /\b(list|tips|steps|examples|types|ways|ideas|hacks)/i.test(q);

  for (const [intentType, keywords] of Object.entries(INTENT_SIGNALS)) {
    const signals = keywords.filter(k => q.includes(k)).length;
    if (signals > maxSignals) {
      maxSignals = signals;
      intent = intentType as IntentProfile['intent'];
    }
  }

  const categoryMap: Record<string, string> = {
    transactional: 'commerce',
    commercial: 'research',
    navigational: 'discovery',
    local: 'local',
    informational: 'educational',
  };

  return {
    intent,
    category: categoryMap[intent] || 'general',
    commercialSignals,
    questionForm,
    listIntent,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMERCIAL VALUE SCORING (0-100)
// ─────────────────────────────────────────────────────────────────────────────

function scoreCommercialValue(row: GSCRow, intent: IntentProfile): number {
  let score = 50;

  if (intent.intent === 'transactional') score += 30;
  else if (intent.intent === 'commercial') score += 20;
  else if (intent.intent === 'navigational') score += 10;

  if (intent.questionForm) score -= 10;
  if (intent.listIntent) score -= 5;

  const q = row.query.toLowerCase();
  if (/buy|price|discount|deal|cheap/.test(q)) score += 15;
  if (/best|top|vs |comparison|review/.test(q)) score += 10;

  const cvrProxy = row.clicks / Math.max(row.impressions, 1);
  if (cvrProxy > 0.05) score += 10;
  else if (cvrProxy > 0.02) score += 5;

  return Math.max(0, Math.min(100, score));
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAFFIC VALUE SCORING
// ─────────────────────────────────────────────────────────────────────────────

function scoreTrafficValue(row: GSCRow): number {
  const positionWeight = Math.max(0, 10 - row.position) / 10;
  const volumeWeight = Math.log10(row.impressions + 1) / 5;
  const ctrWeight = row.ctr / 100;
  return (positionWeight * 0.4 + volumeWeight * 0.3 + ctrWeight * 0.3) * 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Z-SCORE OUTLIER DETECTION
// ─────────────────────────────────────────────────────────────────────────────

function computeZScores(rows: EnrichedRow[]): EnrichedRow[] {
  const ctvs = rows.map(r => r.ctr);
  const mean = ctvs.reduce((a, b) => a + b, 0) / ctvs.length;
  const variance = ctvs.reduce((s, v) => s + (v - mean) ** 2, 0) / ctvs.length;
  const std = Math.sqrt(variance) || 1;

  return rows.map(r => ({
    ...r,
    zScore: std > 0 ? (r.ctr - mean) / std : 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// CANNIBALIZATION DETECTION
// ─────────────────────────────────────────────────────────────────────────────

interface CannibalizationGroup {
  query: string;
  pages: Array<{
    url: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    shareOfClicks: number;
  }>;
  totalClicks: number;
  totalImpressions: number;
  winnerUrl: string;
  recommendation: string;
  severity: 'critical' | 'high' | 'medium';
}

function detectCannibalization(rows: GSCRow[]): CannibalizationGroup[] {
  const queryMap = new Map<string, GSCRow[]>();

  for (const row of rows) {
    if (!row.query) continue;
    const existing = queryMap.get(row.query) || [];
    existing.push(row);
    queryMap.set(row.query, existing);
  }

  const groups: CannibalizationGroup[] = [];

  for (const [query, pageRows] of queryMap) {
    if (pageRows.length < 2) continue;
    const totalClicks = pageRows.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = pageRows.reduce((s, r) => s + r.impressions, 0);

    const pages = pageRows
      .map(r => ({
        url: r.page,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
        position: r.position,
        shareOfClicks: totalClicks > 0 ? (r.clicks / totalClicks) * 100 : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    const winner = pages[0];
    const spread = pages[pages.length - 1].position - winner.position;
    const severity = spread > 10 ? 'critical' : spread > 5 ? 'high' : 'medium';

    groups.push({
      query,
      pages,
      totalClicks,
      totalImpressions,
      winnerUrl: winner.url,
      severity,
      recommendation: `Consolidate ${pages.length} competing pages for "${query}" — keep winner (${winner.url.split('/').pop()}) with position ${winner.position}, 301-redirect or delist losers`,
    });
  }

  return groups.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OPPORTUNITY TIER CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

function classifyOpportunityTier(row: EnrichedRow): OpportunityTier {
  const { ctrGap, position, impressions, zScore } = row;

  if (position <= 3 && impressions > 500 && ctrGap > 5) return 'critical';
  if (position <= 5 && impressions > 200 && ctrGap > 3) return 'high';
  if (position <= 10 && impressions > 100 && ctrGap > 1) return 'medium';
  return 'low';
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK WINS — positions 4-10 with untapped potential
// ─────────────────────────────────────────────────────────────────────────────

interface QuickWin {
  query: string;
  page: string;
  position: number;
  clicks: number;
  impressions: number;
  currentCTR: number;
  benchmarkCTR: number;
  gapToTop10: number;
  estimatedTrafficGain: number;
  effort: 'low' | 'medium' | 'high';
  action: string;
  intent: string;
}

function findQuickWins(rows: EnrichedRow[]): QuickWin[] {
  return rows
    .filter(r => r.position >= 4 && r.position <= 10 && r.clicks > 10 && r.impressions > 100)
    .map(r => {
      const gapToTop10 = 10 - r.position;
      const estimatedTrafficGain = Math.round(r.impressions * (r.benchmarkCTR - r.ctr) / 100);
      const effort: QuickWin['effort'] = r.position >= 7 ? 'low' : r.position >= 5 ? 'medium' : 'high';

      let action = '';
      if (r.serpFeatures.length > 0) {
        const neg = r.serpFeatures.filter(f => f.impact === 'negative');
        if (neg.length) action = `Address SERP competition: ${neg.map(f => f.description).join('; ')}. `;
      }
      action += r.intent.intent === 'informational' && r.intent.questionForm
        ? `Add FAQ schema + clear answer in first 100 words to win featured snippet`
        : `Optimize title tag (include "${r.query}"), add schema markup, improve internal links`;

      return {
        query: r.query,
        page: r.page,
        position: r.position,
        clicks: r.clicks,
        impressions: r.impressions,
        currentCTR: parseFloat(r.ctr.toFixed(2)),
        benchmarkCTR: parseFloat(r.benchmarkCTR.toFixed(1)),
        gapToTop10,
        estimatedTrafficGain: Math.max(0, estimatedTrafficGain),
        effort,
        action,
        intent: r.intent.intent,
      };
    })
    .sort((a, b) => b.estimatedTrafficGain - a.estimatedTrafficGain)
    .slice(0, 15);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT GAPS
// ─────────────────────────────────────────────────────────────────────────────

interface ContentGap {
  query: string;
  page: string;
  impressions: number;
  position: number;
  zeroClickReason: 'ranking_issue' | 'meta_issue' | 'serp_competition' | 'intent_mismatch';
  fix: string;
  priority: 'critical' | 'high' | 'medium';
}

function findContentGaps(rows: EnrichedRow[]): ContentGap[] {
  return rows
    .filter(r => r.impressions > 100 && r.clicks === 0)
    .map(r => {
      let reason: ContentGap['zeroClickReason'] = 'meta_issue';
      let fix = '';
      let priority: ContentGap['priority'] = 'medium';

      if (r.position > 10) {
        reason = 'ranking_issue';
        priority = r.position > 20 ? 'critical' : 'high';
        fix = `Position ${r.position} — requires off-page SEO: backlinks, content depth, E-E-A-T signals to reach page 1`;
      } else if (r.serpFeatures.some(f => f.impact === 'negative')) {
        reason = 'serp_competition';
        fix = `SERP feature competition detected. Add structured data, optimize for featured snippet, consider video/image supplements`;
      } else if (r.intent.questionForm) {
        reason = 'meta_issue';
        fix = `Question-form query with zero clicks despite ranking — rewrite title/meta to match search intent; add FAQ schema`;
      } else {
        fix = `Title/meta not compelling for this query. A/B test new titles with keyword placement; ensure meta description matches intent`;
      }

      return { query: r.query, page: r.page, impressions: r.impressions, position: r.position, zeroClickReason: reason, fix, priority };
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI OVERVIEW CANDIDATES
// ─────────────────────────────────────────────────────────────────────────────

interface AIOvOverviewCandidate {
  query: string;
  page: string;
  position: number;
  impressions: number;
  ctr: number;
  intent: string;
  eligibility: 'high' | 'medium' | 'low';
  eligibilityScore: number;
  optimizationFocus: string;
  eeatSignals: string[];
  contentFormat: string;
}

function findAIOvCandidates(rows: EnrichedRow[]): AIOvOverviewCandidate[] {
  const PATTERNS = [
    { regex: /\b(how to|how do|how can|how should)\b/i, format: 'How-to guide', weight: 3 },
    { regex: /\b(what is|what are|what does|what's)\b/i, format: 'Definitional', weight: 3 },
    { regex: /\b(why is|why do|why does)\b/i, format: 'Explanation', weight: 2 },
    { regex: /\b(list of|top \d+|best|steps|ways|tips|ideas)\b/i, format: 'Listicle', weight: 2 },
    { regex: /\b(compare|comparison|vs |versus)\b/i, format: 'Comparison', weight: 1 },
    { regex: /\b(problem|solve|fix|troubleshoot|error)\b/i, format: 'Troubleshooting', weight: 2 },
  ];

  return rows
    .filter(r => r.impressions > 50 && r.position <= 20)
    .map(r => {
      const q = r.query.toLowerCase();
      let eligibilityScore = 0;
      let contentFormat = 'Informational';
      const eeatSignals: string[] = [];

      for (const p of PATTERNS) {
        if (p.regex.test(q)) {
          eligibilityScore += p.weight;
          contentFormat = p.format;
        }
      }

      if (r.position <= 3) eligibilityScore += 4;
      else if (r.position <= 5) eligibilityScore += 3;
      else if (r.position <= 10) eligibilityScore += 1;

      if (r.impressions > 500) eligibilityScore += 2;
      else if (r.impressions > 200) eligibilityScore += 1;

      if (r.intent.questionForm) eligibilityScore += 2;
      if (r.intent.listIntent) eligibilityScore += 1;

      if (eligibilityScore >= 7) eeatSignals.push('Expertise (E-E-A-T) demonstrated in content');
      if (r.position <= 5) eeatSignals.push('Authority: position supports credibility');
      if (r.impressions > 200) eeatSignals.push('Trust: high impressions indicate relevance');

      const eligibility: AIOvOverviewCandidate['eligibility'] =
        eligibilityScore >= 7 ? 'high' : eligibilityScore >= 4 ? 'medium' : 'low';

      let optimizationFocus = '';
      if (eligibilityScore >= 7) {
        optimizationFocus = `Position ${r.position} is AI Overview eligible. Structure: H2 intro, step-by-step, FAQ section with Q&A schema. Target 40+ words per section.`;
      } else if (eligibilityScore >= 4) {
        optimizationFocus = `Close to AI Overview eligibility (score ${eligibilityScore}/10). Need top 5 position + better E-E-A-T signals.`;
      } else {
        optimizationFocus = `Low eligibility (score ${eligibilityScore}/10). Focus on ranking improvement first.`;
      }

      return {
        query: r.query,
        page: r.page,
        position: r.position,
        impressions: r.impressions,
        ctr: parseFloat(r.ctr.toFixed(2)),
        intent: r.intent.intent,
        eligibility,
        eligibilityScore,
        optimizationFocus,
        eeatSignals,
        contentFormat,
      };
    })
    .filter(r => r.eligibilityScore >= 3)
    .sort((a, b) => b.eligibilityScore - a.eligibilityScore)
    .slice(0, 20);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY MATRIX — opportunity × commercial value × effort
// ─────────────────────────────────────────────────────────────────────────────

interface PriorityItem {
  query: string;
  page: string;
  opportunityScore: number;
  commercialValue: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'critical' | 'high' | 'medium' | 'low';
  category: 'ctr' | 'content_gap' | 'cannibalization' | 'position' | 'serp';
  recommendedAction: string;
  timeToValue: string;
}

function buildPriorityMatrix(rows: EnrichedRow[], cGroups: CannibalizationGroup[]): PriorityItem[] {
  const cannibalQueries = new Set(cGroups.map(c => c.query));

  const items = rows
    .filter(r => r.impressions > 50)
    .map(r => {
      let category: PriorityItem['category'] = 'ctr';
      let recommendedAction = '';
      let timeToValue = '';

      if (cannibalQueries.has(r.query)) {
        category = 'cannibalization';
        recommendedAction = `Cannibalization detected — consolidate competing URLs`;
        timeToValue = '2-4 weeks';
      } else if (r.clicks === 0 && r.impressions > 100) {
        category = 'content_gap';
        recommendedAction = 'Add FAQ schema; rewrite meta to match search intent';
        timeToValue = '1-4 weeks';
      } else if (r.serpFeatures.some(f => f.impact === 'negative') && r.position <= 10) {
        category = 'serp';
        recommendedAction = `Address SERP feature competition — ${r.serpFeatures[0]?.description}`;
        timeToValue = '2-6 weeks';
      } else if (r.position >= 4 && r.position <= 10) {
        category = 'position';
        recommendedAction = `Optimize to push into top 3: schema, internal links, content quality`;
        timeToValue = '4-8 weeks';
      } else if (r.ctrRatio < 0.5) {
        category = 'ctr';
        recommendedAction = `Title/meta rewrite recommended — CTR is ${r.ctrRatio.toFixed(1)}x below benchmark`;
        timeToValue = '1-2 weeks';
      }

      const effortScore = r.position <= 5 ? 3 : r.position <= 10 ? 2 : 1;
      const impact: PriorityItem['impact'] = r.commercialValue > 70 ? 'critical' : r.commercialValue > 50 ? 'high' : r.commercialValue > 30 ? 'medium' : 'low';
      const effort: PriorityItem['effort'] = effortScore >= 3 ? 'low' : effortScore >= 2 ? 'medium' : 'high';

      return {
        query: r.query,
        page: r.page,
        opportunityScore: Math.round(r.priorityScore),
        commercialValue: r.commercialValue,
        effort,
        impact,
        category,
        recommendedAction,
        timeToValue,
      };
    })
    .filter(r => r.category !== undefined)
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  return items.slice(0, 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE & SERP ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

interface DeviceBreakdown {
  device: string;
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
  avgPosition: number;
  topPages: Array<{ url: string; clicks: number; impressions: number }>;
  opportunityCount: number;
}

interface SERPAnalysis {
  totalFeaturesIdentified: number;
  byType: Record<string, number>;
  impactOnCTR: Record<string, number>;
  recommendations: string[];
}

function analyzeDevices(rows: GSCRow[]): DeviceBreakdown[] {
  const deviceMap = new Map<string, GSCRow[]>();
  for (const row of rows) {
    const device = row.device || 'unknown';
    const existing = deviceMap.get(device) || [];
    existing.push(row);
    deviceMap.set(device, existing);
  }

  return Array.from(deviceMap.entries()).map(([device, deviceRows]) => {
    const totalClicks = deviceRows.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = deviceRows.reduce((s, r) => s + r.impressions, 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgPosition = deviceRows.reduce((s, r) => s + r.position, 0) / deviceRows.length;
    const topPages = deviceRows
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5)
      .map(r => ({ url: r.page, clicks: r.clicks, impressions: r.impressions }));
    const opportunityCount = deviceRows.filter(r => r.impressions > 100 && r.ctr < 2 && r.position <= 10).length;

    return { device, totalClicks, totalImpressions, avgCTR, avgPosition, topPages, opportunityCount };
  });
}

function analyzeSERP(rows: EnrichedRow[]): SERPAnalysis {
  const featureCounts: Record<string, number> = {};
  const impactOnCTR: Record<string, number> = {};

  for (const r of rows) {
    for (const f of r.serpFeatures) {
      featureCounts[f.type] = (featureCounts[f.type] || 0) + 1;
      if (f.impact === 'negative') {
        impactOnCTR[f.type] = (impactOnCTR[f.type] || 0) + r.impressions;
      }
    }
  }

  const recommendations: string[] = [];
  if (featureCounts['featured_snippet']) recommendations.push(`${featureCounts['featured_snippet']} queries face featured snippet competition — optimize for position 1 to appear`);
  if (featureCounts['people_also_ask']) recommendations.push(`${featureCounts['people_also_ask']} queries compete in People Also Ask — structured Q&A format needed`);
  if (featureCounts['video']) recommendations.push(`${featureCounts['video']} queries have video competition — consider adding video content or YouTube optimization`);
  if (featureCounts['local_pack']) recommendations.push(`${featureCounts['local_pack']} local queries detected — claim/optimize Google Business Profile`);
  if (featureCounts['shopping']) recommendations.push(`${featureCounts['shopping']} shopping queries — consider Product schema markup`);

  return { totalFeaturesIdentified: Object.values(featureCounts).reduce((s, v) => s + v, 0), byType: featureCounts, impactOnCTR, recommendations };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HEALTH SCORING
// ─────────────────────────────────────────────────────────────────────────────

interface PageHealth {
  url: string;
  totalQueries: number;
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
  avgPosition: number;
  healthScore: number;
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: string[];
  potentialClicksGain: number;
}

function scorePageHealth(rows: GSCRow[]): PageHealth[] {
  const pageMap = new Map<string, GSCRow[]>();
  for (const row of rows) {
    const existing = pageMap.get(row.page) || [];
    existing.push(row);
    pageMap.set(row.page, existing);
  }

  return Array.from(pageMap.entries())
    .map(([url, pageRows]) => {
      const totalClicks = pageRows.reduce((s, r) => s + r.clicks, 0);
      const totalImpressions = pageRows.reduce((s, r) => s + r.impressions, 0);
      const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const avgPosition = pageRows.reduce((s, r) => s + r.position, 0) / pageRows.length;
      const totalQueries = pageRows.length;

      let healthScore = 50;
      const issues: string[] = [];
      let potentialClicksGain = 0;

      if (avgPosition <= 3) { healthScore += 30; }
      else if (avgPosition <= 5) { healthScore += 20; }
      else if (avgPosition <= 10) { healthScore += 10; }
      else { issues.push('Average ranking beyond page 1'); }

      if (avgCTR >= 5) { healthScore += 20; }
      else if (avgCTR >= 2) { healthScore += 10; }
      else if (avgCTR < 1) { issues.push('Low CTR indicates title/meta mismatch'); }

      const zeroClickRows = pageRows.filter(r => r.clicks === 0 && r.impressions > 0);
      if (zeroClickRows.length > 3) issues.push(`${zeroClickRows.length} queries with zero clicks — content-intent mismatch`);

      const potentialBenchmarkCTR = pageRows.reduce((s, r) => s + getBenchmarkCTR(r.position) * r.impressions, 0) / Math.max(totalImpressions, 1);
      potentialClicksGain = Math.round(totalImpressions * (potentialBenchmarkCTR - avgCTR) / 100);

      const grade: PageHealth['healthGrade'] =
        healthScore >= 90 ? 'A' : healthScore >= 75 ? 'B' : healthScore >= 60 ? 'C' : healthScore >= 40 ? 'D' : 'F';

      return { url, totalQueries, totalClicks, totalImpressions, avgCTR: parseFloat(avgCTR.toFixed(2)), avgPosition: parseFloat(avgPosition.toFixed(1)), healthScore: Math.min(100, healthScore), healthGrade: grade, issues, potentialClicksGain: Math.max(0, potentialClicksGain) };
    })
    .filter(p => p.totalImpressions > 0)
    .sort((a, b) => b.potentialClicksGain - a.potentialClicksGain);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPETITIVE GAPS — queries where position is close to a benchmark tier jump
// ─────────────────────────────────────────────────────────────────────────────

interface CompetitiveGap {
  query: string;
  page: string;
  position: number;
  nextTierPosition: number;
  clicksAboveTier: number;
  impressionsAboveTier: number;
  gapDescription: string;
  action: string;
}

function findCompetitiveGaps(rows: EnrichedRow[]): CompetitiveGap[] {
  const TIER_JUMPS = [1, 3, 5, 7, 10, 15, 20];

  return rows
    .filter(r => r.position > 0 && r.impressions > 50)
    .map(r => {
      const nextTier = TIER_JUMPS.find(t => t > r.position) || 21;
      const gapToNext = nextTier - r.position;
      const benchmarkAtNext = getBenchmarkCTR(nextTier);
      const clicksAboveTier = Math.round(r.impressions * (benchmarkAtNext - r.ctr) / 100);
      const impressionsAboveTier = r.impressions;

      let gapDescription = '';
      if (nextTier === 3) gapDescription = `1 more position to top 3 (${getBenchmarkCTR(3)}% avg CTR vs ${r.ctr.toFixed(1)}% current)`;
      else if (nextTier === 5) gapDescription = `Within reach of page 1 top 5 (${getBenchmarkCTR(5)}% avg CTR)`;
      else if (nextTier === 10) gapDescription = `On the cusp of page 1 (${getBenchmarkCTR(10)}% avg CTR vs ${r.ctr.toFixed(1)}% current)`;
      else gapDescription = `${gapToNext} positions from top ${nextTier} (${getBenchmarkCTR(nextTier)}% CTR target)`;

      const action = nextTier <= 5
        ? `High-value gap: optimize title + meta + schema to push into top ${nextTier}`
        : `Content improvement + backlinks to close ${gapToNext}-position gap`;

      return {
        query: r.query,
        page: r.page,
        position: r.position,
        nextTierPosition: nextTier,
        clicksAboveTier: Math.max(0, clicksAboveTier),
        impressionsAboveTier,
        gapDescription,
        action,
      };
    })
    .filter(g => g.clicksAboveTier > 0)
    .sort((a, b) => b.clicksAboveTier - a.clicksAboveTier)
    .slice(0, 15);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI FETCH HELPER
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callMiniMax(systemPrompt: string, userContent: string): Promise<string> {
  const BASE_URL = process.env.ANTHROPIC_BASE_URL || process.env.OPENROUTER_BASE_URL || "https://api.minimax.io/anthropic";
  const API_KEY = process.env.ANTHROPIC_AUTH_TOKEN || process.env.OPENROUTER_API_KEY || "";
  const MODEL = process.env.ANTHROPIC_MODEL || "MiniMax-M2.7";
  if (!API_KEY) throw new Error("AI API key not configured");

  const resp = await fetchWithTimeout(`${BASE_URL}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}`, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, stream: false, system: systemPrompt, messages: [{ role: "user", content: userContent }] }),
  }, AI_TIMEOUT_MS);

  const responseText = await resp.text();
  if (!resp.ok) {
    let errorMsg = `AI API error ${resp.status}: ${responseText}`;
    try { const p = JSON.parse(responseText); if (p.error?.error?.message) errorMsg = p.error.error.message; else if (p.error?.message) errorMsg = p.error.message; } catch {}
    throw new Error(errorMsg);
  }
  const data = JSON.parse(responseText);
  if (data.error) throw new Error(data.error?.error?.message || data.error?.message || JSON.stringify(data.error));
  return data.content?.map((b: { text?: string }) => b.text || "").join("") || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN POST HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { data: rows, options } = await req.json() as { data: GSCRow[]; options?: { siteUrl?: string; startDate?: string; endDate?: string } };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'data (array of GSC rows) is required' }, { status: 400 });
    }

    const totalRows = rows.length;
    const totalClicks = rows.reduce((s, r) => s + (r.clicks || 0), 0);
    const totalImpressions = rows.reduce((s, r) => s + (r.impressions || 0), 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgPosition = rows.reduce((s, r) => s + (r.position || 0), 0) / rows.length;

    // ─── Enrich every row ─────────────────────────────────────────────────
    const enriched: EnrichedRow[] = rows.map(r => {
      const intent = classifyIntent(r.query);
      const benchmarkCTR = getBenchmarkCTR(r.position);
      const ctrGap = benchmarkCTR - r.ctr;
      const ctrRatio = benchmarkCTR > 0 ? r.ctr / benchmarkCTR : 0;
      const serpFeatures = detectSERPFeatures(r.query, r.position);
      const commercialValue = scoreCommercialValue(r, intent);
      const trafficValue = scoreTrafficValue(r);
      const positionMomentum = r.position >= 4 && r.position <= 10 ? (10 - r.position) * 10 : 0;
      const priorityScore = (trafficValue * 0.35) + (commercialValue * 0.25) + (positionMomentum * 0.20) + (Math.max(0, ctrGap) * 2);

      return {
        ...r,
        benchmarkCTR,
        ctrGap,
        ctrRatio,
        zScore: 0,
        intent,
        commercialValue,
        trafficValue,
        priorityScore,
        opportunityTier: 'low' as OpportunityTier,
        serpFeatures,
        isCannibalized: false,
        cannibalPages: [],
        trendDirection: 'stable' as const,
      };
    });

    // Compute z-scores and classify tiers
    const withZScores = computeZScores(enriched)
      .map(r => ({ ...r, opportunityTier: classifyOpportunityTier(r) }));

    // Mark cannibalized rows
    const cannibalGroups = detectCannibalization(rows);
    const cannibalQuerySet = new Set(cannibalGroups.map(c => c.query));
    const withCannibal = withZScores.map(r => ({
      ...r,
      isCannibalized: cannibalQuerySet.has(r.query),
      cannibalPages: cannibalGroups.find(c => c.query === r.query)?.pages.map(p => p.url) || [],
    }));

    // ─── Device breakdown ───────────────────────────────────────────────
    const deviceAnalysis = analyzeDevices(rows);

    // ─── SERP Analysis ──────────────────────────────────────────────────
    const serpAnalysis = analyzeSERP(withCannibal);

    // ─── Core analysis blocks ────────────────────────────────────────────
    const quickWins = findQuickWins(withCannibal);
    const contentGaps = findContentGaps(withCannibal);
    const aiOverviewCandidates = findAIOvCandidates(withCannibal);
    const competitiveGaps = findCompetitiveGaps(withCannibal);
    const priorityMatrix = buildPriorityMatrix(withCannibal, cannibalGroups);
    const pageHealth = scorePageHealth(rows);

    // ─── Intent breakdown ───────────────────────────────────────────────
    const intentCounts: Record<string, number> = { informational: 0, transactional: 0, navigational: 0, commercial: 0, local: 0 };
    const intentClicks: Record<string, number> = { informational: 0, transactional: 0, navigational: 0, commercial: 0, local: 0 };
    const intentImpressions: Record<string, number> = { informational: 0, transactional: 0, navigational: 0, commercial: 0, local: 0 };
    for (const r of withCannibal) {
      intentCounts[r.intent.intent]++;
      intentClicks[r.intent.intent] += r.clicks;
      intentImpressions[r.intent.intent] += r.impressions;
    }
    const intentAnalysis: IntentBreakdown = {
      distribution: intentCounts,
      clicksByIntent: intentClicks,
      impressionsByIntent: intentImpressions,
      commercialRatio: Math.round((intentCounts.commercial + intentCounts.transactional) / Math.max(totalRows, 1) * 100),
    };

    // ─── Overview metrics ───────────────────────────────────────────────
    const benchmarkClicks = rows.reduce((s, r) => s + r.impressions * (getBenchmarkCTR(r.position) / 100), 0);
    const potentialClicksGain = Math.round(benchmarkClicks - totalClicks);

    const ctrAnalysis: CTRAnalysis = {
      overallCTR: parseFloat(avgCTR.toFixed(2)),
      benchmarkCTR: parseFloat((benchmarkClicks / Math.max(totalImpressions, 1) * 100).toFixed(2)),
      gap: parseFloat((benchmarkClicks / Math.max(totalImpressions, 1) * 100 - avgCTR).toFixed(2)),
      atBenchmark: rows.filter(r => { const b = getBenchmarkCTR(r.position); return b > 0 && r.ctr / b >= 0.8 && r.ctr / b <= 1.2; }).length,
      aboveBenchmark: rows.filter(r => { const b = getBenchmarkCTR(r.position); return b > 0 && r.ctr / b > 1.2; }).length,
      belowBenchmark: rows.filter(r => { const b = getBenchmarkCTR(r.position); return b > 0 && r.ctr / b < 0.8; }).length,
      criticalGaps: withCannibal.filter(r => r.ctrRatio < 0.5 && r.impressions > 200).length,
      zeroClickQueries: rows.filter(r => r.impressions > 0 && r.clicks === 0).length,
      zeroClickRate: parseFloat(((rows.filter(r => r.impressions > 0 && r.clicks === 0).length / Math.max(totalRows, 1)) * 100).toFixed(1)),
    };

    const overview: OverviewMetrics = {
      totalQueries: totalRows,
      totalClicks,
      totalImpressions,
      avgCTR: parseFloat(avgCTR.toFixed(2)),
      avgPosition: parseFloat(avgPosition.toFixed(1)),
      potentialClicksGain,
      benchmarkClicks: Math.round(benchmarkClicks),
      cannibalizedQueries: cannibalGroups.length,
      zeroClickQueries: ctrAnalysis.zeroClickQueries,
    };

    // ─── Recommendations ────────────────────────────────────────────────
    const recommendations: string[] = [];
    if (ctrAnalysis.criticalGaps > 0) recommendations.push(`⚠️ ${ctrAnalysis.criticalGaps} queries have CTR <50% of benchmark — title/meta rewrite priority`);
    if (quickWins.length > 0) recommendations.push(`🎯 ${quickWins.length} quick wins in positions 4-10 — estimated +${quickWins.reduce((s, w) => s + w.estimatedTrafficGain, 0)} clicks`);
    if (contentGaps.length > 0) recommendations.push(`📝 ${contentGaps.length} content gaps with zero clicks — review meta + content-intent alignment`);
    if (cannibalGroups.length > 0) recommendations.push(`🔗 ${cannibalGroups.length} cannibalization issues — consolidate competing URLs`);
    if (aiOverviewCandidates.filter(a => a.eligibility === 'high').length > 0) recommendations.push(`🤖 ${aiOverviewCandidates.filter(a => a.eligibility === 'high').length} high-eligibility AI Overview candidates`);
    if (competitiveGaps.length > 0) recommendations.push(`📈 ${competitiveGaps.length} competitive gaps near tier boundaries — backlink + content push could close gap`);
    if (pageHealth.filter(p => p.healthGrade === 'F' || p.healthGrade === 'D').length > 0) recommendations.push(`🏥 ${pageHealth.filter(p => p.healthGrade === 'F' || p.healthGrade === 'D').length} pages graded D/F — requires urgent content audit`);

    // ─── AI Agentic Synthesis ────────────────────────────────────────────
    let aiSynthesis: Record<string, unknown> | undefined;
    try {
      const topQ = quickWins.slice(0, 5);
      const topGaps = contentGaps.slice(0, 5);
      const topCAnn = cannibalGroups.slice(0, 3);

      const aiPrompt = `You are an expert SEO strategist. Analyze this comprehensive GSC data and produce an executive strategy brief.

## Site Overview
- Total Queries: ${totalRows.toLocaleString()}
- Total Clicks: ${totalClicks.toLocaleString()}
- Total Impressions: ${totalImpressions.toLocaleString()}
- Average CTR: ${avgCTR.toFixed(2)}% (Benchmark: ${(benchmarkClicks / Math.max(totalImpressions, 1) * 100).toFixed(2)}%)
- Average Position: ${avgPosition.toFixed(1)}
- Potential Clicks at Benchmark: ${Math.round(benchmarkClicks).toLocaleString()} (+${potentialClicksGain} possible)
- Cannibalization Issues: ${cannibalGroups.length}
- Zero-Click Queries: ${ctrAnalysis.zeroClickQueries} (${ctrAnalysis.zeroClickRate}%)

## Intent Distribution
${JSON.stringify(intentAnalysis.distribution)}

## CTR Performance
- At Benchmark (80-120% of expected): ${ctrAnalysis.atBenchmark} queries
- Above Benchmark (>120%): ${ctrAnalysis.aboveBenchmark} queries
- Below Benchmark (<80%): ${ctrAnalysis.belowBenchmark} queries
- Critical CTR Gaps: ${ctrAnalysis.criticalGaps} queries

## Top 5 Quick Wins (Positions 4-10)
${topQ.map(w => `Query: "${w.query}" | Pos: ${w.position} | CTR: ${w.currentCTR}% | Benchmark: ${w.benchmarkCTR}% | Est gain: +${w.estimatedTrafficGain} clicks/mo | Effort: ${w.effort}`).join('\n')}

## Top 5 Content Gaps (Zero Clicks)
${topGaps.map(g => `Query: "${g.query}" | Impressions: ${g.impressions} | Pos: ${g.position} | Reason: ${g.zeroClickReason} | Fix: ${g.fix}`).join('\n')}

## Cannibalization Issues
${topCAnn.length > 0 ? topCAnn.map(c => `Query: "${c.query}" | ${c.pages.length} pages competing | Winner: ${c.winnerUrl.split('/').pop()} | Severity: ${c.severity}`).join('\n') : 'None detected'}

## AI Overview Candidates (Top 5)
${aiOverviewCandidates.slice(0, 5).map(a => `Query: "${a.query}" | Pos: ${a.position} | Score: ${a.eligibilityScore}/10 | Format: ${a.contentFormat} | ${a.optimizationFocus}`).join('\n')}

## Competitive Gaps (Top 5)
${competitiveGaps.slice(0, 5).map(g => `Query: "${g.query}" | Pos: ${g.position} | Gap: ${g.gapDescription}`).join('\n')}

## Page Health (Worst 5)
${pageHealth.slice(-5).map(p => `URL: ${p.url.split('/').pop()} | Grade: ${p.healthGrade} | Score: ${p.healthScore}/100 | Issues: ${p.issues.join(', ')}`).join('\n')}

Provide a strategic response as JSON with:
{
  "executiveSummary": "3-4 sentence strategic overview of the site's SEO health and biggest opportunities",
  "criticalFindings": ["Top 3 most impactful issues ranked by monthly click opportunity"],
  "winningStrategy": "Detailed recommended approach combining quick wins, content gaps, and cannibalization fixes into a phased action plan",
  "aiOverviewBlueprint": "Specific content restructuring recommendations to maximize AI Overview eligibility",
  "investmentPriority": "Ranked list of efforts by ROI potential — for each: action, expected clicks gained, difficulty",
  "riskFactors": ["2-3 potential pitfalls or things that could go wrong with the strategy"]
}`;

      const aiText = await callMiniMax("You are an elite SEO strategist. Return ONLY valid JSON matching the requested schema. No markdown, no explanation.", aiPrompt);
      try { aiSynthesis = JSON.parse(aiText); } catch { aiSynthesis = { raw: aiText }; }
    } catch (aiErr) {
      console.warn('AI synthesis failed:', aiErr);
    }

    const result: AnalysisResult = {
      overview,
      ctrAnalysis,
      quickWins,
      contentGaps,
      cannibalization: cannibalGroups.slice(0, 10),
      serpAnalysis,
      deviceAnalysis,
      intentAnalysis,
      pageHealth: pageHealth.slice(0, 20),
      aiOverviewCandidates,
      priorityMatrix,
      competitiveGaps,
      recommendations,
      aiSynthesis,
      metadata: {
        analyzedAt: new Date().toISOString(),
        rowsAnalyzed: totalRows,
        siteUrl: options?.siteUrl || 'unknown',
        dateRange: `${options?.startDate || 'N/A'} to ${options?.endDate || 'N/A'}`,
        analysisMode: aiSynthesis ? 'hybrid' : 'rule-based',
      },
    };

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONAL TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface OverviewMetrics {
  totalQueries: number;
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
  avgPosition: number;
  potentialClicksGain: number;
  benchmarkClicks: number;
  cannibalizedQueries: number;
  zeroClickQueries: number;
}

interface CTRAnalysis {
  overallCTR: number;
  benchmarkCTR: number;
  gap: number;
  atBenchmark: number;
  aboveBenchmark: number;
  belowBenchmark: number;
  criticalGaps: number;
  zeroClickQueries: number;
  zeroClickRate: number;
}

interface IntentBreakdown {
  distribution: Record<string, number>;
  clicksByIntent: Record<string, number>;
  impressionsByIntent: Record<string, number>;
  commercialRatio: number;
}
// ─── Shared Types ────────────────────────────────────────────────────────────
// All type definitions extracted from the monolithic page.tsx

export interface GSCRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  estimatedClicksLost?: number;
  fix?: string;
}

export interface Report {
  id: number;
  report_type: string;
  title: string;
  data: unknown;
  summary?: unknown;
  created_at: string;
}

export interface GSCResult {
  overview: {
    totalQueries: number;
    totalClicks: number;
    totalImpressions: number;
    avgCTR: number;
    avgPosition: number;
    potentialClicksGain: number;
    benchmarkClicks: number;
    cannibalizedQueries: number;
    zeroClickQueries: number;
  };
  ctrAnalysis: {
    overallCTR: number;
    benchmarkCTR: number;
    gap: number;
    atBenchmark: number;
    aboveBenchmark: number;
    belowBenchmark: number;
    criticalGaps: number;
    zeroClickQueries: number;
    zeroClickRate: number;
  };
  quickWins: Array<{
    query: string;
    page: string;
    position: number;
    clicks: number;
    impressions: number;
    estimatedTrafficGain: number;
    effort: "low" | "medium" | "high";
    action: string;
    currentCTR: number;
    benchmarkCTR: number;
    intent: string;
  }>;
  contentGaps: Array<{
    query: string;
    page: string;
    impressions: number;
    position: number;
    zeroClickReason: string;
    fix: string;
    priority: string;
  }>;
  cannibalization: Array<{
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
    severity: 'critical' | 'high' | 'medium';
    recommendation: string;
  }>;
  serpAnalysis: {
    totalFeaturesIdentified: number;
    byType: Record<string, number>;
    impactOnCTR: Record<string, number>;
    recommendations: string[];
  };
  deviceAnalysis: Array<{
    device: string;
    totalClicks: number;
    totalImpressions: number;
    avgCTR: number;
    avgPosition: number;
    topPages: Array<{ url: string; clicks: number; impressions: number }>;
    opportunityCount: number;
  }>;
  intentAnalysis: {
    distribution: Record<string, number>;
    clicksByIntent: Record<string, number>;
    impressionsByIntent: Record<string, number>;
    commercialRatio: number;
  };
  pageHealth: Array<{
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
  }>;
  aiOverviewCandidates: Array<{
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
  }>;
  priorityMatrix: Array<{
    query: string;
    page: string;
    opportunityScore: number;
    commercialValue: number;
    effort: 'low' | 'medium' | 'high';
    impact: 'critical' | 'high' | 'medium' | 'low';
    category: 'ctr' | 'content_gap' | 'cannibalization' | 'position' | 'serp';
    recommendedAction: string;
    timeToValue: string;
  }>;
  competitiveGaps: Array<{
    query: string;
    page: string;
    position: number;
    nextTierPosition: number;
    clicksAboveTier: number;
    impressionsAboveTier: number;
    gapDescription: string;
    action: string;
  }>;
  recommendations: string[];
  aiSynthesis?: {
    executiveSummary?: string;
    criticalFindings?: string[];
    winningStrategy?: string;
    aiOverviewBlueprint?: string;
    investmentPriority?: string[];
  };
}

export interface CTRResult {
  titleVariants: Array<{
    title: string;
    predictedCTR: string;
    reasoning?: string;
  }>;
  metaVariants: Array<{
    text: string;
    charCount: number;
    cta: string;
    predictedCTR: string;
  }>;
  schemaMarkup: string;
  keyword: string;
  searchIntent: string;
}

export interface KeywordResult {
  topGroups: Array<{
    keyword: string;
    volume: number;
    cpc: number;
    difficulty: number;
    opportunity: string;
    modifiers: Array<{ keyword: string; volume: number }>;
  }>;
  questionKeywords: Array<{
    keyword: string;
    volume: number;
    cpc: number;
    intent: string;
    bestFormat: string;
  }>;
  topic: string;
}

export interface TopicResult {
  clusterStructure: Array<{
    name: string;
    keywords: string[];
    weight: number;
  }>;
  internalLinkSuggestions: Array<{
    from: string;
    to: string;
    anchor: string;
    strength: string;
  }>;
  pillarTopic: string;
}

export interface FilterResult {
  intentDistribution: Array<{
    intent: string;
    count: number;
    impressions: number;
    clicks: number;
    avgCTR: number;
  }>;
  ctrGaps: Array<{
    query: string;
    page: string;
    impressions: number;
    ctr: number;
    position: number;
    ctrGap: number;
    potentialClicks: number;
    fix: string;
  }>;
  cannibalization: Array<{
    query: string;
    urls: Array<{ url: string; position: number; clicks: number; ctr: number }>;
    recommendation: string;
  }>;
  executiveSummary: string;
  top5Opportunities: Array<Record<string, unknown>>;
  actionPlan: string[];
  totalFiltered: number;
  regexFilter: string;
}

export interface IndexResult {
  patternGroups: Array<{
    pattern: string;
    patternLabel: string;
    count: number;
    urls: string[];
    diagnosis: string;
    resolution: string;
    priority: string;
  }>;
  executiveSummary: string;
  quickFixes: string[];
  totalUrls: number;
  uniquePatterns: number;
}

export interface CrawlResult {
  statusGroups: Array<{
    code: string;
    percentage: number;
    status: string;
    recommendation: string;
  }>;
  fileGroups: Array<{
    type: string;
    percentage: number;
    status: string;
    recommendation: string;
  }>;
  purposeGroups: Array<{
    purpose: string;
    percentage: number;
    status: string;
    recommendation: string;
  }>;
  issues: Array<{
    category: string;
    severity: string;
    description: string;
    fix: string;
    devOpsChecklist?: string[];
  }>;
  severitySummary: { label: string; count: number; color: string };
  executiveSummary: string;
}

export interface GEOResult {
  topPillars: Array<{
    name: string;
    queries: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
    totalImpressions: number;
    avgPosition: number;
    avgCTR: number;
    dominantFormat: string;
  }>;
  momentumPatterns: Array<{
    format: string;
    avgCTR: number;
    sampleQueries: string[];
  }>;
  programmaticGaps: Array<{
    modifier: string;
    volume: number;
    ctr: number;
    recommendation: string;
  }>;
  newContentBlueprints: Array<{
    niche: string;
    targetQuery: string;
    suggestedTitle: string;
    format: string;
    geoOptimizations: string[];
    aeoOptimizations: string[];
  }>;
  geoRules: string[];
  aeoRules: string[];
  siteBaseline: {
    totalImpressions: number;
    avgPosition: number;
    avgCTR: number;
    totalClicks: number;
  };
}

export interface SitemapResult {
  success: boolean;
  validated: boolean;
  sitemapUrl: string;
  validationStatus: number | null;
  validationMessage: string;
  pingStatus: number | null;
  pingMessage: string;
  pingedAt: string | null;
}

// ─── Premium Types ──────────────────────────────────────────────────────────────────

export type ExpertiseLevel = 'beginner' | 'intermediate' | 'expert';

export type ActionType =
  | 'cannibalization_fix'
  | 'ai_overview_pivot'
  | 'snippet_rewrite'
  | 'declining_near_p1'
  | 'technical_review'
  | 'quick_win_content'
  | 'content_creation'
  | 'monitor';

export type EffortLevel = 'low' | 'medium' | 'high';

export interface ActionStep {
  stepNumber: number;
  title: string;
  description: string;
  timeEstimate: string;
  expectedLift: string;
}

export interface ActionPlan {
  actionType: ActionType;
  priority: 1 | 2 | 3 | 4 | 5 | 10;
  effort: EffortLevel;
  estimatedGain: number;
  effortLabel: string;
  steps: ActionStep[];
}

export interface OpportunityItem {
  id?: number;
  query: string;
  page: string;
  position: number;
  ctr: number;
  impressions: number;
  clicks: number;
  score: number;               // 0–100 composite
  priority: number;
  effort: EffortLevel;
  estimatedGain: number;       // clicks/month
  actionType: ActionType;
  actionPlan?: ActionPlan;
  aiRisk?: number;             // 0–100
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  components?: {
    A_traffic: number;
    B_ctrGap: number;
    C_effort: number;
    D_trend: number;
  };
}

export interface TrendResult {
  slope: number;
  intercept: number;
  r2: number;
  pValue: number;
  momentum: number;
  volatility: 'stable' | 'unstable' | 'volatile';
  direction: 'strong_rise' | 'moderate_rise' | 'stable' | 'moderate_fall' | 'strong_fall';
  seasonalFlag: boolean;
  forecastedPosition: number;
  cv: number;
  dataPoints: number;
}

export interface AIOverviewRiskResult {
  riskScore: number;
  riskTier: 'standard' | 'featured_snippet_target' | 'data_pivot' | 'deprioritize';
  signals: string[];
  signalBreakdown: {
    ctrSuppression: number;
    intentPenalty: number;
    trendDecline: number;
    questionPattern: number;
    impressionVolume: number;
  };
  counterStrategy: string;
  geminiCheckRecommended: boolean;
}

export interface HealthDimension {
  name: string;
  weight: number;
  score: number;
  label: string;
}

export interface HealthScoreResult {
  overallScore: number;
  dimensions: HealthDimension[];
  weeklyDelta: number | null;
  trend: '↑ Rising' | '→ Stable' | '↓ Declining';
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalOpportunities: number;
  resolvedThisWeek: number;
  estimatedMonthlyGain: number;
}

export interface ClusterResult {
  clusterId: number;
  label: string;
  queries: string[];
  pages: string[];
  pillarPage: string | null;
  orphanPages: string[];
  health: number;
  totalImpressions: number;
  totalClicks: number;
  avgPosition: number;
  avgCTR: number;
  gaps: string[];
}

export interface ProgressRecord {
  opportunityId: number;
  query: string;
  actionType: ActionType;
  shouldResolve: boolean;
  reason: string;
  method: 'auto_detected' | 'manually_marked';
}

export interface ContentBrief {
  h1: string;
  targetWordCount: number;
  contentAngle: string;
  recommendedSchema: string;
  outline: Array<{
    h2: string;
    h3s: string[];
    notes: string;
  }>;
  internalLinks: string[];
  competitorGaps: string[];
}

export interface TitleVariant {
  title: string;
  predictedLiftPercent: number;
  powerWords: string[];
  type: string;
}

export interface AIActionPlanResponse {
  query: string;
  page: string;
  actionType: ActionType;
  summary: string;
  steps: ActionStep[];
  estimatedGain: string;
  timeToValue: string;
}


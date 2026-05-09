/**
 * SEO Explainers — Educational content strings
 * Used by tooltips, glossary drawer, and "Why This Matters" panels.
 * Content adapts to ExpertiseLevel: beginner | intermediate | expert
 */

export type ExpertiseLevel = 'beginner' | 'intermediate' | 'expert';

export interface Explainer {
  term: string;
  shortDef: string;           // 1 sentence — always shown
  beginner: string;           // plain English, no assumed knowledge
  intermediate: string;       // assumes basic SEO awareness
  expert: string;             // technical, no hand-holding
  learnMoreUrl?: string;
  whyItMatters: string;       // section header panel copy
}

// ─── 40+ Term Glossary ────────────────────────────────────────────────────────

export const SEO_EXPLAINERS: Record<string, Explainer> = {
  ctr: {
    term: 'CTR (Click-Through Rate)',
    shortDef: '% of searchers who clicked your result after seeing it',
    beginner: 'Imagine 100 people see your website in search results. If 5 of them click on it, your CTR is 5%. A higher CTR means your title and description are convincing people to visit your site.',
    intermediate: 'CTR = clicks / impressions × 100. It\'s a proxy for how compelling your title tag and meta description are relative to competitors at the same SERP position.',
    expert: 'CTR is position-normalised using the industry benchmark curve. A CTR below benchmark at a given position indicates title/meta mismatch, SERP feature displacement (AI Overview, PAA), or intent misalignment.',
    whyItMatters: 'Even without improving your ranking, fixing a CTR gap can bring dozens or hundreds of extra visitors per month — for free.',
  },
  position: {
    term: 'Position (Ranking)',
    shortDef: 'Average rank on Google results page (1 = top, lower is better)',
    beginner: 'Your "position" is where your website shows up in Google search. Position 1 is the very first result. Most people only click on results in the top 3-5 positions, so a lower number is better.',
    intermediate: 'Reported as average position across all impressions for a query/page pair in the GSC data window. Can be fractional (e.g. 4.5) due to averaging across dates and sessions.',
    expert: 'GSC position is an impressions-weighted average over the date range. Variance can be high for volatile queries — always check the trend data alongside raw position.',
    whyItMatters: 'Moving from position 5 to position 1 can increase your clicks by 5-7x for the same keyword.',
  },
  impressions: {
    term: 'Impressions',
    shortDef: 'Times your page appeared in search results (whether clicked or not)',
    beginner: 'An impression happens every time someone searches and your website shows up — even if they don\'t click. High impressions with low clicks means your listing isn\'t convincing enough to click.',
    intermediate: 'Impressions track SERP appearance but not engagement. A high impressions/low clicks ratio signals CTR underperformance or SERP feature competition.',
    expert: 'GSC counts an impression even if the result is below the fold. Position-1 queries with high impressions and low CTR are prime AI Overview displacement candidates.',
    whyItMatters: 'Impressions show your organic reach potential. They represent an audience you\'re already reaching but not converting into visits.',
  },
  opportunityScore: {
    term: 'Opportunity Score (0–100)',
    shortDef: 'Composite score measuring how much traffic you could gain from this keyword',
    beginner: 'This score tells you which keywords are your best opportunities to get more visitors. A score of 80+ means: lots of potential traffic, easy to improve, and currently trending well. Focus here first.',
    intermediate: '4-component composite: Traffic Potential (40pts) + CTR Gap Urgency (25pts) + Effort Penalty (−15pts) + Trend Momentum (−15 to +20pts). Normalised to 0–100.',
    expert: 'A = logNorm(impressions × CTR_gap) × 40, adjusted for AI Overview zero-click discount. B = urgency from CTR_gap/expected × 25. C = position-based effort penalty. D = OLS momentum score.',
    whyItMatters: 'Instead of guessing where to spend your time, this score shows you exactly which keywords will give you the best return on effort.',
  },
  ctrGap: {
    term: 'CTR Gap',
    shortDef: 'Difference between your actual CTR and the industry average at your position',
    beginner: 'If your website is in position 3 and most sites at position 3 get 11% of clicks, but you\'re only getting 6%, your CTR gap is 5%. That gap represents missed visitors who could have clicked your result.',
    intermediate: 'CTR gap = expected_CTR(position, intent, device) − actual_CTR. Negative gap = underperforming. The 2026 curve is calibrated for intent (informational/commercial) and AI Overview suppression.',
    expert: 'Gap uses the premium CTR curve: {1: 34%, 2: 17%, 3: 11%...} with multiplicative adjustments for device (mobile ×0.80), AI Overview risk (>60 × 0.60 for pos 1-3), and intent modifier.',
    whyItMatters: 'A CTR gap often means your title or meta description doesn\'t match what searchers want. Fixing it can bring more traffic without needing to improve your ranking.',
  },
  aiOverviewRisk: {
    term: 'AI Overview Risk',
    shortDef: 'Likelihood Google\'s AI answer is stealing clicks from your organic result',
    beginner: 'Google sometimes shows an AI-generated answer at the top of search results. When this happens, fewer people click on regular website links. This score tells you how exposed your pages are to this problem.',
    intermediate: '5-signal composite (0–100): CTR suppression at top-3, informational intent penalty, CTR trend decline, question-form pattern, and high impression volume. Counter-strategy assigned per risk tier.',
    expert: 'Risk scoring: S1 = max 35pts (5-CTR)×7 for pos≤3 low CTR. S2 = intent map: informational=25, commercial=10, transactional=0. S3 = min(20, slope×400) if sig trend. S4 = question prefix ±12. S5 = impr>5K +8.',
    whyItMatters: 'Pages with high AI Overview risk need to adapt their content strategy — either target the AI Overview directly, or pivot to queries that AI won\'t answer.',
  },
  cannibalization: {
    term: 'Keyword Cannibalization',
    shortDef: 'When two or more of your pages compete for the same keyword, splitting your ranking power',
    beginner: 'If you have two blog posts both trying to rank for "best running shoes", Google gets confused about which one to show. They compete against each other instead of competing against other websites. This weakens both pages.',
    intermediate: 'Detected via 3-layer analysis: position variance (std > 3.0), TF-IDF cosine similarity between URL slugs + query (> 0.75), then consolidation scoring (impressions × 0.6 + (100−pos) × 0.4) to pick winner.',
    expert: 'Layer 1 screens by query group with std(position) > 3. Layer 2 confirms with cosine_sim(tfidf(slug+query)) > 0.75. Layer 3 assigns keeper/loser based on authority score, recommends 301/canonical.',
    whyItMatters: 'Fixing cannibalization can consolidate your ranking signals onto one strong page, often recovering 20-35% of the clicks currently being split across competing pages.',
  },
  healthScore: {
    term: 'SEO Health Score',
    shortDef: '0–100 measure of your overall site SEO performance across 6 dimensions',
    beginner: 'Think of this like a health checkup for your website\'s search performance. 0 = critical problems everywhere. 100 = excellent SEO health. We track this weekly so you can see if you\'re improving.',
    intermediate: '6-dimension weighted composite: CTR Performance (25%), Position Trends (20%), Cannibalization (20%), AI Overview Risk (15%), Content Coverage (10%), Core Web Vitals (10%). Weekly delta tracked.',
    expert: 'Weighted average of normalized dimension scores. CTR dim = % rows above benchmark curve. Trend dim = normalize(avgMomentum, −15, +20). Cannib dim = 100 − (conflicts × 15). AIR dim = 100 − avgRisk.',
    whyItMatters: 'Your health score gives you a single number to track weekly progress. Every fixed issue raises your score — you can see your improvements compound over time.',
  },
  featuredSnippet: {
    term: 'Featured Snippet',
    shortDef: 'The highlighted answer box shown at the very top of Google results',
    beginner: 'When you Google "how to tie a tie", Google often shows a highlighted box at the very top with step-by-step instructions. That box is a featured snippet. Getting your content there can dramatically increase clicks.',
    intermediate: 'Position 0 — appears above regular organic results. Typically triggered by how-to, definitional, and comparison queries. Requires structured content with clear headers and direct answers.',
    expert: 'Featured snippets are correlated with query patterns: definitional (what is), procedural (how to), listicle (best X). Target with semantic HTML structure, direct answer in first 40-50 words, FAQ schema.',
    whyItMatters: 'Featured snippets can boost your CTR by 2-4x. They also protect against AI Overviews — Google often cites featured snippet sources in its AI answers.',
  },
  eeat: {
    term: 'E-E-A-T',
    shortDef: 'Google\'s quality framework: Experience, Expertise, Authoritativeness, Trustworthiness',
    beginner: 'Google wants to show content written by real experts who know what they\'re talking about. E-E-A-T is their way of judging this. You can improve it by showing author credentials, citing sources, and keeping information accurate and up-to-date.',
    intermediate: 'Google QRG quality framework. Experience = first-hand usage/testing. Expertise = demonstrable subject knowledge. Authority = backlinks, mentions, citations from trusted sources. Trust = accuracy, transparency, security.',
    expert: 'E-E-A-T is not a direct ranking factor but a quality framework used by quality raters. Correlated signals: author schema, byline consistency, backlink profile from authoritative domains, cite accuracy, YMYL compliance.',
    whyItMatters: 'Google favors content from genuine experts. Strong E-E-A-T signals help your content rank higher and get cited in AI answers.',
  },
  intentClassification: {
    term: 'Search Intent',
    shortDef: 'The reason behind a search — are they looking to learn, buy, find a site, or find local info?',
    beginner: 'When someone searches "what is a mortgage", they want to learn. When they search "mortgage calculator", they want a tool. When they search "apply for mortgage", they want to do something. These are different intents — your page needs to match the right one.',
    intermediate: '4 primary intents: informational (learn), commercial (research before buying), transactional (ready to act), navigational (find specific site). Classified via 2-stage: rule-based (confidence≥0.80) then TF-IDF cosine fallback.',
    expert: 'Stage 1: weighted keyword signal scan (purchase_intent, info_intent, commercial_intent, nav_intent regex). Stage 2 for ambiguous: TF-IDF cosine similarity against intent prototype sentences. Outputs intent + confidence.',
    whyItMatters: 'Content that matches the wrong intent will rank poorly and get low CTR even if technically correct. Intent-matched content is the foundation of all other SEO improvements.',
  },
  trendMomentum: {
    term: 'Trend Momentum (−15 to +20)',
    shortDef: 'How fast your position is improving or declining, adjusted for statistical significance',
    beginner: 'This score tells you if your keyword is on the rise (+) or falling (−). A high positive number means the page is steadily moving up in Google. A negative number means it\'s slipping and needs attention.',
    intermediate: 'OLS regression slope over 28-day position series. Momentum mapped: slope < −0.20 → +20 (strong rise), < −0.08 → +12, < +0.05 → +6, < +0.15 → −5, else → −15. Suppressed if p≥0.10 or volatility=volatile.',
    expert: 'OLS: {slope, intercept, r², p-value} from position time series. Momentum dampened by CV-based volatility (cv>0.35 = volatile → momentum=0; cv>0.20 = unstable → momentum×0.5). p-value gate: p≥0.10 → momentum=0.',
    whyItMatters: 'Momentum lets you prioritize rising pages for quick wins and catch falling pages before they drop off page 1.',
  },
  topicCluster: {
    term: 'Topic Cluster',
    shortDef: 'A group of related pages that together build authority on one topic',
    beginner: 'A topic cluster is like a book with chapters. Your main "pillar" page covers a broad topic, and supporting pages cover specific sub-topics. This structure helps Google understand your site\'s expertise and improves all the pages\' rankings together.',
    intermediate: 'Semantic content architecture: pillar page (broad topic, high authority) linked to satellite pages (sub-topics). Pillar detection via impressions × CTR authority scoring. K-Means TF-IDF clustering used for auto-detection.',
    expert: 'K-Means clustering on TF-IDF vectors (maxFeatures=200) with auto-k via sqrt(n/2) heuristic. Pillar = argmax(impressions × ctr) per cluster. Cluster health = coverageDepth × authoritySpread (both 0–10).',
    whyItMatters: 'Sites with clear topic clusters outperform those with isolated pages. Google rewards topical authority, and clusters help establish it.',
  },
  cwv: {
    term: 'Core Web Vitals (CWV)',
    shortDef: 'Google\'s 3 key page performance metrics: LCP, INP, and CLS',
    beginner: 'Core Web Vitals measure how fast and smooth your website feels to visitors. LCP measures loading speed, INP measures responsiveness (how fast it reacts to clicks), and CLS measures visual stability (does content jump around?). Poor scores can hurt your rankings.',
    intermediate: 'LCP (Largest Contentful Paint) ≤ 2.5s. INP (Interaction to Next Paint) ≤ 200ms. CLS (Cumulative Layout Shift) ≤ 0.1. Measured via CrUX (field data) and PageSpeed Insights (lab data). Direct ranking signal since 2021.',
    expert: 'CrUX field data from Chrome UX Report API (75th percentile threshold). INP replaced FID in March 2024. Impact on rankings is real but modest compared to content relevance. Prioritize pages with high traffic + failing CWV scores.',
    whyItMatters: 'Poor Core Web Vitals can suppress rankings even if your content is excellent. They also directly affect conversion rates — slow pages lose visitors.',
  },
  geoScore: {
    term: 'GEO Score (Generative Engine Optimization)',
    shortDef: 'How likely your content is to be cited in AI-generated answers',
    beginner: 'AI chatbots like Google\'s AI Overview pull information from websites. Your GEO score tells you how likely your content is to be cited as a source in these AI answers. Higher GEO score = more AI visibility.',
    intermediate: 'GEO readiness factors: position ≤ 10, strong CTR (relevance signal), informational intent, high impression volume (training data signal), question-form query structure. Counter to AI Overview risk.',
    expert: 'GEO scoring: position (top-3=30pts), CTR≥5%=20pts, impressions≥1K=20pts, informational_intent=15pts, question_form=15pts. Anti-correlated with AI Overview risk but distinct — you can be cited in AI answer while also being displaced from organic clicks.',
    whyItMatters: 'As AI answers become more common, getting cited in them is a new form of visibility. High GEO score = your content appears in AI answers even when clicks go to the AI instead of your site.',
  },
  contentBrief: {
    term: 'Content Brief',
    shortDef: 'A structured plan for writing new content — includes H2 outline, word count, angle, and schema',
    beginner: 'A content brief is like a blueprint before you write. It tells you: what the main topic is, what sections to include, how long to write, and what makes your article better than what already ranks. It saves hours of planning.',
    intermediate: 'Generated by MiniMax M2.7 with competitor context from Gemini SERP enrichment. Contains: H1 recommendation, H2/H3 outline with notes, word count target, unique angle, schema markup type, and internal link suggestions.',
    expert: 'Brief generation uses Prompt Template 3: query + intent + impressions + competitor context (Gemini SERP data) → structured JSON: {h1, outline:[{h2, h3s, notes}], wordCount, angle, schema, internalLinks}. Verbosity adapts to ExpertiseLevel.',
    whyItMatters: 'Well-briefed content outperforms ad-hoc writing because it\'s built around what already ranks and what gaps exist in the current SERP.',
  },
  priorityActionFeed: {
    term: 'Priority Action Feed',
    shortDef: 'The single most impactful SEO action to take right now',
    beginner: 'Instead of showing you a long list of things to do, the Priority Action Feed picks ONE action for you — the one that will have the biggest impact for the least effort. Do this one thing, mark it done, and get the next one.',
    intermediate: 'Feed selector: Phase 1 — surface highest estimated-gain P1 items first. Phase 2 — rank P2 items by score/effortCost ratio (low effort items ranked higher). Expert mode shows top 3 simultaneously.',
    expert: 'selectPriorityActions() sorts by priority tier first, then by estimatedGain (P1) or score/effortCost ratio (P2+). effortCost: {low:1, medium:2, high:4}. Context-aware: beginner shows 1, expert shows 3.',
    whyItMatters: 'Most people abandon SEO work because the to-do list feels overwhelming. One clear action at a time leads to consistent progress.',
  },
};

// ─── Lookup Helper ────────────────────────────────────────────────────────────

/**
 * Get the right explanation for a term at the given expertise level.
 */
export function getExplainer(
  termKey: string,
  level: ExpertiseLevel = 'beginner',
): string {
  const explainer = SEO_EXPLAINERS[termKey];
  if (!explainer) return '';
  return explainer[level] || explainer.beginner;
}

/**
 * Get all glossary terms sorted alphabetically.
 */
export function getGlossaryTerms(): Array<{
  key: string;
  term: string;
  shortDef: string;
}> {
  return Object.entries(SEO_EXPLAINERS)
    .map(([key, e]) => ({ key, term: e.term, shortDef: e.shortDef }))
    .sort((a, b) => a.term.localeCompare(b.term));
}

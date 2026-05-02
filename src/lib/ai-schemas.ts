import { z } from "zod";

// ─── AI Synthesis (GSC Command Center) ──────────────────────────────────────
export const AISynthesisSchema = z.object({
  executiveSummary: z.string().describe("3-4 sentence strategic overview of the site's SEO health and biggest opportunities"),
  criticalFindings: z.array(z.string()).describe("Top 3 most impactful issues ranked by monthly click opportunity"),
  winningStrategy: z.string().describe("Detailed recommended approach combining quick wins, content gaps, and cannibalization fixes into a phased action plan"),
  aiOverviewBlueprint: z.string().describe("Specific content restructuring recommendations to maximize AI Overview eligibility"),
  investmentPriority: z.array(z.string()).describe("Ranked list of efforts by ROI potential — for each: action, expected clicks gained, difficulty"),
  riskFactors: z.array(z.string()).optional().describe("2-3 potential pitfalls or things that could go wrong with the strategy"),
});

// ─── CTR Optimization ───────────────────────────────────────────────────────
export const CTROptimizationSchema = z.object({
  titleVariants: z.array(
    z.object({
      title: z.string().max(70),
      predictedCTR: z.string(),
      reasoning: z.string(),
    })
  ).min(3).max(5),
  metaVariants: z.array(
    z.object({
      text: z.string().max(160),
      charCount: z.number(),
      cta: z.string(),
      predictedCTR: z.string(),
    })
  ).min(3),
  schemaMarkup: z.string().describe("JSON-LD schema markup script"),
});

// ─── Keyword Research ───────────────────────────────────────────────────────
export const KeywordResearchSchema = z.object({
  groups: z.array(
    z.object({
      intent: z.string(),
      keywords: z.array(z.string()),
    })
  ),
  questions: z.array(z.string()),
});

// ─── Topic Clustering ───────────────────────────────────────────────────────
export const TopicClusterSchema = z.object({
  clusterName: z.string(),
  pillarPage: z.string(),
  subclusters: z.array(
    z.object({
      name: z.string(),
      keywords: z.array(z.string()),
      internalLinks: z.array(z.string()),
    })
  ),
});

// ─── Filter Analysis ────────────────────────────────────────────────────────
export const FilterAnalysisSchema = z.object({
  intentDistribution: z.array(
    z.object({
      intent: z.string(),
      count: z.number(),
    })
  ),
  ctrGaps: z.array(
    z.object({
      query: z.string(),
      gap: z.number(),
    })
  ),
});

// ─── Index Diagnosis ────────────────────────────────────────────────────────
export const IndexDiagnosisSchema = z.object({
  patternGroups: z.array(
    z.object({
      pattern: z.string(),
      affectedUrls: z.array(z.string()),
    })
  ),
  quickFixes: z.array(
    z.object({
      url: z.string(),
      action: z.string(),
    })
  ),
});

// ─── Crawl Analysis ─────────────────────────────────────────────────────────
export const CrawlAnalysisSchema = z.object({
  statusGroups: z.array(
    z.object({
      status: z.number(),
      count: z.number(),
    })
  ),
  issues: z.array(
    z.object({
      description: z.string(),
      urls: z.array(z.string()),
    })
  ),
});

// ─── Agentic Analysis ───────────────────────────────────────────────────────
export const AgenticAnalysisSchema = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      category: z.string(),
      severity: z.string(),
      query: z.string(),
      page: z.string(),
      metric: z.string(),
      recommendation: z.string(),
      citations: z.array(z.string()),
      effort: z.string(),
      impact: z.string(),
    })
  ),
  topPriorityActions: z.array(z.string()),
  aiOverviewCandidates: z.array(
    z.object({
      query: z.string(),
      currentPosition: z.number(),
      action: z.string(),
    })
  ).optional(),
});

// ─── GEO Matrix ─────────────────────────────────────────────────────────────
export const GEOMatrixSchema = z.object({
  pillars: z.array(
    z.object({
      name: z.string(),
      dominantFormat: z.string(),
    })
  ),
  blueprints: z.array(
    z.object({
      format: z.string(),
      niche: z.string(),
      suggestedTitle: z.string(),
      targetQuery: z.string(),
      geoOptimizations: z.array(z.string()),
      aeoOptimizations: z.array(z.string()),
    })
  ),
  rules: z.array(z.string()),
});

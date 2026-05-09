import { pgTable, serial, text, timestamp, jsonb, integer, real, boolean } from "drizzle-orm/pg-core";

// ─── SEO Reports ────────────────────────────────────────────────────────────
export const seoReports = pgTable("seo_reports", {
  id: serial("id").primaryKey(),
  reportType: text("report_type").notNull(),
  title: text("title").notNull(),
  data: jsonb("data").notNull(),
  summary: jsonb("summary"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── GSC Snapshots ──────────────────────────────────────────────────────────
export const gscSnapshots = pgTable("gsc_snapshots", {
  id: serial("id").primaryKey(),
  siteUrl: text("site_url").notNull(),
  dateRange: text("date_range").notNull(),
  data: jsonb("data").notNull(),
  metrics: jsonb("metrics").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Keyword Clusters ───────────────────────────────────────────────────────
export const keywordClusters = pgTable("keyword_clusters", {
  id: serial("id").primaryKey(),
  clusterName: text("cluster_name").notNull(),
  keywords: jsonb("keywords").notNull(),
  searchVolume: integer("search_volume").default(0),
  difficulty: real("difficulty").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Background Jobs (Step 3) ──────────────────────────────────────────────
export const seoJobs = pgTable("seo_jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobType: text("job_type").notNull(),
  status: text("status").default("pending").notNull(),
  progress: integer("progress").default(0),
  progressMessage: text("progress_message"),
  input: jsonb("input").notNull(),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// ─── SERP Intelligence (Step 4 — Learning CTR Model) ────────────────────────
export const serpIntelligence = pgTable("serp_intelligence", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  positionBucket: integer("position_bucket").notNull(),
  intent: text("intent").notNull(),
  actualCtr: real("actual_ctr").notNull(),
  predictedCtr: real("predicted_ctr").notNull(),
  predictedFeatures: jsonb("predicted_features"),
  siteUrl: text("site_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Sites (Multi-site workspace) ────────────────────────────────────────────
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  siteUrl: text("site_url").notNull(),
  displayName: text("display_name"),
  isPrimary: boolean("is_primary").default(false),
  lastAnalysedAt: timestamp("last_analysed_at"),
  healthScore: integer("health_score"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Opportunities (Scored action items with full action plan) ────────────────
export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id"),          // null = unassigned (legacy)
  siteUrl: text("site_url").notNull(), // denormalized for easy lookup
  query: text("query").notNull(),
  page: text("page").notNull(),
  actionType: text("action_type").notNull(),
  score: integer("score").notNull(),             // 0–100 composite
  priority: integer("priority").notNull(),       // 1–10
  effort: text("effort").notNull(),              // low | medium | high
  estimatedGain: integer("estimated_gain").default(0), // clicks/month
  actionPlan: jsonb("action_plan"),              // ActionResult (steps + meta)
  status: text("status").default("open").notNull(), // open | in_progress | resolved | dismissed
  aiRisk: integer("ai_risk"),                    // 0–100 AI overview risk score
  resolvedAt: timestamp("resolved_at"),
  resolvedReason: text("resolved_reason"),
  snapshotId: integer("snapshot_id"),            // linked GSC snapshot
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Health History (Weekly score trend per site) ─────────────────────────────
export const healthHistory = pgTable("health_history", {
  id: serial("id").primaryKey(),
  siteUrl: text("site_url").notNull(),
  siteId: integer("site_id"),
  overallScore: integer("overall_score").notNull(), // 0–100
  ctrPerformance: integer("ctr_performance"),        // dimension 1
  positionTrends: integer("position_trends"),        // dimension 2
  cannibalization: integer("cannibalization"),       // dimension 3
  aiOverviewRisk: integer("ai_overview_risk"),       // dimension 4
  contentCoverage: integer("content_coverage"),      // dimension 5
  cwvScore: integer("cwv_score"),                    // dimension 6
  weeklyDelta: integer("weekly_delta"),              // vs previous week
  totalOpportunities: integer("total_opportunities").default(0),
  resolvedThisWeek: integer("resolved_this_week").default(0),
  estimatedMonthlyGain: integer("estimated_monthly_gain").default(0),
  snapshotId: integer("snapshot_id"),
  recordedAt: timestamp("recorded_at").defaultNow(),
});


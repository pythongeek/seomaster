import { pgTable, serial, text, timestamp, jsonb, integer, real } from "drizzle-orm/pg-core";

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

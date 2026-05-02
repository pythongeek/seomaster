import { eq, desc, sql as rawSql } from "drizzle-orm";
import { db, schema } from "./index";
const { seoReports, gscSnapshots, keywordClusters, seoJobs, serpIntelligence } = schema;

// ─────────────────────────────────────────────────────────────────────────────
// INIT — create tables if they don't exist (backwards compat with old initDB)
// ─────────────────────────────────────────────────────────────────────────────

export async function initDB() {
  if (!db) return;
  // Drizzle push handles schema. For runtime safety, use raw SQL fallback:
  const sql = db as unknown as { execute: (q: string) => Promise<unknown> };
  try {
    // This is a no-op if tables already exist (idempotent)
    await (db as ReturnType<typeof import("drizzle-orm/neon-http").drizzle>).execute(rawSql`
      CREATE TABLE IF NOT EXISTS seo_reports (
        id SERIAL PRIMARY KEY,
        report_type TEXT NOT NULL,
        title TEXT NOT NULL,
        data JSONB NOT NULL,
        summary JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await (db as ReturnType<typeof import("drizzle-orm/neon-http").drizzle>).execute(rawSql`
      CREATE TABLE IF NOT EXISTS gsc_snapshots (
        id SERIAL PRIMARY KEY,
        site_url TEXT NOT NULL,
        date_range TEXT NOT NULL,
        data JSONB NOT NULL,
        metrics JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await (db as ReturnType<typeof import("drizzle-orm/neon-http").drizzle>).execute(rawSql`
      CREATE TABLE IF NOT EXISTS keyword_clusters (
        id SERIAL PRIMARY KEY,
        cluster_name TEXT NOT NULL,
        keywords JSONB NOT NULL,
        search_volume INTEGER DEFAULT 0,
        difficulty REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await (db as ReturnType<typeof import("drizzle-orm/neon-http").drizzle>).execute(rawSql`
      CREATE TABLE IF NOT EXISTS seo_jobs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        job_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        progress INTEGER DEFAULT 0,
        progress_message TEXT,
        input JSONB NOT NULL,
        result JSONB,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);
    await (db as ReturnType<typeof import("drizzle-orm/neon-http").drizzle>).execute(rawSql`
      CREATE TABLE IF NOT EXISTS serp_intelligence (
        id SERIAL PRIMARY KEY,
        query TEXT NOT NULL,
        position_bucket INTEGER NOT NULL,
        intent TEXT NOT NULL,
        actual_ctr REAL NOT NULL,
        predicted_ctr REAL NOT NULL,
        predicted_features JSONB,
        site_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    try {
      await (db as ReturnType<typeof import("drizzle-orm/neon-http").drizzle>).execute(rawSql`
        ALTER TABLE serp_intelligence ADD COLUMN IF NOT EXISTS site_url TEXT;
      `);
    } catch (e) {
      // Ignore if it fails
    }
  } catch (e) {
    console.warn("initDB warning:", e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────

export async function saveReport(report: {
  report_type: string;
  title: string;
  data: unknown;
  summary?: unknown;
}) {
  if (!db) return null;
  try {
    const [row] = await db.insert(seoReports).values({
      reportType: report.report_type,
      title: report.title,
      data: report.data,
      summary: report.summary ?? null,
    }).returning({ id: seoReports.id, createdAt: seoReports.createdAt });
    return row;
  } catch { return null; }
}

export async function getReports(type?: string, limit = 50) {
  if (!db) return [];
  try {
    if (type) {
      return db.select().from(seoReports)
        .where(eq(seoReports.reportType, type))
        .orderBy(desc(seoReports.createdAt))
        .limit(limit);
    }
    return db.select().from(seoReports)
      .orderBy(desc(seoReports.createdAt))
      .limit(limit);
  } catch { return []; }
}

export async function getReport(id: number) {
  if (!db) return null;
  const rows = await db.select().from(seoReports).where(eq(seoReports.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteReport(id: number) {
  if (!db) return false;
  await db.delete(seoReports).where(eq(seoReports.id, id));
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GSC SNAPSHOTS
// ─────────────────────────────────────────────────────────────────────────────

export async function saveGSCSnapshot(snapshot: {
  site_url: string;
  date_range: string;
  data: unknown;
  metrics: unknown;
}) {
  if (!db) return null;
  const [row] = await db.insert(gscSnapshots).values({
    siteUrl: snapshot.site_url,
    dateRange: snapshot.date_range,
    data: snapshot.data,
    metrics: snapshot.metrics,
  }).returning({ id: gscSnapshots.id, createdAt: gscSnapshots.createdAt });
  return row;
}

export async function getGSCSnapshots(siteUrl: string, limit = 30) {
  if (!db) return [];
  return db.select().from(gscSnapshots)
    .where(eq(gscSnapshots.siteUrl, siteUrl))
    .orderBy(desc(gscSnapshots.createdAt))
    .limit(limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYWORD CLUSTERS
// ─────────────────────────────────────────────────────────────────────────────

export async function saveKeywordCluster(cluster: {
  cluster_name: string;
  keywords: string[];
  search_volume: number;
  difficulty: number;
}) {
  if (!db) return null;
  const [row] = await db.insert(keywordClusters).values({
    clusterName: cluster.cluster_name,
    keywords: cluster.keywords,
    searchVolume: cluster.search_volume,
    difficulty: cluster.difficulty,
  }).returning({ id: keywordClusters.id, createdAt: keywordClusters.createdAt });
  return row;
}

export async function getKeywordClusters() {
  if (!db) return [];
  return db.select().from(keywordClusters).orderBy(desc(keywordClusters.searchVolume));
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND JOBS
// ─────────────────────────────────────────────────────────────────────────────

export async function createJob(jobType: string, input: unknown) {
  if (!db) return null;
  const id = crypto.randomUUID();
  const [row] = await db.insert(seoJobs).values({
    id,
    jobType,
    status: "pending",
    progress: 0,
    input,
  }).returning({ id: seoJobs.id, createdAt: seoJobs.createdAt });
  return row;
}

export async function getJob(id: string) {
  if (!db) return null;
  const rows = await db.select().from(seoJobs).where(eq(seoJobs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateJobProgress(id: string, progress: number, message?: string) {
  if (!db) return;
  await db.update(seoJobs)
    .set({ progress, progressMessage: message, updatedAt: new Date() })
    .where(eq(seoJobs.id, id));
}

export async function completeJob(id: string, result: unknown) {
  if (!db) return;
  await db.update(seoJobs)
    .set({ status: "completed", progress: 100, result, completedAt: new Date(), updatedAt: new Date() })
    .where(eq(seoJobs.id, id));
}

export async function failJob(id: string, error: string) {
  if (!db) return;
  await db.update(seoJobs)
    .set({ status: "failed", error, updatedAt: new Date() })
    .where(eq(seoJobs.id, id));
}

export async function getPendingJobs(limit = 1) {
  if (!db) return [];
  return db.select().from(seoJobs)
    .where(eq(seoJobs.status, "pending"))
    .orderBy(seoJobs.createdAt)
    .limit(limit);
}

export async function markJobProcessing(id: string) {
  if (!db) return;
  await db.update(seoJobs)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(seoJobs.id, id));
}

// ─────────────────────────────────────────────────────────────────────────────
// SERP INTELLIGENCE
// ─────────────────────────────────────────────────────────────────────────────

export async function saveSerpDataBatch(data: Array<{
  query: string;
  positionBucket: number;
  intent: string;
  actualCtr: number;
  predictedCtr: number;
  predictedFeatures?: unknown;
  siteUrl?: string;
}>) {
  if (!db || !data.length) return null;
  // Chunk batch to avoid Neon limits
  const CHUNK_SIZE = 100;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    try {
      await db.insert(serpIntelligence).values(chunk.map(d => ({
        ...d,
        predictedFeatures: d.predictedFeatures ?? null,
        siteUrl: d.siteUrl ?? null,
      })));
    } catch (e) {
      console.warn("Failed to save SERP batch:", e);
    }
  }
}

export async function saveSerpData(data: {
  query: string;
  positionBucket: number;
  intent: string;
  actualCtr: number;
  predictedCtr: number;
  predictedFeatures?: unknown;
  siteUrl?: string;
}) {
  if (!db) return null;
  const [row] = await db.insert(serpIntelligence).values({
    ...data,
    predictedFeatures: data.predictedFeatures ?? null,
    siteUrl: data.siteUrl ?? null,
  }).returning({ id: serpIntelligence.id });
  return row;
}

export async function getHistoricalCTR(positionBucket: number, intent?: string) {
  if (!db) return null;
  try {
    const rows = await db.select().from(serpIntelligence)
      .where(eq(serpIntelligence.positionBucket, positionBucket))
      .limit(200);

    if (!rows.length) return null;

    const filtered = intent ? rows.filter(r => r.intent === intent) : rows;
    if (!filtered.length) return null;

    const avgActualCtr = filtered.reduce((s, r) => s + r.actualCtr, 0) / filtered.length;
    const avgPredictedCtr = filtered.reduce((s, r) => s + r.predictedCtr, 0) / filtered.length;
    const correctionFactor = avgPredictedCtr > 0 ? avgActualCtr / avgPredictedCtr : 1;

    return { avgCtr: avgActualCtr, correctionFactor, dataPoints: filtered.length };
  } catch { return null; }
}

export async function checkConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await db.execute(rawSql`SELECT 1`);
    return true;
  } catch { return false; }
}

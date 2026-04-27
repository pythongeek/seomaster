import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || '';

export const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

// ─── Schema Init ───────────────────────────────────────────────────────────
export async function initDB() {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS seo_reports (
    id SERIAL PRIMARY KEY,
    report_type TEXT NOT NULL,
    title TEXT NOT NULL,
    data JSONB NOT NULL,
    summary JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS gsc_snapshots (
    id SERIAL PRIMARY KEY,
    site_url TEXT NOT NULL,
    date_range TEXT NOT NULL,
    data JSONB NOT NULL,
    metrics JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS keyword_clusters (
    id SERIAL PRIMARY KEY,
    cluster_name TEXT NOT NULL,
    keywords JSONB NOT NULL,
    search_volume INTEGER DEFAULT 0,
    difficulty REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reports_type ON seo_reports(report_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reports_created ON seo_reports(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_snapshots_site ON gsc_snapshots(site_url)`;
}

// ─── Report CRUD ───────────────────────────────────────────────────────────
export async function saveReport(report: {
  report_type: string;
  title: string;
  data: unknown;
  summary?: unknown;
}) {
  if (!sql) return null;
  const [row] = await sql`
    INSERT INTO seo_reports (report_type, title, data, summary)
    VALUES (${report.report_type}, ${report.title}, ${JSON.stringify(report.data)}, ${report.summary ? JSON.stringify(report.summary) : null})
    RETURNING id, created_at
  `;
  return row;
}

export async function getReports(type?: string, limit = 50) {
  if (!sql) return [];
  if (type) {
    return sql`SELECT * FROM seo_reports WHERE report_type = ${type} ORDER BY created_at DESC LIMIT ${limit}`;
  }
  return sql`SELECT * FROM seo_reports ORDER BY created_at DESC LIMIT ${limit}`;
}

export async function getReport(id: number) {
  if (!sql) return null;
  const [row] = await sql`SELECT * FROM seo_reports WHERE id = ${id}`;
  return row;
}

export async function deleteReport(id: number) {
  if (!sql) return false;
  await sql`DELETE FROM seo_reports WHERE id = ${id}`;
  return true;
}

// ─── GSC Snapshots ──────────────────────────────────────────────────────────
export async function saveGSCSnapshot(snapshot: {
  site_url: string;
  date_range: string;
  data: unknown;
  metrics: unknown;
}) {
  if (!sql) return null;
  const [row] = await sql`
    INSERT INTO gsc_snapshots (site_url, date_range, data, metrics)
    VALUES (${snapshot.site_url}, ${snapshot.date_range}, ${JSON.stringify(snapshot.data)}, ${JSON.stringify(snapshot.metrics)})
    RETURNING id, created_at
  `;
  return row;
}

export async function getGSCSnapshots(siteUrl: string, limit = 30) {
  if (!sql) return [];
  return sql`SELECT * FROM gsc_snapshots WHERE site_url = ${siteUrl} ORDER BY created_at DESC LIMIT ${limit}`;
}

// ─── Keyword Clusters ────────────────────────────────────────────────────────
export async function saveKeywordCluster(cluster: {
  cluster_name: string;
  keywords: string[];
  search_volume: number;
  difficulty: number;
}) {
  if (!sql) return null;
  const [row] = await sql`
    INSERT INTO keyword_clusters (cluster_name, keywords, search_volume, difficulty)
    VALUES (${cluster.cluster_name}, ${JSON.stringify(cluster.keywords)}, ${cluster.search_volume}, ${cluster.difficulty})
    RETURNING id, created_at
  `;
  return row;
}

export async function getKeywordClusters() {
  if (!sql) return [];
  return sql`SELECT * FROM keyword_clusters ORDER BY search_volume DESC`;
}

export async function checkConnection(): Promise<boolean> {
  if (!sql) return false;
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
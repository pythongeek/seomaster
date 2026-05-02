import { neon } from '@neondatabase/serverless';

// Neon PostgreSQL - free serverless SQL database
// Sign up at: https://neon.tech
const DATABASE_URL = process.env.DATABASE_URL || '';

export const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

// ─── Optional: Upstash Redis for sessions/cache ─────────────────────────────
// Sign up at: https://upstash.com
// npm install @upstash/redis
//
// import { Redis } from '@upstash/redis';
// export const redis = process.env.UPSTASH_REDIS_REST_URL
//   ? new Redis({
//       url: process.env.UPSTASH_REDIS_REST_URL,
//       token: process.env.UPSTASH_REDIS_REST_TOKEN,
//     })
//   : null;

// ─── Connection check ───────────────────────────────────────────────────────
export async function checkConnection(): Promise<boolean> {
  if (!sql) return false;
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

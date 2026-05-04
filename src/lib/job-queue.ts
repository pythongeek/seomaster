/**
 * BullMQ Background Job Infrastructure
 *
 * Architecture:
 *  - BullMQ manages the job queue with retries, priority, concurrency
 *  - Neon DB (seoJobs table) is the source of truth for job metadata + result
 *  - Upstash Redis (paid) or any Redis-compatible broker provides the queue backend
 *  - For local dev without Redis: queue is disabled, jobs processed synchronously
 *
 * Redis connection (ioredis):
 *  - Local dev:   REDIS_URL=redis://localhost:6379
 *  - Upstash:     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *                 (Upstash free tier is REST-only; for BullMQ use a Redis broker
 *                  like Railway/Render free tier or a $5 DigitalOcean droplet)
 */

import { Queue, Worker, Job, QueueEvents } from "bullmq";
import IORedis from "ioredis";

// ─── Redis Connection ─────────────────────────────────────────────────────────

function isRedisConfigured(): boolean {
  return !!(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL);
}

/**
 * Creates an ioredis connection from environment.
 * Supports:
 *  - REDIS_URL=redis://localhost:6379  (local / self-hosted)
 *  - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Upstash paid — TCP compat)
 *
 * For Upstash free tier (REST-only): use a separate Redis broker.
 * The REST client (@upstash/redis) cannot be used with BullMQ.
 */
function createRedisConnection() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    // Upstash provides Redis-compatible TCP endpoint
    // Format: https://{region}-{space}.upstash.io → {region}-{space}.upstash.io:6379
    const host = upstashUrl.replace("https://", "").split(":")[0];
    return new IORedis({
      host,
      port: 6379,
      password: upstashToken,
      tls: { rejectUnauthorized: false },
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
  }

  // Standard REDIS_URL or localhost fallback
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const urlObj = new URL(url);
  return new IORedis({
    host: urlObj.hostname,
    port: parseInt(urlObj.port || "6379"),
    password: urlObj.password || undefined,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
}

let _redis: IORedis | null = null;
let _redisErrorLogged = false;

function getRedis(): IORedis | null {
  if (!isRedisConfigured()) return null;
  if (!_redis) {
    _redis = createRedisConnection();
    _redis.on("error", (err) => {
      if (!_redisErrorLogged) {
        console.error("[job-queue] Redis connection error:", err.message);
        _redisErrorLogged = true;
      }
    });
  }
  return _redis;
}

// ─── Queue Names ─────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  ANALYSIS: "seo-analysis",
  SERP_FETCH: "serp-fetch",
  GSC_IMPORT: "gsc-import",
  REPORT: "report-generation",
} as const;

// ─── Queue Factory ────────────────────────────────────────────────────────────

const _queues = new Map<string, Queue>();

function createQueue(name: string): Queue | null {
  const redis = getRedis();
  if (!redis) {
    if (!_redisErrorLogged) {
      console.warn(`[job-queue] Redis not configured — queue "${name}" disabled. Jobs will process synchronously.`);
      _redisErrorLogged = true;
    }
    return null;
  }

  if (_queues.has(name)) return _queues.get(name)!;

  const queue = new Queue(name, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 100, age: 86400 },
      removeOnFail: { count: 200, age: 604800 },
    },
  });

  _queues.set(name, queue);
  return queue;
}

// ─── Queue Instances ─────────────────────────────────────────────────────────

export const analysisQueue = createQueue(QUEUE_NAMES.ANALYSIS);
export const serpFetchQueue = createQueue(QUEUE_NAMES.SERP_FETCH);
export const gscImportQueue = createQueue(QUEUE_NAMES.GSC_IMPORT);
export const reportQueue = createQueue(QUEUE_NAMES.REPORT);

// ─── Job Data Types ───────────────────────────────────────────────────────────

export interface AnalysisJobData {
  jobId: string; // Neon DB job ID
  type: string;
  data: unknown[];
  options: Record<string, string>;
}

export interface SerpFetchJobData {
  jobId: string;
  queries: string[];
  domain?: string;
}

export interface GscImportJobData {
  jobId: string;
  siteUrl: string;
  dateRange: string;
  data: unknown[];
}

// ─── Queue Operations ─────────────────────────────────────────────────────────

/**
 * Add an analysis job to the queue.
 * Returns null if Redis is not configured (sync fallback will handle it).
 */
export async function addAnalysisJob(
  data: AnalysisJobData,
  priority = 5
): Promise<Job | null> {
  const queue = analysisQueue;
  if (!queue) return null;

  try {
    const job = await queue.add("analyze", data, {
      priority,
      jobId: data.jobId,
    });
    console.log(`[job-queue] Enqueued analysis job ${job.id} (DB: ${data.jobId})`);
    return job;
  } catch (error) {
    console.error("[job-queue] Failed to enqueue analysis job:", error);
    return null;
  }
}

/**
 * Add a SERP fetch job to the queue.
 */
export async function addSerpFetchJob(data: SerpFetchJobData): Promise<Job | null> {
  const queue = serpFetchQueue;
  if (!queue) return null;

  try {
    const job = await queue.add("serp-fetch", data, { jobId: data.jobId });
    return job;
  } catch (error) {
    console.error("[job-queue] Failed to enqueue SERP fetch job:", error);
    return null;
  }
}

/**
 * Get job state from BullMQ.
 */
export async function getJobState(
  queueName: string,
  jobId: string
): Promise<string | null> {
  const queue = _queues.get(queueName);
  if (!queue) return null;
  try {
    const job = await queue.getJob(jobId);
    if (!job) return null;
    return await job.getState();
  } catch {
    return null;
  }
}

/**
 * Get full job status (state + progress + result/failure reason).
 */
export async function getJobStatus(jobId: string): Promise<{
  state: string;
  progress: number;
  result?: unknown;
  failedReason?: string;
} | null> {
  const queue = analysisQueue;
  if (!queue) return null;
  try {
    const job = await queue.getJob(jobId);
    if (!job) return null;
    return {
      state: await job.getState(),
      progress: typeof job.progress === "number" ? job.progress : 0,
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  } catch {
    return null;
  }
}

/**
 * Get queue statistics (waiting, active, completed, failed counts).
 */
export async function getQueueStats(queueName = QUEUE_NAMES.ANALYSIS) {
  const queue = _queues.get(queueName);
  if (!queue) return null;
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  } catch {
    return null;
  }
}

/**
 * Pause the queue (for maintenance).
 */
export async function pauseQueue(queueName = QUEUE_NAMES.ANALYSIS) {
  const queue = _queues.get(queueName);
  await queue?.pause();
}

/**
 * Resume the queue.
 */
export async function resumeQueue(queueName = QUEUE_NAMES.ANALYSIS) {
  const queue = _queues.get(queueName);
  await queue?.resume();
}

// ─── Queue Events ─────────────────────────────────────────────────────────────

const _events = new Map<string, QueueEvents>();

export function setupQueueEvents(queueName: string) {
  const queue = _queues.get(queueName);
  const redis = getRedis();
  if (!queue || !redis) return null;

  if (_events.has(queueName)) return _events.get(queueName)!;

  const events = new QueueEvents(queueName, { connection: redis });
  events.on("completed", ({ jobId, returnvalue }) => {
    console.log(`[job-queue] ${jobId} completed`);
  });
  events.on("failed", ({ jobId, failedReason }) => {
    console.error(`[job-queue] ${jobId} failed:`, failedReason);
  });
  events.on("progress", ({ jobId, data }) => {
    console.log(`[job-queue] ${jobId} progress: ${JSON.stringify(data)}`);
  });
  _events.set(queueName, events);
  return events;
}

// ─── Worker Bootstrap ─────────────────────────────────────────────────────────

/**
 * Starts the BullMQ worker for a given queue.
 * Should be called from scripts/worker.ts (NOT inside Next.js).
 *
 * Usage:
 *   import { startWorker } from '@/lib/job-queue';
 *   startWorker('seo-analysis', async (job) => { ... });
 */
export async function startWorker(
  queueName: string,
  processor: (job: Job) => Promise<unknown>
) {
  const redis = getRedis();
  if (!redis) {
    console.error("[job-queue] Cannot start worker: Redis not configured.");
    return null;
  }

  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "2");
  const worker = new Worker(queueName, processor, {
    connection: redis,
    concurrency,
  });

  worker.on("completed", (job) => {
    if (job?.id) console.log(`[worker] Job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id ?? "unknown"} failed:`, err.message);
  });
  worker.on("error", (err) => {
    console.error(`[worker] Worker error:`, err.message);
  });

  console.log(`[worker] Started ${queueName} worker (concurrency: ${concurrency})`);
  return worker;
}

/**
 * BullMQ Worker Script for SEOMaster
 * 
 * Standalone worker process that processes jobs from the Redis queue.
 * Run with: npx ts-node scripts/worker.ts
 * Or in production: node dist/scripts/worker.js
 * 
 * This worker can run alongside the Next.js app or as a separate process.
 * For Vercel, use this as a separate serverless function or a dedicated worker service.
 */

import { Worker, Job, Queue } from "bullmq";

// ─── Redis Connection ─────────────────────────────────────────────────────────

function createUpstashRedisConnection() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
  }

  // Return ioredis-compatible connection for BullMQ
  return {
    url,
    token,
  };
}

function createStandardRedisConnection() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const urlObj = new URL(redisUrl);
  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port || "6379"),
    password: urlObj.password || undefined,
    tls: urlObj.protocol === "rediss:" ? {} : undefined,
  };
}

function getRedisConnection() {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    return createUpstashRedisConnection();
  }
  return createStandardRedisConnection();
}

// ─── Worker Setup ─────────────────────────────────────────────────────────────

const QUEUE_NAME = process.env.QUEUE_NAME || "seo-analysis";
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "2");

console.log(`[worker] Starting BullMQ worker for queue: ${QUEUE_NAME}`);
console.log(`[worker] Concurrency: ${CONCURRENCY}`);
console.log(`[worker] Redis connection type: ${process.env.UPSTASH_REDIS_REST_URL ? "Upstash" : "Standard"}`);

// Create Redis connection config for BullMQ
const redisConnection = getRedisConnection();

// For Upstash, we need to use a different approach since BullMQ expects ioredis-compatible connection
// But @upstash/redis is a REST client, not ioredis-compatible
// Solution: Use ioredis with Upstash's TLS endpoint, or use a separate Redis for queue
let workerConfig: any;

if ("url" in redisConnection && "token" in redisConnection) {
  // Upstash: Use the REST URL as host with token auth via ioredis
  // BullMQ's Upstash support requires ioredis with special handling
  workerConfig = {
    host: redisConnection.url.replace("https://", "").split(".upstash.io")[0],
    port: 443,
    tls: {},
    password: redisConnection.token,
    maxRetriesPerRequest: 3,
  };
} else {
  workerConfig = redisConnection;
}

// ─── Job Processors ────────────────────────────────────────────────────────────

/**
 * Process an SEO analysis job.
 */
async function processAnalysisJob(job: Job): Promise<any> {
  const { jobId, type, data, options } = job.data;
  
  console.log(`[worker] Processing analysis job ${job.id} (DB: ${jobId})`);
  console.log(`[worker] Data rows: ${data?.length || 0}`);

  try {
    // Dynamically import the job processor to avoid circular dependencies
    const { processAnalyzeJob } = await import("../src/lib/job-processor");
    
    // Report progress back to the queue
    const result = await processAnalyzeJob(
      { type, data, options },
      (progress: number, message: string) => {
        job.updateProgress(progress);
        console.log(`[worker] Job ${job.id} progress: ${progress}% - ${message}`);
      }
    );

    console.log(`[worker] Job ${job.id} completed successfully`);
    return result;
  } catch (error) {
    console.error(`[worker] Job ${job.id} failed:`, error);
    throw error;
  }
}

// ─── Main Worker ───────────────────────────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    console.log(`[worker] Received job: ${job.id}, name: ${job.name}`);

    switch (job.name) {
      case "analyze":
        return await processAnalysisJob(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  },
  {
    connection: workerConfig,
    concurrency: CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
  }
);

// ─── Event Handlers ───────────────────────────────────────────────────────────

worker.on("ready", () => {
  console.log("[worker] Worker is ready and listening for jobs");
});

worker.on("completed", (job) => {
  console.log(`[worker] ✓ Job ${job.id} completed in ${job.finishedOn! - job.timestamp}ms`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] ✗ Job ${job?.id} failed: ${err.message}`);
  if (job) {
    console.error(`[worker]   Attempts made: ${job.attemptsMade}/${job.opts.attempts}`);
  }
});

worker.on("error", (err) => {
  console.error("[worker] Worker error:", err);
});

worker.on("stalled", (jobId) => {
  console.warn(`[worker] Job ${jobId} stalled`);
});

worker.on("closed", () => {
  console.log("[worker] Worker closed");
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown() {
  console.log("[worker] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ─── Heartbeat / Status ───────────────────────────────────────────────────────

// Create a Queue instance for stats
const workerQueue = new Queue(QUEUE_NAME, { connection: workerConfig });

// Log worker status every 30 seconds
setInterval(async () => {
  try {
    const stats = await workerQueue.getJobCounts();
    console.log(`[worker] Status - Waiting: ${stats.waiting}, Active: ${stats.active}, Completed: ${stats.completed}, Failed: ${stats.failed}`);
  } catch (e) {
    // Ignore errors in status reporting
  }
}, 30000);

console.log("[worker] BullMQ worker started. Press Ctrl+C to stop.");

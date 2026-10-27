import crypto from "node:crypto";
import { Redis } from "ioredis";
import type { Suggestion } from "../contracts.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const ttlSeconds = Number(process.env.REDIS_CACHE_TTL_SECONDS || 86_400);

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: () => null
});

redis.on("error", (error: Error) => {
  console.warn(`[redis] unavailable: ${error.message}`);
});

let connectionAttempt: Promise<void> | null = null;

async function ensureConnected(): Promise<boolean> {
  if ((redis.status as string) === "ready") return true;
  connectionAttempt ??= redis.connect().then(() => undefined).catch((error: unknown) => {
    console.warn(`[redis] connection failed: ${error instanceof Error ? error.message : String(error)}`);
    connectionAttempt = null;
  });
  await connectionAttempt;
  return (redis.status as string) === "ready";
}

export function getSHA256Hash(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export async function getCachedAnalysis(hash: string): Promise<Suggestion[] | null> {
  if (!(await ensureConnected())) return null;
  try {
    const cached = await redis.get(`checkgram:analysis:v2:${hash}`);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as Suggestion[];
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.warn(`[redis] read failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function setCachedAnalysis(
  hash: string,
  suggestions: Suggestion[],
  ttl: number = ttlSeconds
): Promise<void> {
  if (!(await ensureConnected())) return;
  try {
    await redis.set(`checkgram:analysis:v2:${hash}`, JSON.stringify(suggestions), "EX", ttl);
  } catch (error) {
    console.warn(`[redis] write failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function closeRedis(): Promise<void> {
  if (redis.status !== "end") await redis.quit();
}

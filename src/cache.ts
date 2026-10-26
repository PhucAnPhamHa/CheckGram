import { createHash } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import type { Config } from "./config.js";
import type { Suggestion } from "./contracts.js";

interface CachedSuggestions {
  md5: string;
  sha256: string;
  textLength: number;
  suggestions: Suggestion[];
  cachedAt: string;
}

type RedisClient = RedisClientType;

export class SuggestionCache {
  private readonly client: RedisClient | null;
  private connection: Promise<void> | null = null;

  constructor(private readonly config: Config, private readonly logger: Pick<Console, "warn"> = console) {
    this.client = config.REDIS_URL
      ? createClient({ url: config.REDIS_URL }) as RedisClient
      : null;
    this.client?.on("error", (error) => {
      this.logger.warn(`Redis cache error: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  hashes(text: string) {
    return {
      md5: createHash("md5").update(text, "utf8").digest("hex"),
      sha256: createHash("sha256").update(text, "utf8").digest("hex")
    };
  }

  key(text: string, tone: string) {
    const { sha256 } = this.hashes(text);
    return `checkgram:analysis:v1:${sha256}:${tone.trim().toLowerCase() || "neutral"}`;
  }

  private async ensureConnected() {
    if (!this.client) return false;
    if (this.client.isReady) return true;
    this.connection ??= this.client.connect().then(() => undefined).catch((error) => {
      this.logger.warn(`Redis cache unavailable: ${error instanceof Error ? error.message : String(error)}`);
      this.connection = null;
    });
    await this.connection;
    return this.client.isReady;
  }

  async get(text: string, tone: string): Promise<Suggestion[] | null> {
    if (!(await this.ensureConnected()) || !this.client) return null;
    try {
      const cached = await this.client.get(this.key(text, tone));
      if (!cached) return null;
      const payload = JSON.parse(cached) as CachedSuggestions;
      const hashes = this.hashes(text);
      if (payload.sha256 !== hashes.sha256 || payload.md5 !== hashes.md5 || payload.textLength !== text.length) {
        return null;
      }
      return payload.suggestions;
    } catch (error) {
      this.logger.warn(`Redis cache read failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async set(text: string, tone: string, suggestions: Suggestion[]): Promise<void> {
    if (!(await this.ensureConnected()) || !this.client) return;
    const hashes = this.hashes(text);
    const payload: CachedSuggestions = {
      ...hashes,
      textLength: text.length,
      suggestions,
      cachedAt: new Date().toISOString()
    };
    try {
      await this.client.set(this.key(text, tone), JSON.stringify(payload), {
        EX: this.config.REDIS_CACHE_TTL_SECONDS
      });
    } catch (error) {
      this.logger.warn(`Redis cache write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async close() {
    if (this.client?.isOpen) await this.client.quit();
  }
}

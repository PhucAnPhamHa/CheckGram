import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LANGUAGETOOL_URL: z.string().url().default("https://api.languagetool.org/v2/check"),
  LANGUAGETOOL_LANGUAGE: z.string().default("en-US"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  REDIS_URL: z.string().url().optional(),
  REDIS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600)
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return envSchema.parse(env);
}

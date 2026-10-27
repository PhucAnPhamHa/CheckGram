import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LANGUAGETOOL_URL: z.string().url().default("https://api.languagetool.org/v2/check"),
  LANGUAGETOOL_LANGUAGE: z.string().default("en-US"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-5-sonnet-latest"),
  GOOGLE_AI_STUDIO_KEY: z.string().min(1).optional(),
  GOOGLE_AI_MODEL: z.string().default("gemini-1.5-flash"),
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_KEY: z.string().min(1).optional(),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().default("gpt-4o-mini"),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_BEDROCK_MODEL: z.string().default("anthropic.claude-3-5-sonnet-20240620-v1:0"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  SAGEMAKER_ENDPOINT_NAME: z.string().optional(),
  MONGODB_ATLAS_URI: z.string().url().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  REDIS_URL: z.string().url().optional(),
  REDIS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600)
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return envSchema.parse(env);
}

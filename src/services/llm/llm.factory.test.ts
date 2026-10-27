import assert from "node:assert/strict";
import test from "node:test";
import type { Config } from "../../config.js";
import { LLMFactory } from "./llm.factory.js";

const config = {
  HOST: "0.0.0.0",
  PORT: 3000,
  LANGUAGETOOL_URL: "https://api.languagetool.org/v2/check",
  LANGUAGETOOL_LANGUAGE: "en-US",
  OPENAI_API_KEY: "openai-key",
  OPENAI_MODEL: "gpt-4o-mini",
  ANTHROPIC_API_KEY: "anthropic-key",
  ANTHROPIC_MODEL: "claude-3-5-sonnet-latest",
  GOOGLE_AI_STUDIO_KEY: "google-key",
  GOOGLE_AI_MODEL: "gemini-1.5-flash",
  AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
  AZURE_OPENAI_KEY: "azure-key",
  AZURE_OPENAI_DEPLOYMENT_NAME: "gpt-4o-mini",
  AWS_REGION: "us-east-1",
  AWS_BEDROCK_MODEL: "anthropic.claude-3-5-sonnet-20240620-v1:0",
  SAGEMAKER_ENDPOINT_NAME: "checkgram-endpoint",
  REQUEST_TIMEOUT_MS: 15000,
  REDIS_CACHE_TTL_SECONDS: 3600,
} as Config;

test("LLMFactory selects the requested provider adapter", () => {
  for (const [type, expectedName] of [
    ["openai", "OpenAIProvider"],
    ["anthropic", "AnthropicProvider"],
    ["google", "GoogleGeminiProvider"],
    ["azure", "AzureOpenAIProvider"],
    ["aws-bedrock", "AWSBedrockProvider"],
    ["sagemaker", "AWSSageMakerProvider"],
  ] as const) {
    assert.equal(LLMFactory.getProvider(type, config).constructor.name, expectedName);
  }
});

test("LLMFactory rejects providers without an adapter", () => {
  assert.throws(() => LLMFactory.getProvider("groq", config), /not configured/);
  assert.throws(() => LLMFactory.getProvider("ollama", config), /not configured/);
});

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { Config } from "../../../config.js";
import type { ILLMProvider, AnalyzeOptions, RewriteOptions, StandardSuggestion } from "../types.js";
import { normalizeSuggestions, normalizeVariations, parseJson, suggestionPrompt } from "../json.js";

export class AWSBedrockProvider implements ILLMProvider {
  private readonly client: BedrockRuntimeClient;
  constructor(private readonly config: Config) {
    this.client = new BedrockRuntimeClient({ region: config.AWS_REGION });
  }
  private async complete(prompt: string) {
    const command = new InvokeModelCommand({
      modelId: this.config.AWS_BEDROCK_MODEL,
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2_000,
        messages: [{ role: "user", content: prompt }]
      }))
    });
    const response = await this.client.send(command);
    const payload = JSON.parse(new TextDecoder().decode(response.body)) as { content?: Array<{ text?: string }> };
    return payload.content?.[0]?.text ?? "";
  }
  async analyzeText(options: AnalyzeOptions): Promise<StandardSuggestion[]> {
    return normalizeSuggestions(parseJson(await this.complete(suggestionPrompt(options))));
  }
  async rewriteText(options: RewriteOptions): Promise<string[]> {
    return normalizeVariations(parseJson(await this.complete(`Return only JSON {"variations":["...","...","..."]}. Rewrite in ${options.desiredTone} tone:\n${options.text}`)));
  }
}

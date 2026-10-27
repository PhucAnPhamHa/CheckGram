import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "../../../config.js";
import type { ILLMProvider, AnalyzeOptions, RewriteOptions, StandardSuggestion } from "../types.js";
import { normalizeSuggestions, normalizeVariations, parseJson, suggestionPrompt } from "../json.js";

export class AnthropicProvider implements ILLMProvider {
  private readonly client: Anthropic;

  constructor(private readonly config: Config) {
    if (!config.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");
    this.client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }

  private async complete(prompt: string) {
    const response = await this.client.messages.create({
      model: this.config.ANTHROPIC_MODEL,
      max_tokens: 2_000,
      messages: [{ role: "user", content: prompt }]
    });
    const block = response.content[0];
    return block?.type === "text" ? block.text : "";
  }

  async analyzeText(options: AnalyzeOptions): Promise<StandardSuggestion[]> {
    return normalizeSuggestions(parseJson(await this.complete(suggestionPrompt(options))));
  }

  async rewriteText(options: RewriteOptions): Promise<string[]> {
    return normalizeVariations(parseJson(await this.complete(
      `Return only JSON {"variations":["...","...","..."]}. Rewrite in a ${options.desiredTone} tone:\n${options.text}`
    )));
  }
}

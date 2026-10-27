import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Config } from "../../../config.js";
import type { ILLMProvider, AnalyzeOptions, RewriteOptions, StandardSuggestion } from "../types.js";
import { normalizeSuggestions, normalizeVariations, parseJson, suggestionPrompt } from "../json.js";

export class GoogleGeminiProvider implements ILLMProvider {
  private readonly model;

  constructor(config: Config) {
    if (!config.GOOGLE_AI_STUDIO_KEY) throw new Error("GOOGLE_AI_STUDIO_KEY is required");
    this.model = new GoogleGenerativeAI(config.GOOGLE_AI_STUDIO_KEY)
      .getGenerativeModel({ model: config.GOOGLE_AI_MODEL });
  }

  async analyzeText(options: AnalyzeOptions): Promise<StandardSuggestion[]> {
    const result = await this.model.generateContent(suggestionPrompt(options));
    return normalizeSuggestions(parseJson(result.response.text()));
  }

  async rewriteText(options: RewriteOptions): Promise<string[]> {
    const result = await this.model.generateContent(
      `Return only JSON {"variations":["...","...","..."]}. Rewrite this text in a ${options.desiredTone} tone:\n${options.text}`
    );
    return normalizeVariations(parseJson(result.response.text()));
  }
}

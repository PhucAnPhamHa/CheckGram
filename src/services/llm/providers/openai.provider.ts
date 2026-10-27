import type { Config } from "../../../config.js";
import type { ILLMProvider, AnalyzeOptions, RewriteOptions, StandardSuggestion } from "../types.js";
import { normalizeSuggestions, normalizeVariations, parseJson, suggestionPrompt } from "../json.js";

export class OpenAIProvider implements ILLMProvider {
  constructor(private readonly config: Config) {}

  private async complete(prompt: string): Promise<string> {
    if (!this.config.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.config.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }]
      }),
      signal: AbortSignal.timeout(this.config.REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty response");
    return content;
  }

  async analyzeText(options: AnalyzeOptions): Promise<StandardSuggestion[]> {
    return normalizeSuggestions(parseJson(await this.complete(suggestionPrompt(options))));
  }

  async rewriteText(options: RewriteOptions): Promise<string[]> {
    return normalizeVariations(parseJson(await this.complete(
      `Return only JSON {"variations":["...","...","..."]}. Rewrite this text in a ${options.desiredTone} tone without adding facts:\n${options.text}`
    )));
  }
}

import type { Config } from "../../../config.js";
import type { ILLMProvider, AnalyzeOptions, RewriteOptions, StandardSuggestion } from "../types.js";
import { normalizeSuggestions, normalizeVariations, parseJson, suggestionPrompt } from "../json.js";

export class AzureOpenAIProvider implements ILLMProvider {
  constructor(private readonly config: Config) {
    if (!config.AZURE_OPENAI_ENDPOINT || !config.AZURE_OPENAI_KEY) throw new Error("Azure OpenAI credentials are required");
  }
  private async complete(prompt: string) {
    const endpoint = this.config.AZURE_OPENAI_ENDPOINT!.replace(/\/+$/, "");
    const url = `${endpoint}/openai/deployments/${encodeURIComponent(this.config.AZURE_OPENAI_DEPLOYMENT_NAME)}/chat/completions?api-version=2024-10-21`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.config.AZURE_OPENAI_KEY!,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });
    if (!response.ok) {
      throw new Error(`Azure OpenAI request failed (${response.status}): ${await response.text()}`);
    }
    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return result.choices?.[0]?.message?.content ?? "";
  }
  async analyzeText(options: AnalyzeOptions): Promise<StandardSuggestion[]> {
    return normalizeSuggestions(parseJson(await this.complete(suggestionPrompt(options))));
  }
  async rewriteText(options: RewriteOptions): Promise<string[]> {
    return normalizeVariations(parseJson(await this.complete(`Return only JSON {"variations":["...","...","..."]}. Rewrite in ${options.desiredTone} tone:\n${options.text}`)));
  }
}

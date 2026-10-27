import type { Config } from "../config.js";
import type { RewriteVariation, Suggestion } from "../contracts.js";
import { OpenAIProvider } from "../services/llm/providers/openai.provider.js";

export async function analyzeWithOpenAI(text: string, tone: string, config: Config): Promise<Suggestion[]> {
  const suggestions = await new OpenAIProvider(config).analyzeText({ text, tone });
  return suggestions.map((suggestion) => ({
    startOffset: suggestion.startOffset,
    endOffset: suggestion.endOffset,
    suggestionType: suggestion.category,
    replacementOptions: suggestion.replacements,
    explanation: suggestion.explanation,
    source: "openai" as const
  }));
}

export async function rewriteWithOpenAI(text: string, tone: string, config: Config): Promise<RewriteVariation[]> {
  const variations = await new OpenAIProvider(config).rewriteText({ text, desiredTone: tone });
  return variations.map((textValue) => ({ text: textValue, explanation: `Rewritten in a ${tone} tone.` }));
}

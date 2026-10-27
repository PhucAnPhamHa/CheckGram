import type { StandardSuggestion } from "./types.js";

export function parseJson<T>(content: string): T {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return JSON.parse(fenced?.[1] ?? content) as T;
}

export function suggestionPrompt(options: { text: string; tone: string; context?: string }) {
  return [
    "Analyze the supplied text for an AI writing assistant.",
    "Return only JSON: {\"suggestions\":[...]}",
    "Each suggestion must contain startOffset, endOffset, category, originalText, replacements, explanation.",
    "category must be exactly Correctness, Clarity, Engagement, or Delivery.",
    "Offsets are zero-based UTF-16 offsets into the supplied text.",
    "Only return actionable ranges within the text.",
    `Desired tone: ${options.tone}.`,
    options.context ? `External context, which may be used for tone/style: ${options.context.slice(0, 8_000)}` : "",
    `Text: ${options.text}`
  ].filter(Boolean).join("\n");
}

export function normalizeSuggestions(value: unknown): StandardSuggestion[] {
  const suggestions = (value as { suggestions?: unknown[] })?.suggestions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const category = candidate.category;
    if (!["Correctness", "Clarity", "Engagement", "Delivery"].includes(String(category))) return [];
    if (!Number.isInteger(candidate.startOffset) || !Number.isInteger(candidate.endOffset)) return [];
    return [{
      startOffset: candidate.startOffset as number,
      endOffset: candidate.endOffset as number,
      category: category as StandardSuggestion["category"],
      originalText: typeof candidate.originalText === "string" ? candidate.originalText : "",
      replacements: Array.isArray(candidate.replacements)
        ? candidate.replacements.filter((value): value is string => typeof value === "string").slice(0, 5)
        : [],
      explanation: typeof candidate.explanation === "string" ? candidate.explanation : "Review this text."
    }];
  });
}

export function normalizeVariations(value: unknown): string[] {
  const variations = (value as { variations?: unknown[] })?.variations;
  if (!Array.isArray(variations)) return [];
  return variations.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
      return [(item as { text: string }).text];
    }
    return [];
  }).slice(0, 3);
}

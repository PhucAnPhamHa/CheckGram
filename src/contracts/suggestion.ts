export const suggestionTypes = [
  "grammar",
  "spelling",
  "punctuation",
  "style",
  "clarity",
  "tone",
  "rewrite",
  "conciseness",
  "custom",
] as const;

export type SuggestionType = (typeof suggestionTypes)[number];

export const suggestionStatuses = [
  "active",
  "accepted",
  "dismissed",
  "ignored",
  "stale",
] as const;

export type SuggestionStatus = (typeof suggestionStatuses)[number];

export const suggestionSources = ["languagetool", "openai", "system"] as const;
export type SuggestionSource = (typeof suggestionSources)[number];

export const suggestionCategories = [
  "correctness",
  "clarity",
  "tone",
  "style",
  "rewriting",
] as const;

export type SuggestionCategory = (typeof suggestionCategories)[number];

export interface SuggestionAlternative {
  text: string;
  label?: string;
  confidence?: number;
}
export interface SuggestionPayload {
  id: string;
  document_id: string;
  document_version: number;
  suggestion_type: SuggestionType;
  status: SuggestionStatus;
  start: number;
  end: number;
  original_text: string;
  replacement_text: string | null;
  explanation: string;
  confidence: number | null;
  severity: 1 | 2 | 3 | 4 | 5;
  source: SuggestionSource;
  rule_id: string | null;
  category: SuggestionCategory;
  alternatives?: SuggestionAlternative[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export function isSuggestionRangeValid(
  plainText: string,
  suggestion: Pick<SuggestionPayload, "start" | "end" | "original_text">,
): boolean {
  return (
    Number.isInteger(suggestion.start) &&
    Number.isInteger(suggestion.end) &&
    suggestion.start >= 0 &&
    suggestion.end > suggestion.start &&
    suggestion.end <= plainText.length &&
    plainText.slice(suggestion.start, suggestion.end) === suggestion.original_text
  );
}

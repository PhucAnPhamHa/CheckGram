import { z } from "zod";

export const analyzeRequestSchema = z.object({
  text: z.string().min(1).max(100_000),
  tone: z.string().min(1).max(80).default("Professional"),
  previousChunks: z.array(z.string().min(1)).optional(),
  forceRefresh: z.boolean().default(false)
});

export const rewriteRequestSchema = z.object({
  text: z.string().min(1).max(10_000),
  tone: z.string().min(1).max(80)
});

export const suggestionCategorySchema = z.enum([
  "Correctness",
  "Clarity",
  "Engagement",
  "Delivery"
]);

export type SuggestionCategory = z.infer<typeof suggestionCategorySchema>;

export interface Suggestion {
  startOffset: number;
  endOffset: number;
  suggestionType: SuggestionCategory;
  replacementOptions: string[];
  explanation: string;
  confidence?: number;
  source: "languagetool" | "openai";
}

export interface RewriteVariation {
  text: string;
  explanation: string;
}

export function isSuggestionInText(text: string, suggestion: Suggestion): boolean {
  return (
    Number.isInteger(suggestion.startOffset) &&
    Number.isInteger(suggestion.endOffset) &&
    suggestion.startOffset >= 0 &&
    suggestion.endOffset > suggestion.startOffset &&
    suggestion.endOffset <= text.length
  );
}

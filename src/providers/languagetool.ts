import type { Config } from "../config.js";
import type { Suggestion, SuggestionCategory } from "../contracts.js";

interface LanguageToolMatch {
  message: string;
  shortMessage?: string;
  replacements?: Array<{ value: string }>;
  offset: number;
  length: number;
  rule?: {
    id?: string;
    issueType?: string;
    category?: { id?: string; name?: string };
  };
}

interface LanguageToolResponse {
  matches?: LanguageToolMatch[];
}

function mapCategory(match: LanguageToolMatch): SuggestionCategory {
  const issueType = match.rule?.issueType?.toLowerCase();
  const category = `${match.rule?.category?.id ?? ""} ${match.rule?.category?.name ?? ""}`.toLowerCase();

  if (issueType === "style" || category.includes("style") || category.includes("redundancy")) {
    return "Clarity";
  }
  return "Correctness";
}

export async function analyzeWithLanguageTool(
  text: string,
  config: Config,
  fetchImpl: typeof fetch = fetch
): Promise<Suggestion[]> {
  const body = new URLSearchParams({
    text,
    language: config.LANGUAGETOOL_LANGUAGE,
    enabledOnly: "false"
  });

  const response = await fetchImpl(config.LANGUAGETOOL_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(config.REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`LanguageTool request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as LanguageToolResponse;
  return (payload.matches ?? [])
    .map((match): Suggestion => ({
      startOffset: match.offset,
      endOffset: match.offset + match.length,
      suggestionType: mapCategory(match),
      replacementOptions: (match.replacements ?? []).map(({ value }) => value).filter(Boolean).slice(0, 5),
      explanation: match.message || match.shortMessage || "Review this text.",
      source: "languagetool"
    }))
    .filter((suggestion) => suggestion.endOffset > suggestion.startOffset);
}

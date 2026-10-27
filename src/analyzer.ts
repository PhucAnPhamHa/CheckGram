import type { Config } from "./config.js";
import type { Suggestion } from "./contracts.js";
import { isSuggestionInText } from "./contracts.js";
import { analyzeWithLanguageTool } from "./providers/languagetool.js";
import { analyzeWithOpenAI } from "./providers/openai.js";

export interface AnalyzerDependencies {
  languageTool?: typeof analyzeWithLanguageTool;
  openAI?: typeof analyzeWithOpenAI;
}

export async function analyzeText(
  text: string,
  tone: string,
  config: Config,
  dependencies: AnalyzerDependencies = {}
): Promise<Suggestion[]> {
  const languageTool = dependencies.languageTool ?? analyzeWithLanguageTool;
  const openAI = dependencies.openAI ?? analyzeWithOpenAI;
  const results: Suggestion[] = [];

  const languageToolResults = await languageTool(text, config);
  results.push(...languageToolResults);

  if (config.OPENAI_API_KEY) {
    results.push(...await openAI(text, tone, config));
  }

  return results
    .filter((suggestion) => isSuggestionInText(text, suggestion))
    .sort((left, right) => left.startOffset - right.startOffset || right.endOffset - left.endOffset)
    .filter((suggestion, index, all) => {
      const previous = all[index - 1];
      return !previous || suggestion.startOffset >= previous.endOffset;
    });
}

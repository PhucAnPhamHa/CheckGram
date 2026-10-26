import type { Config } from "./config.js";
import type { Suggestion } from "./contracts.js";
import { isSuggestionInText } from "./contracts.js";
import { analyzeWithLanguageTool } from "./providers/languagetool.js";
import { analyzeWithOpenAI } from "./providers/openai.js";

export interface AnalyzerDependencies {
  languageTool?: typeof analyzeWithLanguageTool;
  openAI?: typeof analyzeWithOpenAI;
}

export interface AnalysisBlock {
  blockIndex: number;
  startOffset: number;
  text: string;
}

export function splitIntoAnalysisBlocks(text: string, maxBlockLength = 1_200): AnalysisBlock[] {
  const blocks: AnalysisBlock[] = [];
  const paragraphPattern = /\S[\s\S]*?(?=\n{2,}|\s*$)/g;
  let match: RegExpExecArray | null;

  while ((match = paragraphPattern.exec(text)) !== null) {
    const paragraph = match[0];
    const paragraphStart = match.index;
    for (let offset = 0; offset < paragraph.length; offset += maxBlockLength) {
      blocks.push({
        blockIndex: blocks.length,
        startOffset: paragraphStart + offset,
        text: paragraph.slice(offset, offset + maxBlockLength)
      });
    }
  }

  return blocks;
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

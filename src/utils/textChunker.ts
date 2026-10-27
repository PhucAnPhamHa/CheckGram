import { createHash } from "node:crypto";
import type { Suggestion } from "../contracts.js";

export interface TextChunk {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
}

export function splitIntoParagraphs(fullText: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let start = 0;

  for (let index = 0; index <= fullText.length; index += 1) {
    const isLineBreak = fullText[index] === "\n";
    const isEnd = index === fullText.length;
    if (!isLineBreak && !isEnd) continue;

    const text = fullText.slice(start, index).replace(/\r$/, "");
    if (text.trim()) {
      chunks.push({
        id: createHash("sha256").update(text, "utf8").digest("hex"),
        text,
        startOffset: start,
        endOffset: index
      });
    }

    start = index + 1;
  }

  return chunks;
}

export function remapSuggestionsToGlobal(
  suggestions: Suggestion[],
  globalStartOffset: number
): Suggestion[] {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    startOffset: suggestion.startOffset + globalStartOffset,
    endOffset: suggestion.endOffset + globalStartOffset
  }));
}

import assert from "node:assert/strict";
import test from "node:test";
import { remapSuggestionsToGlobal, splitIntoParagraphs } from "./textChunker.js";

test("splitIntoParagraphs retains global offsets and stable paragraph hashes", () => {
  const chunks = splitIntoParagraphs("First line\nSecond line\n\nThird");

  assert.deepEqual(
    chunks.map(({ text, startOffset, endOffset }) => ({ text, startOffset, endOffset })),
    [
      { text: "First line", startOffset: 0, endOffset: 10 },
      { text: "Second line", startOffset: 11, endOffset: 22 },
      { text: "Third", startOffset: 24, endOffset: 29 }
    ]
  );
  assert.equal(chunks[0].id.length, 64);
});

test("remapSuggestionsToGlobal shifts both range offsets", () => {
  const [suggestion] = remapSuggestionsToGlobal([{
    startOffset: 2,
    endOffset: 5,
    suggestionType: "Correctness",
    replacementOptions: ["was"],
    explanation: "Use the singular verb.",
    source: "languagetool"
  }], 17);

  assert.equal(suggestion.startOffset, 19);
  assert.equal(suggestion.endOffset, 22);
});

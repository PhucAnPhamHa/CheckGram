import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface EditorSuggestion {
  startOffset: number;
  endOffset: number;
  suggestionType: "Correctness" | "Clarity" | "Engagement" | "Delivery";
  replacementOptions: string[];
  explanation: string;
  confidence?: number;
  source: "languagetool" | "openai" | "anthropic" | "google" | "azure" | "aws-bedrock" | "sagemaker" | "groq" | "ollama";
}

export function suggestionKey(suggestion: EditorSuggestion): string {
  return `${suggestion.startOffset}:${suggestion.endOffset}:${suggestion.suggestionType}`;
}

export const suggestionPluginKey = new PluginKey<DecorationSet>("checkgram-suggestions");

export function offsetPositions(doc: Parameters<typeof DecorationSet.create>[0], start: number, end: number) {
  let cursor = 0;
  let from: number | null = null;
  let to: number | null = null;

  doc.descendants((node, position) => {
    if (!node.isText) {
      if (node.isBlock && cursor > 0) cursor += 1;
      return;
    }

    const nodeText = node.text ?? "";
    const nodeStart = cursor;
    const nodeEnd = cursor + nodeText.length;
    if (from === null && start >= nodeStart && start <= nodeEnd) from = position + (start - nodeStart);
    if (end >= nodeStart && end <= nodeEnd) {
      to = position + (end - nodeStart);
      return false;
    }
    cursor = nodeEnd;
  });

  return from !== null && to !== null ? { from, to } : null;
}

function createDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  suggestions: EditorSuggestion[],
  selectedKey?: string
) {
  const decorations = suggestions.flatMap((suggestion) => {
    const positions = offsetPositions(doc, suggestion.startOffset, suggestion.endOffset);
    if (!positions || positions.from >= positions.to) return [];
    const className = [
      `suggestion-${suggestion.suggestionType.toLowerCase()}`,
      suggestionKey(suggestion) === selectedKey ? "suggestion-selected" : ""
    ].filter(Boolean).join(" ");
    return [Decoration.inline(positions.from, positions.to, {
      class: className,
      "data-suggestion-type": suggestion.suggestionType,
      "data-suggestion-key": suggestionKey(suggestion)
    })];
  });
  return DecorationSet.create(doc, decorations);
}

export const SuggestionDecoration = Extension.create<{ suggestions: EditorSuggestion[] }>({
  name: "suggestionDecoration",
  addOptions() {
    return { suggestions: [] };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: suggestionPluginKey,
        state: {
          init: (_, state) => createDecorations(state.doc, this.options.suggestions),
          apply: (transaction, oldDecorations) => {
            const meta = transaction.getMeta(suggestionPluginKey);
            if (meta?.suggestions) {
              return createDecorations(transaction.doc, meta.suggestions, meta.selectedSuggestionKey);
            }
            return transaction.docChanged ? oldDecorations.map(transaction.mapping, transaction.doc) : oldDecorations;
          }
        },
        props: {
          decorations: (state) => suggestionPluginKey.getState(state)
        }
      })
    ];
  }
});

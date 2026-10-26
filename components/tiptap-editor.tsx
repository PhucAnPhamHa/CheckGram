"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  offsetPositions,
  suggestionKey,
  suggestionPluginKey,
  SuggestionDecoration,
  type EditorSuggestion
} from "./suggestion-decoration";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const actionTones = {
  Rewrite: "Neutral",
  Shorten: "Concise",
  Formal: "Professional",
  Friendly: "Friendly"
} as const;

type RewriteMode = keyof typeof actionTones;

export interface TiptapEditorHandle {
  focusSuggestion: (suggestion: EditorSuggestion) => void;
  acceptSuggestion: (suggestion: EditorSuggestion) => boolean;
}

interface TiptapEditorProps {
  suggestions: EditorSuggestion[];
  onTextChange: (text: string) => void;
}

interface RewriteVariation {
  text: string;
  explanation: string;
}

export const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(
  function TiptapEditor({ suggestions, onTextChange }, ref) {
    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: "Start writing your thoughts..." }),
        SuggestionDecoration.configure({ suggestions })
      ],
      content: "<p>Writing is a skill that gets stronger with every thoughtful sentence. Try adding an idea and CheckGram will help you make it clearer, more engaging, and more confident.</p>",
      editorProps: { attributes: { class: "editor-content" } },
      onUpdate: ({ editor: currentEditor }) => onTextChange(currentEditor.getText({ blockSeparator: "\n" }))
    });

    const editorShellRef = useRef<HTMLDivElement | null>(null);
    const [selection, setSelection] = useState<null | {
      from: number;
      to: number;
      text: string;
      left: number;
      top: number;
    }>(null);
    const [loading, setLoading] = useState(false);
    const [variations, setVariations] = useState<RewriteVariation[]>([]);

    useEffect(() => {
      if (!editor) return undefined;
      const updateSelectionState = () => {
        const { from, to, empty } = editor.state.selection;
        if (empty) {
          setSelection(null);
          setVariations([]);
          setLoading(false);
          return;
        }

        const selectedText = editor.state.doc.textBetween(from, to);
        if (!selectedText.trim()) {
          setSelection(null);
          return;
        }

        const startCoords = editor.view.coordsAtPos(from);
        const endCoords = editor.view.coordsAtPos(to);
        const left = Math.min(startCoords.left, endCoords.left);
        const top = Math.min(startCoords.top, endCoords.top) - 54;
        setSelection({ from, to, text: selectedText, left, top });
      };

      editor.on("selectionUpdate", updateSelectionState);
      updateSelectionState();
      return () => {
        editor.off("selectionUpdate", updateSelectionState);
      };
    }, [editor]);

    useImperativeHandle(ref, () => ({
      focusSuggestion: (suggestion) => {
        if (!editor) return;
        const positions = offsetPositions(editor.state.doc, suggestion.startOffset, suggestion.endOffset);
        if (!positions) return;
        editor.chain().focus().setTextSelection(positions).scrollIntoView().run();
        editor.view.dispatch(editor.state.tr.setMeta(suggestionPluginKey, {
          suggestions,
          selectedSuggestionKey: suggestionKey(suggestion)
        }));
      },
      acceptSuggestion: (suggestion) => {
        if (!editor) return false;
        const positions = offsetPositions(editor.state.doc, suggestion.startOffset, suggestion.endOffset);
        const replacement = suggestion.replacementOptions[0];
        if (!positions || !replacement) return false;
        editor.chain().focus().insertContentAt(positions, replacement).run();
        return true;
      }
    }), [editor, suggestions]);

    useEffect(() => {
      if (!editor) return;
      editor.view.dispatch(editor.state.tr.setMeta(suggestionPluginKey, { suggestions }));
    }, [editor, suggestions]);

    const handleRewriteAction = async (mode: RewriteMode) => {
      if (!editor || !selection) return;
      setLoading(true);
      setVariations([]);

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/rewrite`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: selection.text, tone: actionTones[mode] })
        });

        if (!response.ok) throw new Error("Rewrite request failed");
        const payload = await response.json() as { variations?: RewriteVariation[] };
        setVariations(payload.variations ?? []);
      } catch {
        setVariations([]);
      } finally {
        setLoading(false);
      }
    };

    const replaceSelection = (replacement: string) => {
      if (!editor || !selection) return;
      editor.chain().focus().setTextSelection({ from: selection.from, to: selection.to }).deleteSelection().insertContent(replacement).run();
      setSelection(null);
      setVariations([]);
      setLoading(false);
    };

    return (
      <div className="editor-shell" ref={editorShellRef}>
        <EditorContent editor={editor} />
        {selection && (
          <div className="selection-toolbar" style={{ left: selection.left, top: selection.top }}>
            {loading ? (
              <div className="rewrite-skeleton" aria-live="polite">
                <span />
                <span />
                <span />
              </div>
            ) : (
              <>
                {(["Rewrite", "Shorten", "Formal", "Friendly"] as const).map((label) => (
                  <button type="button" key={label} className="rewrite-action" onClick={() => handleRewriteAction(label === "Formal" ? "Formal" : label === "Friendly" ? "Friendly" : label === "Shorten" ? "Shorten" : "Rewrite")}>
                    {label}
                  </button>
                ))}
                {variations.length > 0 && (
                  <div className="rewrite-menu">
                    {variations.map((variation) => (
                      <div key={`${variation.text}-${variation.explanation}`} className="rewrite-menu-item">
                        <div className="rewrite-menu-content">
                          <strong>{variation.text}</strong>
                          <small>{variation.explanation}</small>
                        </div>
                        <button type="button" className="replace-button" onClick={() => replaceSelection(variation.text)}>
                          Replace Selection
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }
);

"use client";

import { forwardRef, useEffect, useImperativeHandle } from "react";
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

export interface TiptapEditorHandle {
  focusSuggestion: (suggestion: EditorSuggestion) => void;
  acceptSuggestion: (suggestion: EditorSuggestion) => boolean;
}

interface TiptapEditorProps {
  suggestions: EditorSuggestion[];
  onTextChange: (text: string) => void;
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

  return <EditorContent editor={editor} />;
});

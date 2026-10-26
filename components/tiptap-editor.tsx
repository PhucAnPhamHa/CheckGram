"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { suggestionPluginKey, SuggestionDecoration, type EditorSuggestion } from "./suggestion-decoration";

interface TiptapEditorProps {
  suggestions: EditorSuggestion[];
  tone: string;
  onTextChange: (text: string) => void;
}

export function TiptapEditor({ suggestions, onTextChange }: TiptapEditorProps) {
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

  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(suggestionPluginKey, { suggestions }));
  }, [editor, suggestions]);

  return <EditorContent editor={editor} />;
}

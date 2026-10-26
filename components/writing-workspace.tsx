"use client";

import { useEffect, useRef, useState } from "react";
import { TiptapEditor } from "./tiptap-editor";
import type { EditorSuggestion } from "./suggestion-decoration";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const tones = ["Neutral", "Professional", "Friendly", "Concise"];

function categoryClass(category: EditorSuggestion["suggestionType"]) {
  return `category-${category.toLowerCase()}`;
}

export function WritingWorkspace() {
  const [tone, setTone] = useState("Neutral");
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<EditorSuggestion[]>([]);
  const [status, setStatus] = useState("Ready to write");
  const requestId = useRef(0);

  useEffect(() => {
    if (!text.trim()) {
      setSuggestions([]);
      setStatus("Ready to write");
      return;
    }

    const currentRequestId = ++requestId.current;
    setStatus("Checking your writing...");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, tone })
        });
        if (!response.ok) throw new Error("Analysis failed");
        const payload = await response.json() as { suggestions: EditorSuggestion[] };
        if (currentRequestId === requestId.current) {
          setSuggestions(payload.suggestions);
          setStatus(payload.suggestions.length ? `${payload.suggestions.length} suggestions found` : "Looks good");
        }
      } catch {
        if (currentRequestId === requestId.current) setStatus("Analysis unavailable");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [text, tone]);

  return (
    <main className="app-shell">
      <section className="main-pane">
        <header className="topbar">
          <div className="brand">check<span>gram</span></div>
          <div className="status"><span className="status-dot" />{status}</div>
        </header>
        <div className="hero">
          <div className="eyebrow">AI writing partner</div>
          <h1>Make every sentence count.</h1>
          <p className="subtitle">Write naturally. Get real-time feedback on correctness, clarity, engagement, and delivery.</p>
        </div>
        <div className="editor-card">
          <div className="editor-toolbar">
            <span className="toolbar-label">Untitled document</span>
            <label>
              <span className="toolbar-label">Tone </span>
              <select className="tone-select" value={tone} onChange={(event) => setTone(event.target.value)}>
                {tones.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <TiptapEditor suggestions={suggestions} tone={tone} onTextChange={setText} />
          <div className="editor-footer"><span>Tip: keep writing — feedback appears as you go.</span><span>{text.length} characters</span></div>
        </div>
      </section>
      <aside className="sidebar">
        <h2>Writing insights</h2>
        <p className="sidebar-copy">Suggestions are underlined in the editor and grouped by the kind of improvement they offer.</p>
        <div className="legend">
          {(["Correctness", "Clarity", "Engagement", "Delivery"] as const).map((category) => (
            <div className="legend-item" key={category}><span className={`legend-swatch ${categoryClass(category)}`} />{category}</div>
          ))}
        </div>
        <div className="suggestion-list">
          {suggestions.length === 0
            ? <div className="empty-state">No suggestions yet. Add a sentence with a typo, a long phrase, or a different tone to see CheckGram in action.</div>
            : suggestions.map((suggestion, index) => (
              <article className="suggestion-card" key={`${suggestion.startOffset}-${suggestion.endOffset}-${index}`}>
                <div className="suggestion-card-head"><span className={`category ${categoryClass(suggestion.suggestionType)}`}>{suggestion.suggestionType}</span><span className="toolbar-label">{suggestion.source}</span></div>
                <p className="suggestion-original">“{text.slice(suggestion.startOffset, suggestion.endOffset)}”{suggestion.replacementOptions[0] ? ` → ${suggestion.replacementOptions[0]}` : ""}</p>
                <p className="suggestion-explanation">{suggestion.explanation}</p>
              </article>
            ))}
        </div>
      </aside>
    </main>
  );
}

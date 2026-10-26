"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TiptapEditor, type TiptapEditorHandle } from "./tiptap-editor";
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
  const analysisController = useRef<AbortController | null>(null);
  const editorRef = useRef<TiptapEditorHandle>(null);

  useEffect(() => {
    analysisController.current?.abort();
    if (!text.trim()) {
      setSuggestions([]);
      setStatus("Ready to write");
      return;
    }

    const currentRequestId = ++requestId.current;
    setStatus("Checking your writing...");
    const timer = window.setTimeout(async () => {
      const controller = new AbortController();
      analysisController.current = controller;
      let receivedSuggestions = 0;
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/analyze/stream`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, tone }),
          signal: controller.signal
        });
        if (!response.ok || !response.body) throw new Error("Analysis stream failed");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const consumeEvent = (rawEvent: string) => {
          const eventName = rawEvent.match(/^event:\s*(.+)$/m)?.[1];
          const dataLine = rawEvent.match(/^data:\s*(.+)$/m)?.[1];
          if (!eventName || !dataLine || currentRequestId !== requestId.current) return;
          const data = JSON.parse(dataLine) as {
            suggestions?: EditorSuggestion[];
            blockIndex?: number;
            blockCount?: number;
          };
          if (eventName === "analysis.started") {
            setStatus(`Checking ${data.blockCount ?? 0} blocks...`);
          } else if (eventName === "suggestions.block") {
            const incoming = data.suggestions ?? [];
            receivedSuggestions += incoming.length;
            setSuggestions((current) => [...current, ...incoming]);
            setStatus(`Checking block ${(data.blockIndex ?? 0) + 1}... ${receivedSuggestions} found`);
          } else if (eventName === "analysis.completed") {
            setStatus(receivedSuggestions ? `${receivedSuggestions} suggestions found` : "Looks good");
          } else if (eventName === "analysis.failed") {
            setStatus("Analysis unavailable");
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          events.forEach(consumeEvent);
          if (done) break;
        }
      } catch {
        if (!controller.signal.aborted && currentRequestId === requestId.current) setStatus("Analysis unavailable");
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
      analysisController.current?.abort();
    };
  }, [text, tone]);

  const groupedSuggestions = useMemo(() => (
    (["Correctness", "Clarity", "Engagement", "Delivery"] as const).map((category) => ({
      category,
      suggestions: suggestions.filter((suggestion) => suggestion.suggestionType === category)
    }))
  ), [suggestions]);

  function dismissSuggestion(target: EditorSuggestion) {
    setSuggestions((current) => current.filter((suggestion) => suggestion !== target));
  }

  function acceptSuggestion(target: EditorSuggestion) {
    if (editorRef.current?.acceptSuggestion(target)) {
      setSuggestions((current) => current.filter((suggestion) => suggestion !== target));
    }
  }

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
          <TiptapEditor ref={editorRef} suggestions={suggestions} onTextChange={setText} />
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
            : groupedSuggestions.map(({ category, suggestions: categorySuggestions }) => categorySuggestions.length > 0 && (
              <section className="suggestion-group" key={category}>
                <h3 className={`suggestion-group-title ${categoryClass(category)}`}>{category}<span>{categorySuggestions.length}</span></h3>
                {categorySuggestions.map((suggestion) => (
                  <article
                    className="suggestion-card"
                    key={`${suggestion.startOffset}-${suggestion.endOffset}-${suggestion.suggestionType}`}
                    onClick={() => editorRef.current?.focusSuggestion(suggestion)}
                  >
                    <div className="suggestion-card-head"><span className={`category ${categoryClass(suggestion.suggestionType)}`}>{suggestion.suggestionType}</span><span className="toolbar-label">{suggestion.source}</span></div>
                    <p className="suggestion-original">“{text.slice(suggestion.startOffset, suggestion.endOffset)}”{suggestion.replacementOptions[0] ? ` → ${suggestion.replacementOptions[0]}` : ""}</p>
                    <p className="suggestion-explanation">{suggestion.explanation}</p>
                    <div className="suggestion-actions">
                      <button type="button" className="accept-button" onClick={(event) => { event.stopPropagation(); acceptSuggestion(suggestion); }}>Accept</button>
                      <button type="button" className="dismiss-button" onClick={(event) => { event.stopPropagation(); dismissSuggestion(suggestion); }}>Dismiss</button>
                    </div>
                  </article>
                ))}
              </section>
            ))}
        </div>
      </aside>
    </main>
  );
}

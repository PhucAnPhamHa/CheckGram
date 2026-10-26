"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { TiptapEditor } from "./tiptap-editor";

interface DocumentRow {
  id: string;
  title: string;
  current_version: number;
  current_content: Record<string, unknown>;
  updated_at: string;
}

const emptyDocument = { type: "doc", content: [{ type: "paragraph" }] };

export function Dashboard() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [active, setActive] = useState<DocumentRow | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    setUserEmail(user.email ?? "");
    const { data } = await supabase.from("documents")
      .select("id,title,current_version,current_content,updated_at")
      .eq("is_archived", false)
      .order("updated_at", { ascending: false });
    setDocuments((data ?? []) as DocumentRow[]);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  async function createDocument() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/login");
    const { data } = await supabase.from("documents").insert({
      owner_id: user.id,
      title: "Untitled document",
      current_content: emptyDocument,
      current_plain_text: ""
    }).select("id,title,current_version,current_content,updated_at").single();
    if (data) {
      const document = data as DocumentRow;
      setDocuments((current) => [document, ...current]);
      setActive(document);
    }
  }

  async function renameDocument(document: DocumentRow) {
    if (!supabase) return;
    const title = window.prompt("Document name", document.title)?.trim();
    if (!title || title === document.title) return;
    const { data } = await supabase.from("documents").update({ title }).eq("id", document.id)
      .select("id,title,current_version,current_content,updated_at").single();
    if (data) {
      const updated = data as DocumentRow;
      setDocuments((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (active?.id === updated.id) setActive(updated);
    }
  }

  async function archiveDocument(document: DocumentRow) {
    if (!supabase || !window.confirm(`Move "${document.title}" to trash?`)) return;
    await supabase.from("documents").update({ is_archived: true }).eq("id", document.id);
    setDocuments((current) => current.filter((item) => item.id !== document.id));
    if (active?.id === document.id) setActive(null);
  }

  function saveContent(content: Record<string, unknown>, plainText: string) {
    if (!supabase || !active) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = window.setTimeout(async () => {
      const { data } = await supabase.from("documents").update({
        current_content: content,
        current_plain_text: plainText,
        current_version: active.current_version + 1
      }).eq("id", active.id).select("id,title,current_version,current_content,updated_at").single();
      if (data) setActive(data as DocumentRow);
      setSaving(false);
      void loadDocuments();
    }, 700);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div className="brand">check<span>gram</span></div>
        <div className="dashboard-account"><span>{userEmail}</span><button type="button" className="link-button" onClick={signOut}>Sign out</button></div>
      </header>
      <div className="dashboard-layout">
        <aside className="documents-panel">
          <div className="documents-heading"><div><p className="eyebrow">Workspace</p><h1>Your documents</h1></div><button type="button" className="new-document-button" onClick={createDocument}>+</button></div>
          {loading && <p className="sidebar-copy">Loading documents...</p>}
          {!loading && documents.length === 0 && <div className="empty-state">No documents yet. Create your first draft.</div>}
          <div className="document-list">
            {documents.map((document) => (
              <button type="button" className={`document-row ${active?.id === document.id ? "document-row-active" : ""}`} key={document.id} onClick={() => setActive(document)}>
                <span className="document-row-title">{document.title}</span>
                <span className="document-row-date">{new Date(document.updated_at).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="dashboard-editor">
          {!active ? <div className="dashboard-empty"><h2>Choose a document</h2><p>Select a draft or create a new one to start writing.</p><button type="button" className="primary-button" onClick={createDocument}>Create document</button></div> : (
            <>
              <div className="document-toolbar"><div><h2>{active.title}</h2><span className="toolbar-label">{saving ? "Saving..." : "Saved"}</span></div><div className="document-actions"><button type="button" className="secondary-button" onClick={() => renameDocument(active)}>Rename</button><button type="button" className="danger-button" onClick={() => archiveDocument(active)}>Delete</button></div></div>
              <TiptapEditor key={active.id} initialContent={active.current_content} suggestions={[]} onJsonChange={(content, plainText) => saveContent(content, plainText)} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

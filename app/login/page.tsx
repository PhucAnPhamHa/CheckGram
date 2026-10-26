"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/dashboard");
    });
  }, [router, supabase]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Add Supabase credentials to .env.local to enable authentication.");
      return;
    }
    setBusy(true);
    setMessage("");
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
    } else {
      setMessage(mode === "sign-up" ? "Check your email to confirm your account." : "");
      if (mode === "sign-in") router.replace("/dashboard");
    }
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setMessage("Add Supabase credentials to .env.local to enable authentication.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` }
    });
    if (error) setMessage(error.message);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">check<span>gram</span></div>
        <p className="eyebrow">Your writing workspace</p>
        <h1>{mode === "sign-in" ? "Welcome back." : "Create your account."}</h1>
        <p className="subtitle">Save documents, keep your drafts synced, and write with confidence.</p>
        <button type="button" className="google-button" onClick={signInWithGoogle}>Continue with Google</button>
        <div className="auth-divider"><span>or use email</span></div>
        <form className="auth-form" onSubmit={submit}>
          <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button type="submit" className="primary-button" disabled={busy}>{busy ? "Working..." : mode === "sign-in" ? "Sign in" : "Sign up"}</button>
        </form>
        {message && <p className="auth-message">{message}</p>}
        <button type="button" className="link-button" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
          {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

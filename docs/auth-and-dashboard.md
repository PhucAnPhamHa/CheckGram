# Supabase Auth and document dashboard

## Supabase setup

1. Copy `.env.local.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. In Supabase Auth, enable Email provider and Google provider.
4. Add `http://localhost:3000/auth/callback` to the Supabase redirect URL allow list. Add the production callback URL before deploying.
5. Apply `supabase/migrations/001_initial_schema.sql` and `002_documents_rls.sql`.

The browser uses `@supabase/ssr` for cookie-backed sessions. Middleware refreshes the session and protects `/dashboard`; the OAuth callback exchanges the provider code for a Supabase session.

## Dashboard behavior

- `/login` supports Google OAuth and email/password sign-up/sign-in.
- `/dashboard` lists active documents ordered by `updated_at`.
- New documents are created with an empty TipTap JSON document.
- Rename updates the document title.
- Delete is a soft delete (`is_archived = true`), so document content remains recoverable by a privileged server workflow.
- TipTap JSON and its plain-text projection are saved 700 ms after the user stops editing.
- RLS binds every document operation to `auth.uid()`. The browser never supplies an owner ID for reads or updates; inserts use the authenticated user ID and are still enforced by PostgreSQL.

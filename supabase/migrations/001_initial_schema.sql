create extension if not exists pgcrypto;

create type public.suggestion_type as enum (
  'grammar', 'spelling', 'punctuation', 'style', 'clarity',
  'tone', 'rewrite', 'conciseness', 'custom'
);

create type public.suggestion_status as enum (
  'active', 'accepted', 'dismissed', 'ignored', 'stale'
);

create type public.analysis_status as enum (
  'queued', 'processing', 'completed', 'failed'
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'en-US',
  preferred_tone text not null default 'professional',
  formality_level text not null default 'neutral',
  enable_grammar_checks boolean not null default true,
  enable_tone_detection boolean not null default true,
  enable_rewrites boolean not null default true,
  auto_analyze boolean not null default true,
  analysis_debounce_ms integer not null default 800
    check (analysis_debounce_ms between 200 and 5000),
  ignored_suggestion_types jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled document',
  current_version integer not null default 1 check (current_version > 0),
  current_content jsonb not null default '{}'::jsonb,
  current_plain_text text not null default '',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version integer not null check (version > 0),
  editor_content jsonb not null,
  plain_text text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  document_version integer not null check (document_version > 0),
  status public.analysis_status not null default 'queued',
  requested_checks jsonb not null default '["grammar","tone"]'::jsonb,
  provider_metadata jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  document_version integer not null check (document_version > 0),
  analysis_job_id uuid references public.analysis_jobs(id) on delete set null,
  suggestion_type public.suggestion_type not null,
  status public.suggestion_status not null default 'active',
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null check (end_offset > start_offset),
  original_text text not null check (char_length(original_text) > 0),
  replacement_text text,
  explanation text not null,
  confidence numeric(5, 4) check (confidence is null or confidence between 0 and 1),
  severity integer not null default 1 check (severity between 1 and 5),
  source text not null check (source in ('languagetool', 'openai', 'system')),
  rule_id text,
  category text not null check (category in ('correctness', 'clarity', 'tone', 'style', 'rewriting')),
  alternatives jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suggestion_events (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('shown', 'accepted', 'dismissed', 'ignored')),
  created_at timestamptz not null default now()
);

create index documents_owner_updated_idx on public.documents(owner_id, updated_at desc);
create index document_versions_lookup_idx on public.document_versions(document_id, version desc);
create index analysis_jobs_lookup_idx on public.analysis_jobs(document_id, created_at desc);
create index suggestions_version_lookup_idx on public.suggestions(document_id, document_version, status);
create index suggestions_active_lookup_idx on public.suggestions(document_id, status)
  where status = 'active';

alter table public.user_preferences enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.analysis_jobs enable row level security;
alter table public.suggestions enable row level security;
alter table public.suggestion_events enable row level security;

create policy "Users manage their preferences"
  on public.user_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage their documents"
  on public.documents for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Users read their document versions"
  on public.document_versions for select
  using (exists (
    select 1 from public.documents d
    where d.id = document_id and d.owner_id = auth.uid()
  ));

create policy "Users create their document versions"
  on public.document_versions for insert
  with check (created_by = auth.uid() and exists (
    select 1 from public.documents d
    where d.id = document_id and d.owner_id = auth.uid()
  ));

create policy "Users manage their analysis jobs"
  on public.analysis_jobs for all
  using (exists (
    select 1 from public.documents d
    where d.id = document_id and d.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.documents d
    where d.id = document_id and d.owner_id = auth.uid()
  ));

create policy "Users manage their suggestions"
  on public.suggestions for all
  using (exists (
    select 1 from public.documents d
    where d.id = document_id and d.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.documents d
    where d.id = document_id and d.owner_id = auth.uid()
  ));

create policy "Users manage their suggestion events"
  on public.suggestion_events for all
  using (user_id = auth.uid() and exists (
    select 1
    from public.suggestions s
    join public.documents d on d.id = s.document_id
    where s.id = suggestion_id and d.owner_id = auth.uid()
  ))
  with check (user_id = auth.uid() and exists (
    select 1
    from public.suggestions s
    join public.documents d on d.id = s.document_id
    where s.id = suggestion_id and d.owner_id = auth.uid()
  ));

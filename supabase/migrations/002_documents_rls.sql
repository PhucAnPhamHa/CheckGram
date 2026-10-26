drop policy if exists "Users manage their documents" on public.documents;

create policy "Users read their active documents"
  on public.documents for select
  using (owner_id = auth.uid() and is_archived = false);

create policy "Users create their own documents"
  on public.documents for insert
  with check (owner_id = auth.uid());

create policy "Users update their own documents"
  on public.documents for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Users archive their own documents"
  on public.documents for delete
  using (owner_id = auth.uid());

create index if not exists documents_active_owner_updated_idx
  on public.documents(owner_id, updated_at desc)
  where is_archived = false;

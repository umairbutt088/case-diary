-- =============================================================================
-- Legal Diary: Allow users to update their own saved judges
-- =============================================================================

drop policy if exists "Users can update own judges" on public.judges;

create policy "Users can update own judges"
  on public.judges for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

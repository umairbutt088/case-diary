-- =============================================================================
-- Legal Diary: Only the owning lawyer account may delete or trash cases.
-- Subordinates with edit access may update cases but cannot set deleted_at or DELETE rows.
-- =============================================================================

drop policy if exists "Users or permitted subordinates can delete cases" on public.cases;

create policy "Case owners can delete cases"
  on public.cases for delete
  using (auth.uid() = user_id);

drop policy if exists "Users or permitted subordinates can update cases" on public.cases;

create policy "Users or permitted subordinates can update cases"
  on public.cases for update
  using (public.can_access_owner_data(user_id, 'edit_cases'))
  with check (
    public.can_access_owner_data(user_id, 'edit_cases')
    and (
      auth.uid() = user_id
      or deleted_at is null
    )
  );

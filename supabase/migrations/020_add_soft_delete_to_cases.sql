-- =============================================================================
-- Legal Diary: Soft-delete for cases
-- Instead of removing cases permanently, set deleted_at to mark them as
-- deleted. Active cases filter WHERE deleted_at IS NULL.
-- Deleted cases are shown in a "Trash" screen and can be restored or
-- permanently deleted from there.
-- =============================================================================

alter table public.cases
  add column if not exists deleted_at timestamptz default null;

-- Index so filtering active cases (IS NULL) is fast
create index if not exists cases_deleted_at_idx
  on public.cases (user_id, deleted_at)
  where deleted_at is null;

-- RLS: existing policies already filter by user_id so no change needed.
-- The app-layer sends the appropriate query (IS NULL vs IS NOT NULL).

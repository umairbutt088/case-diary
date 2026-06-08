-- Remove unused payment tracking (feature removed from app).
drop table if exists public.case_payments cascade;

-- Mark finished cases as disposed (separate from Trash soft-delete).
alter table public.cases
  add column if not exists disposed_at timestamptz default null,
  add column if not exists disposal_note text;

create index if not exists cases_disposed_at_idx
  on public.cases (user_id, disposed_at)
  where disposed_at is null;

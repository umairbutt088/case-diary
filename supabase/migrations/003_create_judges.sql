
-- =============================================================================
-- Legal Diary: Saved judge names (per user, for picker in add-case)
-- =============================================================================

create table if not exists public.judges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists judges_user_id_idx on public.judges (user_id);
create unique index if not exists judges_user_name_unique
  on public.judges (user_id, lower(trim(name)));

alter table public.judges enable row level security;

create policy "Users can read own judges"
  on public.judges for select
  using (auth.uid() = user_id);

create policy "Users can insert own judges"
  on public.judges for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own judges"
  on public.judges for delete
  using (auth.uid() = user_id);

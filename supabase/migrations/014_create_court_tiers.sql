-- Saved custom court tiers per user.

create table if not exists public.court_tiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists court_tiers_user_id_idx on public.court_tiers (user_id);

create unique index if not exists court_tiers_user_name_unique
  on public.court_tiers (user_id, lower(trim(name)));

alter table public.court_tiers enable row level security;

create policy "Users can read own court tiers"
  on public.court_tiers for select
  using (auth.uid() = user_id);

create policy "Users can insert own court tiers"
  on public.court_tiers for insert
  with check (auth.uid() = user_id);

-- =============================================================================
-- Legal Diary: Profiles table and auth trigger
-- Run this in Supabase Dashboard → SQL Editor (or via Supabase CLI).
-- =============================================================================

-- Profiles: one row per user, keyed by auth.users.id
-- Holds app-specific profile data (email, name, role, etc.)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  full_name text,
  role text not null default 'user' check (role in ('user', 'partner', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional: index for lookups by role (e.g. role-based routing)
create index if not exists profiles_role_idx on public.profiles (role);

-- Trigger: auto-create a profile when a new user signs up (auth.users insert)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  fname text := trim(coalesce(new.raw_user_meta_data->>'first_name', ''));
  lname text := trim(coalesce(new.raw_user_meta_data->>'last_name', ''));
  ffull  text := trim(coalesce(new.raw_user_meta_data->>'full_name', fname || ' ' || lname));
begin
  insert into public.profiles (id, email, first_name, last_name, full_name, role)
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data->>'email'),
    nullif(fname, ''),
    nullif(lname, ''),
    nullif(ffull, ''),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: users can read/update only their own profile
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Service role can manage all (e.g. admin). Anon can't insert; only trigger does.
create policy "No insert by users (trigger only)"
  on public.profiles for insert
  with check (false);

-- Optional: allow service role to do anything (for admin tools)
-- create policy "Service role full access" on public.profiles for all using (auth.jwt() ->> 'role' = 'service_role');

-- Helper: keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Done. After running:
-- - New signups will get a row in public.profiles automatically.
-- - Pass in signup: options.data { first_name, last_name, full_name, role }
-- =============================================================================

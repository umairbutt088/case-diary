-- =============================================================================
-- Legal Diary: Cases table (add-case form data)
-- Run in Supabase Dashboard → SQL Editor, or: supabase db push
-- =============================================================================

-- Cases: one row per case, owned by the authenticated user
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Step 1: Parties and case type
  case_title text,
  case_number text,
  case_type text,
  case_sub_type text,
  petitioner_name text not null default '',
  respondent_name text not null default '',

  -- Step 2: Court
  court_tier text,
  court_name text,
  court_room text,
  judge_name text,

  -- Step 3: Client (who we represent)
  my_client_is text check (my_client_is in ('petitioner', 'respondent') or my_client_is is null),
  linked_client_id uuid null,

  -- Step 4: Dates and status
  date_of_filing date,
  next_hearing_date date,
  current_status text,
  next_status text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists cases_user_id_idx on public.cases (user_id);
create index if not exists cases_next_hearing_date_idx on public.cases (next_hearing_date);
create index if not exists cases_created_at_idx on public.cases (created_at desc);

-- RLS: users can only see and manage their own cases
alter table public.cases enable row level security;

create policy "Users can read own cases"
  on public.cases for select
  using (auth.uid() = user_id);

create policy "Users can insert own cases"
  on public.cases for insert
  with check (auth.uid() = user_id);

create policy "Users can update own cases"
  on public.cases for update
  using (auth.uid() = user_id);

create policy "Users can delete own cases"
  on public.cases for delete
  using (auth.uid() = user_id);

-- Keep updated_at in sync
drop trigger if exists cases_updated_at on public.cases;
create trigger cases_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Done. Table public.cases stores all add-case form fields per user.
-- =============================================================================

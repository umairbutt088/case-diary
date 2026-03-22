-- =============================================================================
-- Legal Diary: Hearing history per case
-- =============================================================================

create table if not exists public.case_hearings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Hearing/proceeding snapshot
  hearing_date date not null,
  proceeding text,
  current_status text,
  next_status text,
  next_hearing_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists case_hearings_case_id_idx
  on public.case_hearings (case_id, hearing_date desc, created_at desc);

create index if not exists case_hearings_user_id_idx
  on public.case_hearings (user_id, created_at desc);

alter table public.case_hearings enable row level security;

create policy "Users can read own case hearings"
  on public.case_hearings for select
  using (auth.uid() = user_id);

create policy "Users can insert own case hearings"
  on public.case_hearings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own case hearings"
  on public.case_hearings for update
  using (auth.uid() = user_id);

create policy "Users can delete own case hearings"
  on public.case_hearings for delete
  using (auth.uid() = user_id);

drop trigger if exists case_hearings_updated_at on public.case_hearings;
create trigger case_hearings_updated_at
  before update on public.case_hearings
  for each row execute function public.set_updated_at();

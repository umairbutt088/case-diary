-- Cause list reminders: push token + user preference fields
alter table public.profiles
  add column if not exists expo_push_token text null,
  add column if not exists timezone text null default 'UTC',
  add column if not exists cause_list_reminder_enabled boolean not null default true,
  add column if not exists cause_list_reminder_hour smallint not null default 21;

alter table public.profiles
  drop constraint if exists profiles_cause_list_reminder_hour_check;

alter table public.profiles
  add constraint profiles_cause_list_reminder_hour_check
  check (cause_list_reminder_hour between 0 and 23);

create index if not exists profiles_cause_list_reminder_enabled_idx
  on public.profiles (cause_list_reminder_enabled);

create index if not exists profiles_expo_push_token_idx
  on public.profiles (expo_push_token)
  where expo_push_token is not null;

-- Log table to guarantee idempotent reminder sends
create table if not exists public.notification_log (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  target_date date not null,
  status text not null default 'queued',
  payload jsonb null,
  error_message text null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists notification_log_unique_per_target
  on public.notification_log (user_id, notification_type, target_date);

create index if not exists notification_log_user_created_idx
  on public.notification_log (user_id, created_at desc);

alter table public.notification_log enable row level security;

drop policy if exists "Users can read own notification log" on public.notification_log;
create policy "Users can read own notification log"
  on public.notification_log for select
  using (auth.uid() = user_id);

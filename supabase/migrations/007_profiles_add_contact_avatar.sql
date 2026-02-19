-- Add contact and profile picture fields to profiles
alter table public.profiles
  add column if not exists phone text null,
  add column if not exists address text null,
  add column if not exists avatar_url text null;

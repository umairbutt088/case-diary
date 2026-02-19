-- Add detail columns to clients for "Add New Client" modal
alter table public.clients
  add column if not exists address text null,
  add column if not exists phone text null,
  add column if not exists email text null,
  add column if not exists care_of text null;

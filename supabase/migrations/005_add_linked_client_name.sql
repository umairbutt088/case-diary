-- Store linked client by name when selecting from parties in existing cases
alter table public.cases
  add column if not exists linked_client_name text null;

-- =============================================================================
-- Legal Diary: Subordinate access (separate login + delegated permissions)
-- =============================================================================

-- 1) Extend profile role to include subordinate.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'partner', 'admin', 'subordinate'));

-- 2) Supervisor <-> subordinate mapping with explicit permissions.
create table if not exists public.subordinate_links (
  id uuid primary key default gen_random_uuid(),
  supervisor_user_id uuid not null references auth.users (id) on delete cascade,
  subordinate_user_id uuid not null references auth.users (id) on delete cascade,
  is_active boolean not null default true,
  can_view_cases boolean not null default true,
  can_edit_cases boolean not null default false,
  can_view_clients boolean not null default false,
  can_manage_documents boolean not null default false,
  can_manage_settings boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subordinate_links_no_self check (supervisor_user_id <> subordinate_user_id),
  constraint subordinate_links_unique_subordinate unique (subordinate_user_id)
);

create index if not exists subordinate_links_supervisor_idx
  on public.subordinate_links (supervisor_user_id, is_active);

create index if not exists subordinate_links_subordinate_idx
  on public.subordinate_links (subordinate_user_id, is_active);

drop trigger if exists subordinate_links_updated_at on public.subordinate_links;
create trigger subordinate_links_updated_at
  before update on public.subordinate_links
  for each row execute function public.set_updated_at();

alter table public.subordinate_links enable row level security;

drop policy if exists "Supervisors can read subordinate links" on public.subordinate_links;
create policy "Supervisors can read subordinate links"
  on public.subordinate_links for select
  using (auth.uid() = supervisor_user_id);

drop policy if exists "Subordinates can read own link" on public.subordinate_links;
create policy "Subordinates can read own link"
  on public.subordinate_links for select
  using (auth.uid() = subordinate_user_id);

drop policy if exists "Supervisors can insert subordinate links" on public.subordinate_links;
create policy "Supervisors can insert subordinate links"
  on public.subordinate_links for insert
  with check (auth.uid() = supervisor_user_id);

drop policy if exists "Supervisors can update subordinate links" on public.subordinate_links;
create policy "Supervisors can update subordinate links"
  on public.subordinate_links for update
  using (auth.uid() = supervisor_user_id)
  with check (auth.uid() = supervisor_user_id);

drop policy if exists "Supervisors can delete subordinate links" on public.subordinate_links;
create policy "Supervisors can delete subordinate links"
  on public.subordinate_links for delete
  using (auth.uid() = supervisor_user_id);

-- Allow supervisors to read linked subordinate profiles for management UI.
drop policy if exists "Supervisors can read linked subordinate profiles" on public.profiles;
create policy "Supervisors can read linked subordinate profiles"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.subordinate_links sl
      where sl.subordinate_user_id = public.profiles.id
        and sl.supervisor_user_id = auth.uid()
        and sl.is_active
    )
  );

-- 3) Reusable permission helpers for RLS policies.
create or replace function public.can_access_owner_data(
  owner_id uuid,
  required_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if auth.uid() = owner_id then
    return true;
  end if;

  return exists (
    select 1
    from public.subordinate_links sl
    where sl.supervisor_user_id = owner_id
      and sl.subordinate_user_id = auth.uid()
      and sl.is_active
      and (
        case required_permission
          when 'view_cases' then sl.can_view_cases
          when 'edit_cases' then sl.can_edit_cases
          when 'view_clients' then sl.can_view_clients
          when 'manage_documents' then sl.can_manage_documents
          when 'manage_settings' then sl.can_manage_settings
          else false
        end
      )
  );
end;
$$;

grant execute on function public.can_access_owner_data(uuid, text) to anon, authenticated, service_role;

create or replace function public.can_access_storage_owner(
  owner_id_text text,
  required_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  begin
    owner_id := owner_id_text::uuid;
  exception
    when others then
      return false;
  end;
  return public.can_access_owner_data(owner_id, required_permission);
end;
$$;

grant execute on function public.can_access_storage_owner(text, text) to anon, authenticated, service_role;

-- 4) Refresh table policies to include subordinate permissions.

-- cases
drop policy if exists "Users can read own cases" on public.cases;
drop policy if exists "Users can insert own cases" on public.cases;
drop policy if exists "Users can update own cases" on public.cases;
drop policy if exists "Users can delete own cases" on public.cases;

create policy "Users or permitted subordinates can read cases"
  on public.cases for select
  using (public.can_access_owner_data(user_id, 'view_cases'));

create policy "Users or permitted subordinates can insert cases"
  on public.cases for insert
  with check (public.can_access_owner_data(user_id, 'edit_cases'));

create policy "Users or permitted subordinates can update cases"
  on public.cases for update
  using (public.can_access_owner_data(user_id, 'edit_cases'))
  with check (public.can_access_owner_data(user_id, 'edit_cases'));

create policy "Users or permitted subordinates can delete cases"
  on public.cases for delete
  using (public.can_access_owner_data(user_id, 'edit_cases'));

-- case hearings
drop policy if exists "Users can read own case hearings" on public.case_hearings;
drop policy if exists "Users can insert own case hearings" on public.case_hearings;
drop policy if exists "Users can update own case hearings" on public.case_hearings;
drop policy if exists "Users can delete own case hearings" on public.case_hearings;

create policy "Users or permitted subordinates can read case hearings"
  on public.case_hearings for select
  using (public.can_access_owner_data(user_id, 'view_cases'));

create policy "Users or permitted subordinates can insert case hearings"
  on public.case_hearings for insert
  with check (public.can_access_owner_data(user_id, 'edit_cases'));

create policy "Users or permitted subordinates can update case hearings"
  on public.case_hearings for update
  using (public.can_access_owner_data(user_id, 'edit_cases'))
  with check (public.can_access_owner_data(user_id, 'edit_cases'));

create policy "Users or permitted subordinates can delete case hearings"
  on public.case_hearings for delete
  using (public.can_access_owner_data(user_id, 'edit_cases'));

-- clients
drop policy if exists "Users can read own clients" on public.clients;
drop policy if exists "Users can insert own clients" on public.clients;
drop policy if exists "Users can update own clients" on public.clients;
drop policy if exists "Users can delete own clients" on public.clients;

create policy "Users or permitted subordinates can read clients"
  on public.clients for select
  using (public.can_access_owner_data(user_id, 'view_clients'));

create policy "Users or permitted subordinates can insert clients"
  on public.clients for insert
  with check (public.can_access_owner_data(user_id, 'edit_cases'));

create policy "Users or permitted subordinates can update clients"
  on public.clients for update
  using (public.can_access_owner_data(user_id, 'edit_cases'))
  with check (public.can_access_owner_data(user_id, 'edit_cases'));

create policy "Users or permitted subordinates can delete clients"
  on public.clients for delete
  using (public.can_access_owner_data(user_id, 'edit_cases'));

-- judges
drop policy if exists "Users can read own judges" on public.judges;
drop policy if exists "Users can insert own judges" on public.judges;
drop policy if exists "Users can update own judges" on public.judges;
drop policy if exists "Users can delete own judges" on public.judges;

create policy "Users or permitted subordinates can read judges"
  on public.judges for select
  using (public.can_access_owner_data(user_id, 'edit_cases'));

create policy "Users or permitted subordinates can insert judges"
  on public.judges for insert
  with check (public.can_access_owner_data(user_id, 'edit_cases'));

create policy "Users or permitted subordinates can update judges"
  on public.judges for update
  using (public.can_access_owner_data(user_id, 'edit_cases'))
  with check (public.can_access_owner_data(user_id, 'edit_cases'));

create policy "Users or permitted subordinates can delete judges"
  on public.judges for delete
  using (public.can_access_owner_data(user_id, 'edit_cases'));

-- court tiers
drop policy if exists "Users can read own court tiers" on public.court_tiers;
drop policy if exists "Users can insert own court tiers" on public.court_tiers;

create policy "Users or permitted subordinates can read court tiers"
  on public.court_tiers for select
  using (public.can_access_owner_data(user_id, 'edit_cases'));

create policy "Users or permitted subordinates can insert court tiers"
  on public.court_tiers for insert
  with check (public.can_access_owner_data(user_id, 'edit_cases'));

drop policy if exists "Users can update own court tiers" on public.court_tiers;
create policy "Users or permitted subordinates can update court tiers"
  on public.court_tiers for update
  using (public.can_access_owner_data(user_id, 'edit_cases'))
  with check (public.can_access_owner_data(user_id, 'edit_cases'));

drop policy if exists "Users can delete own court tiers" on public.court_tiers;
create policy "Users or permitted subordinates can delete court tiers"
  on public.court_tiers for delete
  using (public.can_access_owner_data(user_id, 'edit_cases'));

-- case documents
drop policy if exists "Users can view their own case documents" on public.case_documents;
drop policy if exists "Users can insert their own case documents" on public.case_documents;
drop policy if exists "Users can delete their own case documents" on public.case_documents;

create policy "Users or permitted subordinates can read case documents"
  on public.case_documents for select
  using (public.can_access_owner_data(user_id, 'view_cases'));

create policy "Users or permitted subordinates can insert case documents"
  on public.case_documents for insert
  with check (public.can_access_owner_data(user_id, 'manage_documents'));

create policy "Users or permitted subordinates can delete case documents"
  on public.case_documents for delete
  using (public.can_access_owner_data(user_id, 'manage_documents'));

-- storage.objects for case documents bucket
drop policy if exists "Users can upload their own case documents" on storage.objects;
drop policy if exists "Users can select their own case documents" on storage.objects;
drop policy if exists "Users can delete their own case documents" on storage.objects;

create policy "Users or permitted subordinates can upload case documents"
  on storage.objects for insert
  with check (
    bucket_id = 'case_documents'
    and public.can_access_storage_owner((storage.foldername(name))[1], 'manage_documents')
  );

create policy "Users or permitted subordinates can select case documents"
  on storage.objects for select
  using (
    bucket_id = 'case_documents'
    and public.can_access_storage_owner((storage.foldername(name))[1], 'view_cases')
  );

create policy "Users or permitted subordinates can delete case documents"
  on storage.objects for delete
  using (
    bucket_id = 'case_documents'
    and public.can_access_storage_owner((storage.foldername(name))[1], 'manage_documents')
  );

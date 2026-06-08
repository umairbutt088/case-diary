-- =============================================================================
-- Legal Diary: Optional subordinate permission to dispose / restore cases
-- =============================================================================

alter table public.subordinate_links
  add column if not exists can_dispose_cases boolean not null default false;

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
          when 'add_cases' then sl.can_add_cases
          when 'edit_cases' then sl.can_edit_cases
          when 'delete_cases' then sl.can_delete_cases
          when 'dispose_cases' then sl.can_dispose_cases
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

create or replace function public.enforce_case_dispose_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = NEW.user_id then
    return NEW;
  end if;

  if OLD.disposed_at is distinct from NEW.disposed_at
     or OLD.disposal_note is distinct from NEW.disposal_note then
    if not public.can_access_owner_data(NEW.user_id, 'dispose_cases') then
      raise exception 'You do not have permission to dispose or restore cases.'
        using errcode = '42501';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_case_dispose_permission on public.cases;
create trigger enforce_case_dispose_permission
  before update on public.cases
  for each row execute function public.enforce_case_dispose_permission();

create or replace function public.create_subordinate_link_by_email(
  subordinate_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  supervisor_id uuid := auth.uid();
  normalized_email text := lower(trim(coalesce(subordinate_email, '')));
  subordinate_id uuid;
  subordinate_role text;
begin
  if supervisor_id is null then
    raise exception 'Not authenticated.';
  end if;

  if normalized_email = '' then
    raise exception 'Subordinate email is required.';
  end if;

  select p.id, p.role
    into subordinate_id, subordinate_role
  from public.profiles p
  where lower(coalesce(p.email, '')) = normalized_email
  limit 1;

  if subordinate_id is null then
    raise exception 'No account found for this email. Ask them to sign up first.';
  end if;

  if subordinate_id = supervisor_id then
    raise exception 'You cannot add yourself as a subordinate.';
  end if;

  if subordinate_role = 'admin' then
    raise exception 'Admin account cannot be assigned as subordinate.';
  end if;

  update public.profiles
  set role = 'subordinate',
      updated_at = now()
  where id = subordinate_id;

  insert into public.subordinate_links (
    supervisor_user_id,
    subordinate_user_id,
    is_active,
    can_view_cases,
    can_add_cases,
    can_edit_cases,
    can_delete_cases,
    can_dispose_cases,
    can_view_clients,
    can_manage_documents,
    can_manage_settings
  ) values (
    supervisor_id,
    subordinate_id,
    true,
    true,
    false,
    false,
    false,
    false,
    true,
    false,
    false
  )
  on conflict (subordinate_user_id)
  do update set
    supervisor_user_id = excluded.supervisor_user_id,
    is_active = true,
    updated_at = now();

  return subordinate_id;
end;
$$;

grant execute on function public.create_subordinate_link_by_email(text)
to authenticated, service_role;

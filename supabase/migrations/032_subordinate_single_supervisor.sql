-- =============================================================================
-- Legal Diary: One subordinate → one supervisor (no reassignment by another parent)
-- =============================================================================

create or replace function public.enforce_single_subordinate_supervisor()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1
      from public.subordinate_links sl
      where sl.subordinate_user_id = new.subordinate_user_id
        and sl.supervisor_user_id <> new.supervisor_user_id
    ) then
      raise exception
        'This account is already linked to another supervisor. They must be removed from that account first.';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.supervisor_user_id is distinct from old.supervisor_user_id then
      raise exception
        'Cannot reassign a subordinate to a different supervisor.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_single_subordinate_supervisor on public.subordinate_links;
create trigger enforce_single_subordinate_supervisor
  before insert or update on public.subordinate_links
  for each row execute function public.enforce_single_subordinate_supervisor();

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
  existing_supervisor_id uuid;
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

  select sl.supervisor_user_id
    into existing_supervisor_id
  from public.subordinate_links sl
  where sl.subordinate_user_id = subordinate_id
  limit 1;

  if existing_supervisor_id is not null and existing_supervisor_id <> supervisor_id then
    raise exception
      'This account is already linked to another supervisor. They must be removed from that account first.';
  end if;

  update public.profiles
  set role = 'subordinate',
      updated_at = now()
  where id = subordinate_id;

  if existing_supervisor_id = supervisor_id then
    update public.subordinate_links
    set is_active = true,
        updated_at = now()
    where subordinate_user_id = subordinate_id;
  else
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
    );
  end if;

  return subordinate_id;
end;
$$;

grant execute on function public.create_subordinate_link_by_email(text)
to authenticated, service_role;

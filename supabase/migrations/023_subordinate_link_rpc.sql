-- =============================================================================
-- Legal Diary: Supervisor helper RPC to add subordinate by email
-- =============================================================================

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
    can_edit_cases,
    can_view_clients,
    can_manage_documents,
    can_manage_settings
  ) values (
    supervisor_id,
    subordinate_id,
    true,
    true,
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

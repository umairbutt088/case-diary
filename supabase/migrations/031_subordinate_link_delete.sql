-- =============================================================================
-- Legal Diary: Remove subordinate link + reset profile role
-- Supervisors delete via RLS on subordinate_links; trigger demotes role to user.
-- =============================================================================

create or replace function public.handle_subordinate_link_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set role = 'user',
      updated_at = now()
  where id = old.subordinate_user_id
    and role = 'subordinate';

  return old;
end;
$$;

drop trigger if exists on_subordinate_link_deleted on public.subordinate_links;
create trigger on_subordinate_link_deleted
  after delete on public.subordinate_links
  for each row execute function public.handle_subordinate_link_deleted();

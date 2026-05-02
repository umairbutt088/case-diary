-- =============================================================================
-- Self-service account deletion (called from app via supabase.rpc).
-- Deletes auth.users row for the current session; ON DELETE CASCADE cleans public.*.
-- =============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  delete from auth.users where id = uid;
end;
$$;

comment on function public.delete_own_account() is
  'Deletes the authenticated user from auth.users; cascades to app tables. Invoked only from the mobile app after password confirmation.';

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

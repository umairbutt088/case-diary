-- Remove subordinate invite-by-link feature (table + RPCs).

drop function if exists public.accept_subordinate_invite(text);
drop function if exists public.get_subordinate_invite_preview(text);
drop function if exists public.create_subordinate_invite();

drop table if exists public.subordinate_invites cascade;

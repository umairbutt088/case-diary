-- Notify subordinate clients when their permission row changes.

alter table public.subordinate_links replica identity full;

do $migration$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'subordinate_links'
  ) then
    alter publication supabase_realtime add table public.subordinate_links;
  end if;
end $migration$;

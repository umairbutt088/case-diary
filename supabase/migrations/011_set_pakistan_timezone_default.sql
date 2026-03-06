-- Pakistan-only deployment: enforce Asia/Karachi as app timezone
alter table public.profiles
  alter column timezone set default 'Asia/Karachi';

update public.profiles
set timezone = 'Asia/Karachi'
where timezone is distinct from 'Asia/Karachi';

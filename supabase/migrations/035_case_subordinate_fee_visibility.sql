-- Per-case control: whether subordinates can see fee amounts and payment history.

alter table public.cases
  add column if not exists subordinates_can_view_fees boolean not null default true;

comment on column public.cases.subordinates_can_view_fees is
  'When false, subordinates with case access cannot view fee amounts or payment history for this case.';

create or replace function public.can_view_case_fees(
  owner_id uuid,
  p_case_id uuid
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

  if not public.can_access_owner_data(owner_id, 'view_cases') then
    return false;
  end if;

  return exists (
    select 1
    from public.cases c
    where c.id = p_case_id
      and c.user_id = owner_id
      and c.subordinates_can_view_fees = true
  );
end;
$$;

grant execute on function public.can_view_case_fees(uuid, uuid) to anon, authenticated, service_role;

drop policy if exists "Users or permitted subordinates can read case fee payments"
  on public.case_fee_payments;

create policy "Users or permitted subordinates can read case fee payments"
  on public.case_fee_payments for select
  using (public.can_view_case_fees(user_id, case_id));

drop policy if exists "Users or permitted subordinates can insert case fee payments"
  on public.case_fee_payments;

create policy "Users or permitted subordinates can insert case fee payments"
  on public.case_fee_payments for insert
  with check (
    public.can_access_owner_data(user_id, 'edit_cases')
    and public.can_view_case_fees(user_id, case_id)
  );

drop policy if exists "Users or permitted subordinates can delete case fee payments"
  on public.case_fee_payments;

create policy "Users or permitted subordinates can delete case fee payments"
  on public.case_fee_payments for delete
  using (
    public.can_access_owner_data(user_id, 'edit_cases')
    and public.can_view_case_fees(user_id, case_id)
  );

create or replace function public.guard_subordinate_case_fee_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = new.user_id then
    return new;
  end if;

  if not exists (
    select 1
    from public.subordinate_links sl
    where sl.supervisor_user_id = new.user_id
      and sl.subordinate_user_id = auth.uid()
      and sl.is_active
  ) then
    return new;
  end if;

  new.subordinates_can_view_fees := old.subordinates_can_view_fees;

  if not old.subordinates_can_view_fees then
    new.total_fee := old.total_fee;
    new.fee_received := old.fee_received;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_subordinate_case_fee_fields on public.cases;
create trigger guard_subordinate_case_fee_fields
  before update on public.cases
  for each row execute function public.guard_subordinate_case_fee_fields();

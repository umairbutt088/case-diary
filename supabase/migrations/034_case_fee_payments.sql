-- Fee payment history per case (trial / ongoing collections).

create table if not exists public.case_fee_payments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists case_fee_payments_case_id_idx
  on public.case_fee_payments (case_id, payment_date desc, created_at desc);

create index if not exists case_fee_payments_user_id_idx
  on public.case_fee_payments (user_id, created_at desc);

alter table public.case_fee_payments enable row level security;

create policy "Users or permitted subordinates can read case fee payments"
  on public.case_fee_payments for select
  using (public.can_access_owner_data(user_id, 'view_cases'));

create policy "Users or permitted subordinates can insert case fee payments"
  on public.case_fee_payments for insert
  with check (public.can_access_owner_data(user_id, 'edit_cases'));

create policy "Users or permitted subordinates can delete case fee payments"
  on public.case_fee_payments for delete
  using (public.can_access_owner_data(user_id, 'edit_cases'));

drop trigger if exists case_fee_payments_updated_at on public.case_fee_payments;
create trigger case_fee_payments_updated_at
  before update on public.case_fee_payments
  for each row execute function public.set_updated_at();

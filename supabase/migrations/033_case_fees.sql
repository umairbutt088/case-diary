-- Case fee tracking: agreed total and cumulative amount received.

alter table public.cases
  add column if not exists total_fee numeric(12, 2),
  add column if not exists fee_received numeric(12, 2) default 0;

comment on column public.cases.total_fee is 'Agreed total professional fee for the case (PKR).';
comment on column public.cases.fee_received is 'Cumulative fee received to date (PKR).';

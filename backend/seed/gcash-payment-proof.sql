-- GCash QR payments with manual verification.
-- Customers pay a static GCash QR, upload a screenshot, and staff/admin approve or reject it.
-- Run once in the Supabase SQL Editor. Existing orders and the PayMongo columns stay as they are
-- for historical records (see paymongo-payments.sql).

-- 1. Payment proof and verification details
alter table public.orders
  add column if not exists payment_proof_path text,
  add column if not exists payment_submitted_at timestamptz,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_verified_by uuid references public.profiles(id),
  add column if not exists payment_rejection_reason text;

-- 2. New payment statuses: pending_verification and rejected.
-- Handles either a check constraint or an enum on payment_status. The check is added
-- NOT VALID so older rows are never re-checked.
do $$
declare
  column_type text;
  column_udt text;
  existing_constraint record;
begin
  select data_type, udt_name
    into column_type, column_udt
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'payment_status';

  if column_type = 'USER-DEFINED' then
    execute format('alter type public.%I add value if not exists %L', column_udt, 'pending_verification');
    execute format('alter type public.%I add value if not exists %L', column_udt, 'rejected');
  else
    for existing_constraint in
      select conname
      from pg_constraint
      where conrelid = 'public.orders'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%payment_status%'
    loop
      execute format('alter table public.orders drop constraint %I', existing_constraint.conname);
    end loop;

    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('unpaid', 'paid', 'pending_verification', 'rejected'))
      not valid;
  end if;
end $$;

create index if not exists orders_payment_status_idx
  on public.orders (payment_status);

-- 3. Private bucket for payment screenshots (4 MB, under Vercel's request body limit).
-- No storage policies are added, so only the server (service role) can read or write;
-- customers and staff get short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 4194304, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 4. Only staff/admin (or the server) may change payment verification.
-- Customers can still create orders as unpaid or pending_verification.
create or replace function public.guard_order_payment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text;
begin
  -- Server routes use the service role (no auth.uid()) and enforce their own checks.
  if auth.uid() is null then
    return new;
  end if;

  select role into requester_role from public.profiles where id = auth.uid();

  if requester_role in ('staff', 'admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.payment_status, 'unpaid') not in ('unpaid', 'pending_verification')
      or new.payment_verified_at is not null
      or new.payment_verified_by is not null
      or new.paid_at is not null then
      raise exception 'Only staff can mark an order as paid.' using errcode = '42501';
    end if;

    return new;
  end if;

  if new.payment_status is distinct from old.payment_status
    or new.payment_proof_path is distinct from old.payment_proof_path
    or new.payment_verified_at is distinct from old.payment_verified_at
    or new.payment_verified_by is distinct from old.payment_verified_by
    or new.payment_rejection_reason is distinct from old.payment_rejection_reason
    or new.paid_at is distinct from old.paid_at then
    raise exception 'Only staff can change payment verification.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_guard_payment_fields on public.orders;

create trigger orders_guard_payment_fields
  before insert or update on public.orders
  for each row
  execute function public.guard_order_payment_fields();

-- 5. Staff/admin order list: same columns as admin-orders-view.sql, plus payment details at the end.
create or replace view public.admin_orders_view
with (security_invoker = true)
as
select
  orders.id,
  orders.customer_id,
  orders.order_type,
  orders.status,
  orders.payment_method,
  orders.payment_status,
  orders.total_amount,
  orders.delivery_fee,
  orders.reward_code,
  orders.reward_discount_amount,
  orders.ordered_at,
  orders.walkin_name,
  orders.delivery_address,
  orders.delivery_lat,
  orders.delivery_lng,
  orders.delivery_email,
  orders.delivery_phone,
  orders.encoded_by,
  profiles.full_name as customer_full_name,
  profiles.email as customer_email,
  profiles.phone as customer_phone,
  encoder_profiles.full_name as encoded_by_full_name,
  encoder_profiles.email as encoded_by_email,
  orders.payment_proof_path is not null as has_payment_proof,
  orders.payment_submitted_at,
  orders.payment_verified_at,
  orders.payment_verified_by,
  orders.payment_rejection_reason,
  verifier_profiles.full_name as payment_verified_by_full_name
from public.orders
left join public.profiles
  on profiles.id = orders.customer_id
left join public.profiles as encoder_profiles
  on encoder_profiles.id = orders.encoded_by
left join public.profiles as verifier_profiles
  on verifier_profiles.id = orders.payment_verified_by;

grant select on public.admin_orders_view to authenticated;

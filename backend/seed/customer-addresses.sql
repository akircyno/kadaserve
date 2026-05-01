create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  delivery_lat double precision,
  delivery_lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_addresses_address_check check (length(trim(address)) between 1 and 180),
  constraint customer_addresses_coordinates_check check (
    (delivery_lat is null and delivery_lng is null)
    or (
      delivery_lat between -90 and 90
      and delivery_lng between -180 and 180
    )
  )
);

create unique index if not exists customer_addresses_one_default_idx
on public.customer_addresses (customer_id)
where is_default;

alter table public.customer_addresses enable row level security;

drop policy if exists "Customers can read own addresses" on public.customer_addresses;
create policy "Customers can read own addresses"
on public.customer_addresses
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Customers can create own addresses" on public.customer_addresses;
create policy "Customers can create own addresses"
on public.customer_addresses
for insert
to authenticated
with check (customer_id = auth.uid());

drop policy if exists "Customers can update own addresses" on public.customer_addresses;
create policy "Customers can update own addresses"
on public.customer_addresses
for update
to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

drop policy if exists "Customers can delete own addresses" on public.customer_addresses;
create policy "Customers can delete own addresses"
on public.customer_addresses
for delete
to authenticated
using (customer_id = auth.uid());

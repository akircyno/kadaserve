create table if not exists public.reward_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  type text not null,
  points_cost integer not null check (points_cost >= 0),
  value numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint reward_items_type_check check (type in ('delivery_fee'))
);

create unique index if not exists reward_items_name_type_key
on public.reward_items (name, type);

create table if not exists public.customer_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  reward_item_id uuid not null references public.reward_items(id) on delete restrict,
  code text not null unique,
  status text not null default 'active',
  redeemed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  order_id uuid references public.orders(id) on delete set null,
  constraint customer_rewards_status_check check (status in ('active', 'used', 'expired'))
);

create index if not exists customer_rewards_customer_status_idx
on public.customer_rewards (customer_id, status, expires_at);

alter table public.orders
  add column if not exists reward_code text,
  add column if not exists reward_discount_amount numeric not null default 0,
  add column if not exists delivery_fee numeric not null default 0;

alter table public.reward_items enable row level security;
alter table public.customer_rewards enable row level security;

drop policy if exists "Reward items are readable" on public.reward_items;
create policy "Reward items are readable"
on public.reward_items
for select
using (true);

drop policy if exists "Admins can manage reward items" on public.reward_items;
create policy "Admins can manage reward items"
on public.reward_items
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'staff')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'staff')
  )
);

drop policy if exists "Customers can read own rewards" on public.customer_rewards;
create policy "Customers can read own rewards"
on public.customer_rewards
for select
to authenticated
using (
  customer_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'staff')
  )
);

drop policy if exists "Customers can create own rewards" on public.customer_rewards;
create policy "Customers can create own rewards"
on public.customer_rewards
for insert
to authenticated
with check (customer_id = auth.uid());

drop policy if exists "Customers can update own rewards" on public.customer_rewards;
create policy "Customers can update own rewards"
on public.customer_rewards
for update
to authenticated
using (
  customer_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'staff')
  )
)
with check (
  customer_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'staff')
  )
);

insert into public.reward_items (
  name,
  description,
  type,
  points_cost,
  value,
  is_active
)
values (
  'Free Delivery Voucher',
  'Redeem this voucher to remove the delivery fee from your order.',
  'delivery_fee',
  300,
  50,
  true
)
on conflict (name, type) do update
set
  description = excluded.description,
  points_cost = excluded.points_cost,
  value = excluded.value,
  is_active = excluded.is_active;

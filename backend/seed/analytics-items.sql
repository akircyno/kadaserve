alter table if exists public.analytics_items
add column if not exists menu_item_id uuid,
add column if not exists item_id uuid,
add column if not exists item_name text,
add column if not exists period_type text not null default 'daily',
add column if not exists period_start date not null default current_date,
add column if not exists order_count integer not null default 0,
add column if not exists quantity_sold integer not null default 0,
add column if not exists total_revenue numeric not null default 0,
add column if not exists avg_rating numeric not null default 0,
add column if not exists sales_rank integer not null default 0,
add column if not exists updated_at timestamptz not null default now();

update public.analytics_items
set menu_item_id = coalesce(menu_item_id, item_id)
where menu_item_id is null;

update public.analytics_items
set item_id = coalesce(item_id, menu_item_id)
where item_id is null;

create unique index if not exists analytics_items_item_id_key
on public.analytics_items (item_id);

alter table if exists public.analytics_items enable row level security;

drop policy if exists "Analytics items are readable by staff and admin" on public.analytics_items;
create policy "Analytics items are readable by staff and admin"
on public.analytics_items
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'staff')
  )
);

drop policy if exists "Admins can manage analytics items" on public.analytics_items;
create policy "Admins can manage analytics items"
on public.analytics_items
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

grant select, insert, update, delete on public.analytics_items to authenticated;

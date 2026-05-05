-- KadaServe inventory setup

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  on_hand integer not null default 0 check (on_hand >= 0),
  min_need integer not null default 0 check (min_need >= 0),
  max_cap integer not null default 0 check (max_cap >= 0),
  supplier text not null default 'Supplier',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint inventory_items_name_key unique (name)
);

create index if not exists inventory_items_name_idx
on public.inventory_items (lower(name));

alter table public.inventory_items enable row level security;

drop policy if exists "Staff can manage inventory items" on public.inventory_items;
create policy "Staff can manage inventory items"
on public.inventory_items
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

create or replace function public.set_inventory_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row
execute function public.set_inventory_items_updated_at();

insert into public.inventory_items (
  name,
  unit,
  on_hand,
  min_need,
  max_cap,
  supplier
)
values
  ('Fresh Milk', 'liter', 20, 10, 40, 'Local dairy supply'),
  ('Oat Milk', 'liter', 8, 6, 20, 'Supplier'),
  ('Condensed Milk', 'cans', 12, 8, 24, 'Supplier'),
  ('Coffee Beans', 'kg', 15, 8, 30, 'Supplier'),
  ('Espresso Capsules', 'pcs', 2, 10, 50, 'Supplier'),
  ('Matcha Powder', 'kg', 4, 4, 10, 'Supplier'),
  ('Sugar Syrup', 'bottle', 10, 6, 20, 'Supplier')
on conflict (name) do update
set
  unit = excluded.unit,
  on_hand = excluded.on_hand,
  min_need = excluded.min_need,
  max_cap = excluded.max_cap,
  supplier = excluded.supplier;

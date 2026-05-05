alter table if exists public.customer_preferences
add column if not exists frequency integer not null default 0,
add column if not exists recency_score numeric not null default 0,
add column if not exists avg_rating numeric not null default 0,
add column if not exists preference_score numeric not null default 0,
add column if not exists last_ordered_at timestamptz,
add column if not exists updated_at timestamptz not null default now();

create unique index if not exists customer_preferences_customer_menu_item_key
on public.customer_preferences (customer_id, menu_item_id);

alter table if exists public.customer_preferences enable row level security;

drop policy if exists "Customer preferences are readable by staff and admin" on public.customer_preferences;
create policy "Customer preferences are readable by staff and admin"
on public.customer_preferences
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

drop policy if exists "Admins can manage customer preferences" on public.customer_preferences;
create policy "Admins can manage customer preferences"
on public.customer_preferences
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

grant select, insert, update, delete on public.customer_preferences to authenticated;

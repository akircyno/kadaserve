drop table if exists public.analytics_daily cascade;

create table public.analytics_daily (
  id uuid primary key default gen_random_uuid(),
  order_date date not null,
  day_of_week text not null,
  order_count integer not null default 0 check (order_count >= 0),
  total_revenue numeric not null default 0,
  avg_order_value numeric not null default 0,
  avg_rating numeric not null default 0
);

create unique index analytics_daily_order_date_key
on public.analytics_daily (order_date);

alter table public.analytics_daily enable row level security;

create policy "Analytics are readable by staff and admin"
on public.analytics_daily
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

create policy "Admins can manage analytics daily"
on public.analytics_daily
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

grant select, insert, update, delete on public.analytics_daily to authenticated;

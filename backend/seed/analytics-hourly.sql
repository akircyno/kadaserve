drop table if exists public.analytics_hourly cascade;

create table public.analytics_hourly (
  id uuid primary key default gen_random_uuid(),
  order_date date not null,
  day_of_week text not null,
  hour_of_day integer not null check (hour_of_day >= 0 and hour_of_day <= 23),
  hour_label text not null,
  order_count integer not null default 0 check (order_count >= 0),
  total_revenue numeric not null default 0,
  avg_order_value numeric not null default 0,
  avg_rating numeric not null default 0,
  updated_at timestamptz not null default now()
);

create unique index analytics_hourly_order_date_hour_of_day_key
on public.analytics_hourly (order_date, hour_of_day);

alter table public.analytics_hourly enable row level security;

create policy "Analytics hourly is readable by staff and admin"
on public.analytics_hourly
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

create policy "Admins can manage analytics hourly"
on public.analytics_hourly
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

grant select, insert, update, delete on public.analytics_hourly to authenticated;

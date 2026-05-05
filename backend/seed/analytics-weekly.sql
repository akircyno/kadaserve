drop table if exists public.analytics_weekly cascade;

create table public.analytics_weekly (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  week_end_date date not null,
  order_count integer not null default 0 check (order_count >= 0),
  total_revenue numeric not null default 0,
  avg_order_value numeric not null default 0,
  updated_at timestamptz not null default now()
);

create unique index analytics_weekly_week_start_date_key
on public.analytics_weekly (week_start_date);

alter table public.analytics_weekly enable row level security;

create policy "Analytics weekly is readable by staff and admin"
on public.analytics_weekly
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

create policy "Admins can manage analytics weekly"
on public.analytics_weekly
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

grant select, insert, update, delete on public.analytics_weekly to authenticated;

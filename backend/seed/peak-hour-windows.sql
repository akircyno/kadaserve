alter table if exists public.peak_hour_windows
add column if not exists day_of_week integer,
add column if not exists hour_start integer,
add column if not exists hour_end integer,
add column if not exists avg_order_count numeric not null default 0,
add column if not exists intensity text not null default 'low',
add column if not exists detected_at timestamptz not null default now();

create unique index if not exists peak_hour_windows_day_of_week_hour_start_key
on public.peak_hour_windows (day_of_week, hour_start);

alter table if exists public.peak_hour_windows enable row level security;

drop policy if exists "Peak hour windows are readable by staff and admin" on public.peak_hour_windows;
create policy "Peak hour windows are readable by staff and admin"
on public.peak_hour_windows
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

drop policy if exists "Admins can manage peak hour windows" on public.peak_hour_windows;
create policy "Admins can manage peak hour windows"
on public.peak_hour_windows
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

grant select, insert, update, delete on public.peak_hour_windows to authenticated;

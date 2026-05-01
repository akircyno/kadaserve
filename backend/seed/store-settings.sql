create table if not exists public.store_settings (
  key text primary key,
  value text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint store_settings_key_check check (length(trim(key)) > 0),
  constraint store_status_override_value_check check (
    key <> 'store_status_override' or value in ('auto', 'open', 'busy', 'closed')
  )
);

alter table public.store_settings enable row level security;

drop policy if exists "Store settings are readable" on public.store_settings;
create policy "Store settings are readable"
on public.store_settings
for select
using (true);

drop policy if exists "Staff can manage store settings" on public.store_settings;
create policy "Staff can manage store settings"
on public.store_settings
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('staff', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('staff', 'admin')
  )
);

insert into public.store_settings (key, value)
values ('store_status_override', 'auto')
on conflict (key) do nothing;

alter table public.profiles
add column if not exists default_delivery_lat double precision,
add column if not exists default_delivery_lng double precision;

alter table public.orders
add column if not exists delivery_lat double precision,
add column if not exists delivery_lng double precision;

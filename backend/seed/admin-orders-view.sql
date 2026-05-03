alter table public.orders
  add column if not exists encoded_by uuid references public.profiles(id);

create or replace view public.admin_orders_view
with (security_invoker = true)
as
select
  orders.id,
  orders.customer_id,
  orders.order_type,
  orders.status,
  orders.payment_method,
  orders.payment_status,
  orders.total_amount,
  orders.ordered_at,
  orders.walkin_name,
  orders.delivery_address,
  orders.delivery_lat,
  orders.delivery_lng,
  orders.delivery_email,
  orders.delivery_phone,
  orders.encoded_by,
  profiles.full_name as customer_full_name,
  profiles.email as customer_email,
  profiles.phone as customer_phone,
  encoder_profiles.full_name as encoded_by_full_name,
  encoder_profiles.email as encoded_by_email
from public.orders
left join public.profiles
  on profiles.id = orders.customer_id
left join public.profiles as encoder_profiles
  on encoder_profiles.id = orders.encoded_by;

grant select on public.admin_orders_view to authenticated;

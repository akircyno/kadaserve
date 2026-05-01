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
  profiles.full_name as customer_full_name,
  profiles.email as customer_email,
  profiles.phone as customer_phone
from public.orders
left join public.profiles
  on profiles.id = orders.customer_id;

grant select on public.admin_orders_view to authenticated;

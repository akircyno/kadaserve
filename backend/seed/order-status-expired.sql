alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'pending_payment',
      'pending',
      'preparing',
      'ready',
      'out_for_delivery',
      'completed',
      'delivered',
      'cancelled',
      'expired'
    )
  );

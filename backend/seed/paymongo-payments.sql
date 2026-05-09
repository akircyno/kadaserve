alter table public.orders
  add column if not exists paymongo_checkout_session_id text,
  add column if not exists paymongo_payment_id text,
  add column if not exists paymongo_payment_intent_id text,
  add column if not exists paymongo_payment_method_used text,
  add column if not exists paid_at timestamptz;

create index if not exists orders_paymongo_checkout_session_id_idx
  on public.orders (paymongo_checkout_session_id);


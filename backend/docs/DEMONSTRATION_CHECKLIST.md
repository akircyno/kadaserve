# Demonstration Checklist

Last updated: 2026-05-11

Use this before every demo or defense rehearsal.

## Pre-Demo Setup

- Confirm `.env.local` exists.
- Confirm Supabase keys are working.
- Confirm cafe coordinates are set:

```env
NEXT_PUBLIC_STORE_LAT=your_cafe_latitude
NEXT_PUBLIC_STORE_LNG=your_cafe_longitude
```

- Keep PayMongo disabled until account is ready:

```env
NEXT_PUBLIC_ENABLE_PAYMONGO_CHECKOUT=false
```

- Run build:

```bash
cd frontend
npm run build
```

## Customer Flow

- Open customer page.
- Search menu item.
- Filter menu by category.
- Add item to cart.
- Customize drink options.
- Confirm cart item appears.
- Confirm item total price appears beside the quantity controls.
- Confirm order tracker shows automatic update status without manually refreshing the page.

## Pickup Checkout

- Open cart.
- Select the `Pickup` checkout card.
- Confirm payment label is `Pay at Cafe`.
- Place order.
- Confirm customer is redirected to order tracking.

## Delivery Checkout

- Open cart.
- Select the `Delivery` checkout card.
- Confirm address field appears.
- Confirm map appears without overlap.
- Pin location on map.
- Confirm the payment panel label is `Delivery Fee`.
- Confirm delivery fee appears with distance in km.
- Confirm there is no extra note under the delivery fee row.
- Confirm payment method appears as a full payment card, not a small unclear pill.
- Confirm optional phone field is visible.
- Confirm payment label is `Cash on Delivery`.
- Place order.

## Staff Flow

- Open staff dashboard.
- Confirm staff header is a clean white command bar and controls are readable.
- Confirm sidebar navigation has clean labels, a professional collapse/expand icon, and a simple `Sign out` action without redundant session text.
- Open Encode Order and confirm menu summary metrics, category filters, compact product cards, active order rail, fulfillment cards, and payment controls look polished.
- Encode a staff delivery order and confirm delivery fee is included in the grand total and submits successfully.
- Confirm new order appears.
- Keep the customer tracker open and confirm it updates automatically when staff changes order status.
- Confirm order queue columns are easy to scan with counts, timing, item count, focus label, and next action.
- Click an order and confirm the detail modal shows queue heat, wait time, item count, payment labels, customer/delivery details, item breakdown, and clear next action.
- Confirm queue heatmap appears on long-waiting orders:
  - normal for new orders
  - warming up around 16 minutes
  - needs attention around 31 minutes
  - critical wait around 45 minutes for active non-pending stages
  - pending orders expire at 45 minutes
- Confirm payment method labels are clear:
  - `Pay at Cafe` for pickup cash orders.
  - `Cash on Delivery` for delivery cash orders.
  - `Online` for online payment orders.
  - `Awaiting Payment` for PayMongo pending payment orders.
- For delivery orders, confirm staff can see items total, delivery fee, and total amount.
- Advance order:
  - pending
  - preparing
  - ready
  - out for delivery
  - delivered
- Confirm paid requirement before delivery completion.
- Confirm delivery fee input appears only when a delivery order has no calculated delivery fee.
- Confirm pending orders use a 45-minute expiry limit.
- Confirm expired orders move to session summary/order history as `expired`, not `cancelled`.

## Feedback Flow

- Customer receives feedback modal only after order becomes `delivered` or `completed`.
- Refresh page does not reopen feedback modal by itself.
- Submit feedback permanently hides prompt for that order.
- Close/dismiss hides prompt for that order.
- Maybe Later delays the prompt.

## PayMongo Foundation

- Online Payment button is disabled while PayMongo is not ready.
- PayMongo webhook route exists:

```text
/api/paymongo/webhook
```

- Do not demo live online payment until beneficiary account, API keys, and webhook secret are available.

## Final Check

- No rewards/voucher UI appears.
- Login does not require Terms checkbox.
- Signup requires Terms checkbox.
- Login/signup pages do not show a hydration overlay from browser-injected input attributes.
- Signup does not ask for date of birth.
- Checkout phone is optional.

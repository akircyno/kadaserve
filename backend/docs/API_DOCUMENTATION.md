# KadaServe API Documentation

Last updated: 2026-05-11

## Authentication

### `POST /api/signup`

Creates a customer account using email/password.

Required body:

```json
{
  "fullName": "Customer Name",
  "email": "customer@example.com",
  "password": "kada1234"
}
```

Rules:

- Full name is required.
- Email must be valid.
- Password must have at least 8 characters, 1 letter, and 1 number.
- Email verification is required for email/password signup.

### `POST /api/login`

Signs in a user using email/password.

Required body:

```json
{
  "email": "customer@example.com",
  "password": "kada1234"
}
```

### `GET /api/auth/google`

Starts Google OAuth login/signup.

### `GET /auth/callback`

Handles Supabase auth callback and redirects users based on role.

## Customer

### `POST /api/checkout`

Creates a customer order.

Body:

```json
{
  "items": [],
  "orderType": "pickup",
  "paymentMethod": "cash",
  "deliveryAddress": "",
  "deliveryPhone": "",
  "deliveryLat": null,
  "deliveryLng": null
}
```

Order types:

- `pickup`
- `delivery`

Payment methods:

- `cash`
- `online`

Current production-safe behavior:

- `cash` creates an order with `status: pending` and `payment_status: unpaid`.
- `online` creates an order with `status: pending_payment`, then redirects to PayMongo checkout if enabled.
- Online orders are not marked paid during redirect.
- PayMongo webhook is the only authority that marks an online order paid.

Delivery fee:

- For delivery orders, backend requires valid map coordinates.
- Backend calculates delivery fee from distance.
- Checkout fails if the delivery pin is outside the configured service range.
- Customer cart displays this as `Delivery Fee`, not estimated delivery fee.

### `GET /api/customer/addresses`

Returns saved customer addresses.

### `POST /api/customer/addresses`

Creates a saved customer address.

### `PATCH /api/customer/addresses`

Updates a saved address or default address.

### `POST /api/customer/orders/cancel`

Cancels a pending customer order.

### `GET /api/customer/orders`

Returns the signed-in customer's orders for automatic order tracker sync.

Behavior:

- Requires an authenticated customer session.
- Returns order status, payment status, delivery details, and order items.
- Used by the customer dashboard every 10 seconds so the tracker updates without a manual page refresh.

### `POST /api/feedback`

Submits feedback for a completed or delivered order item.

Feedback is used as a customer preference signal for recommendation logic.

## PayMongo

### `POST /api/paymongo/webhook`

Receives PayMongo webhook events.

Required event:

```text
checkout_session.payment.paid
```

Security:

- Validates `paymongo-signature`.
- Uses `PAYMONGO_WEBHOOK_SECRET`.
- Ignores unsupported events.

Webhook behavior:

- Finds order by PayMongo metadata `order_id`.
- Updates online order from `pending_payment` to `pending`.
- Sets `payment_status` to `paid`.
- Saves PayMongo IDs for traceability.

## Staff

### `GET /api/staff/orders/list`

Loads active and recent orders for staff dashboard.

Before returning data, the endpoint marks pending orders older than 45 minutes as `expired`. Those orders are no longer part of the active queue and are returned as final orders for the staff session summary.

### `POST /api/staff/orders/update-status`

Advances order status.

Status flow:

- Pickup: `pending` -> `preparing` -> `ready` -> `completed`
- Delivery: `pending` -> `preparing` -> `ready` -> `out_for_delivery` -> `delivered`

Payment rule:

- Delivery cannot be closed as delivered unless payment is marked paid.
- Online payment orders become paid only through PayMongo webhook.

Expiry rule:

- Pending orders expire after 45 minutes.
- Expired orders use status `expired`, not `cancelled`.
- Expired orders are treated as final orders and appear in session summary/order history.
- The update-status API rejects early expiry attempts before the 45-minute limit.
- Supabase must allow `expired` in `orders_status_check`; apply `backend/seed/order-status-expired.sql` if the database rejects expired status updates.

### `POST /api/staff/orders/create`

Creates walk-in/staff encoded orders.

Body:

```json
{
  "orderType": "pickup",
  "items": [],
  "totalAmount": 129,
  "deliveryFee": 0,
  "walkinName": "Walk-in Customer",
  "deliveryAddress": "",
  "deliveryEmail": "",
  "deliveryPhone": "",
  "paymentMethod": "cash",
  "paymentStatus": "paid"
}
```

Rules:

- Pickup requires `walkinName`.
- Delivery requires `deliveryAddress` and `deliveryPhone`.
- Staff delivery order totals include `deliveryFee`.
- API validates item subtotal plus delivery fee against `totalAmount`.

### `GET /api/staff/orders/history`

Loads historical staff orders.

Before querying history, the endpoint also applies the same 45-minute pending expiry rule so overdue pending orders appear in history as `expired`.

## Admin

Admin routes support:

- menu management
- analytics
- customer preference analytics
- item ranking
- peak hour analysis

### `POST /api/admin/analytics/customer-preferences`

Regenerates customer preference rows from completed/delivered orders and feedback.

Preference logic:

- Counts ordered quantity per customer and menu item.
- Normalizes frequency within each customer's own order history.
- Computes recency with a 30-day decay curve.
- Averages only submitted rating fields, so missing taste/strength/overall values are not treated as zero.
- Matches feedback to a specific order item when `order_item_id` is available.
- Stores a 0-1 preference score using 50% frequency, 30% recency, and 20% feedback.

### `GET /api/customer/recommendations`

Returns the signed-in customer's top recommendation cards.

Behavior:

- Uses the shared recommendation engine instead of trusting only persisted preference rows.
- Preference recommendations are based on the customer's completed/delivered order frequency, recent orders, and feedback ratings.
- Top-seller and popularity fallbacks are based on Admin Item Ranking/global demand.
- The customer UI and admin Customer Intelligence view use matching recommendation labels and reasons.

## Database Scripts

Important SQL files:

- `backend/seed/customer-addresses.sql`
- `backend/seed/delivery-location.sql`
- `backend/seed/paymongo-payments.sql`
- `backend/seed/admin-orders-view.sql`
- `backend/seed/store-settings.sql`
- `backend/seed/order-status-expired.sql`

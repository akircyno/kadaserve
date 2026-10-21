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
- `online` (Online Payment via GCash QR)

Current behavior:

- `cash` sends the JSON body above and creates an order with `status: pending` and `payment_status: unpaid`.
- `online` sends `multipart/form-data` with `payload` (the JSON body above) and `paymentProof` (a JPG or PNG screenshot, 4 MB max).
- The screenshot is checked by type, size and file content, then stored in the private `payment-proofs` Supabase Storage bucket.
- The order is created with `status: pending_payment` and `payment_status: pending_verification`. If the screenshot cannot be stored, the order is removed.
- Uploading a screenshot never marks an order paid. Staff/admin must verify the payment (see `POST /api/staff/orders/verify-payment`).
- The customer sees a static GCash QR (`frontend/public/payments/gcash-qr.webp`), the recipient name and the exact total before paying.

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

- GCash QR orders can be cancelled before payment proof is sent or after it is rejected.
- Orders with `payment_status: pending_verification` or `paid` cannot be cancelled by the customer.

### `POST /api/customer/orders/payment-proof`

Uploads a replacement GCash payment screenshot after staff rejected the previous one.

Body: `multipart/form-data` with `orderId` and `paymentProof` (JPG or PNG, 4 MB max).

- Only the customer who placed the order can upload.
- Only allowed while `status: pending_payment` and `payment_status: rejected`.
- Moves the same order back to `payment_status: pending_verification`; no new order is created.

### `GET /api/orders/payment-proof?orderId=...`

Returns a signed link (valid for 5 minutes) to an order's payment screenshot.

- Allowed for the customer who placed the order, staff and admin. Anyone else gets `404`.

### `GET /api/customer/orders`

Returns the signed-in customer's orders for automatic order tracker sync.

Behavior:

- Requires an authenticated customer session.
- Returns order status, payment status, delivery details, and order items.
- Used by the customer dashboard every 10 seconds so the tracker updates without a manual page refresh.

### `POST /api/feedback`

Submits feedback for a completed or delivered order item.

Feedback is used as a customer preference signal for recommendation logic.

## Payments

PayMongo checkout and its webhook (`POST /api/paymongo/webhook`) were removed. Older orders keep their `paymongo_*` columns for history.

Payment status (separate from order status):

- `unpaid` - cash orders before payment.
- `pending_verification` - customer sent a GCash screenshot; staff/admin have not checked it yet.
- `paid` - staff/admin verified the payment (or a cash payment was marked paid).
- `rejected` - staff/admin rejected the screenshot; the customer can upload a new one on the same order.

GCash QR orders stay in `status: pending_payment` until approved, so they never reach preparation unverified. Approval moves them to `pending`, and the normal order flow continues.

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
- GCash QR orders become paid only through `POST /api/staff/orders/verify-payment`.

Expiry rule:

- Pending orders expire after 45 minutes. For verified GCash QR orders the 45 minutes count from verification, not from ordering.
- Expired orders use status `expired`, not `cancelled`.
- Expired orders are treated as final orders and appear in session summary/order history.
- The update-status API rejects early expiry attempts before the 45-minute limit.
- Supabase must allow `expired` in `orders_status_check`; apply `backend/seed/order-status-expired.sql` if the database rejects expired status updates.

### `POST /api/staff/orders/verify-payment`

Approves or rejects a customer's GCash payment screenshot. Staff and admin only (checked on the server).

Body:

```json
{
  "orderId": "uuid",
  "decision": "approve",
  "reason": "Optional message shown to the customer when rejecting"
}
```

- Only works while the order is `pending_payment` with `payment_status: pending_verification` and a screenshot attached.
- `approve`: sets `payment_status: paid`, moves the order to `pending`, and records `payment_verified_at` and `payment_verified_by`.
- `reject`: sets `payment_status: rejected`, records the reviewer and reason; the order stays `pending_payment`.
- If another reviewer already decided, returns `409`.
- Staff should approve only after confirming the money arrived in the GCash account; the screenshot alone is not proof.

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
- `backend/seed/paymongo-payments.sql` (historical PayMongo columns, kept for older orders)
- `backend/seed/admin-orders-view.sql`
- `backend/seed/store-settings.sql`
- `backend/seed/order-status-expired.sql`
- `backend/seed/gcash-payment-proof.sql` (GCash QR payment proof columns, statuses, private storage bucket, payment guard trigger, updated `admin_orders_view`; apply before deploying the GCash QR code)

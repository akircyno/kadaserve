# KadaServe Documentation

Last updated: 2026-05-10

## Project Focus

KadaServe is a Computer Science focused cafe ordering and analytics system. The project is not only an IT operations tool. Its core value is the intelligent ordering workflow, customer preference learning, recommendation support, delivery distance computation, and feedback-driven personalization.

## Current Progress

- Customer menu supports search, category filtering, item customization, and add to cart.
- Cart supports pickup and delivery order methods.
- Delivery orders support map pinning, saved addresses, optional phone number, and distance-based delivery fee.
- Delivery fee is computed using geographic coordinates and Haversine distance.
- Cart payment details now show `Delivery Fee` directly, without the previous estimated wording or extra explanatory note.
- Checkout UI was polished with clearer pickup/delivery cards, a cleaner payment summary, and professional payment method cards.
- Cart item rows now show each item total beside the quantity controls for faster review while adjusting quantities.
- Signup/login flow was polished.
- Signup uses simplified password rules: minimum 8 characters, at least 1 letter, at least 1 number.
- Terms agreement is required only during account creation.
- Email/password signup uses verification flow.
- Google authentication is supported.
- Rewards/voucher feature was removed from active code.
- Feedback modal appears only when an order becomes delivered or completed and the customer has not submitted feedback.
- Feedback modal does not reopen on page refresh alone.
- PayMongo online payment foundation is implemented but disabled until the beneficiary PayMongo account is ready.
- Staff dashboard now uses clear payment labels: `Pay at Cafe`, `Cash on Delivery`, `Online`, and `Awaiting Payment`.
- Staff delivery orders now show items total, delivery fee, and grand total in the active dashboard and order details.
- Manual delivery fee input is only a fallback for delivery orders that have no calculated fee.

## Current Payment Behavior

- Pickup: Pay at Cafe.
- Delivery: Cash on Delivery.
- Online Payment: PayMongo-ready but feature-flagged off.
- Staff sees paid/unpaid status separately from the payment method.

To enable PayMongo later:

```env
NEXT_PUBLIC_ENABLE_PAYMONGO_CHECKOUT=true
PAYMONGO_SECRET_KEY=sk_test_or_live_xxx
PAYMONGO_WEBHOOK_SECRET=whsec_xxx
```

## Delivery Fee Model

Delivery fee is based on distance from the cafe location to the customer map pin.

- Base fee: PHP 40 for the first 2 km.
- Extra fee: PHP 10 per additional km or partial km.
- Maximum delivery distance: 12 km.
- Frontend shows the calculated fee.
- Backend recalculates the fee during checkout as the source of truth.

Cafe coordinates must be configured:

```env
NEXT_PUBLIC_STORE_LAT=your_cafe_latitude
NEXT_PUBLIC_STORE_LNG=your_cafe_longitude
```

## Important Update Rule

Every code or UI change must include a documentation check. If the behavior, demo flow, API, payment logic, delivery fee, auth flow, feedback flow, or defense explanation changes, update the related docs in the same batch.

- `DOCUMENTATION.md`
- `API_DOCUMENTATION.md`
- `DEMONSTRATION_CHECKLIST.md`
- `DEMONSTRATION_GUIDE.md`
- `FINAL_DEFENSE_REVIEW.md`
- `GROUP_DEFENSE_GUIDE.md`

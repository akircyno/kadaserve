# KadaServe Documentation

Last updated: 2026-05-11

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
- Customer order tracker now auto-syncs order status from `/api/customer/orders` every 10 seconds, so customers do not need to refresh the page.
- Staff dashboard now uses clear payment labels: `Pay at Cafe`, `Cash on Delivery`, `Online`, and `Awaiting Payment`.
- Staff delivery orders now show items total, delivery fee, and grand total in the active dashboard and order details.
- Manual delivery fee input is only a fallback for delivery orders that have no calculated fee.
- Staff order queue UI was upgraded with stronger queue columns, timing chips, item counts, focus labels, status rails, and clearer action buttons for faster staff scanning.
- Staff order cards now use a queue heatmap based on waiting time: normal, warming up, needs attention, and critical wait. Long-waiting orders get a subtle warm/red tint so staff can prioritize them faster.
- Staff order detail modal was polished into a full-height side inspector with queue heat, wait time, item count, fulfillment/payment summary, current focus, cleaner customer/delivery details, and stronger action footer.
- Staff page header was changed to a clean white command bar with subtle border, shadow, and matching white control inputs.
- Staff sidebar expand/collapse control now uses professional panel icons, cleaner navigation labeling, and a simpler dedicated sign-out action without the redundant staff session card.
- Staff Encode Order UI was upgraded with menu summary metrics, stronger category filters, compact product cards, clearer active-order rail, professional fulfillment/payment sections, and cleaner customization pricing.
- Staff encoded delivery orders now include delivery fee in the create-order API total validation and saved order payload.
- Login and signup inputs now suppress browser-injected hydration attribute mismatches, preventing the development overlay caused by autofill/extension-added input attributes.
- Pending orders now automatically expire after 45 minutes and move to session summary/order history as `expired`, not `cancelled`.

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

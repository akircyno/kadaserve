# KadaServe Documentation

Last updated: 2026-05-12

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
- Staff page header was changed to a warm parchment command bar with subtle border, shadow, and a softer controls surface that matches the cafe workspace palette.
- Staff sidebar expand/collapse control now uses professional panel icons, cleaner navigation labeling, and a simpler dedicated sign-out action without the redundant staff session card.
- Staff Encode Order UI was upgraded with menu summary metrics, stronger category filters, compact product cards, clearer active-order rail, professional fulfillment/payment sections, and cleaner customization pricing.
- Staff Encode Order menu cards were refined to prevent overlap: category labels now sit in the content area instead of over product photos, selected quantities no longer shift category labels downward, menu card controls use stable columns, the active-order rail uses a narrower responsive width, and action controls now use softer pill-style edges instead of boxy buttons.
- Staff Encode Order UI was reviewed with the Huashu Design workflow and polished for operational use: selected menu items now have a clear active state, menu controls stack safely on tight widths, header search controls wrap more gracefully, and the active-order rail no longer forces an oversized block on smaller screens.
- Staff Encode Order received a stronger POS-style revision after visual review: summary metrics were changed from large cards into compact chips, disabled product actions were reduced from wide beige bars to quiet `Select qty` text, products already in the cart now show an item-count chip, and the active-order rail scrolls its content naturally so payment controls are not clipped.
- Staff Encode Order header overlap was fixed by letting the staff layout own the desktop viewport height and making the Encode Order workspace fill the remaining space instead of using a fixed guessed header offset.
- Huashu Design is kept as a project skill under `.agents/skills/huashu-design` for future UI prototype/design review support. The duplicate local Codex copy was removed so the project copy remains the source of truth.
- Awesome Claude Skills is kept as a KadaServe project skill wrapper under `.agents/skills/awesome-claude-skills` to guide future complex logic, analytics, testing, debugging, and thesis-oriented intelligent-system planning. The upstream repo is a catalogue, so the project wrapper records the fetched source and explains how to select specific installable skills later.
- Staff encoded delivery orders now include delivery fee in the create-order API total validation and saved order payload.
- Login and signup inputs now suppress browser-injected hydration attribute mismatches, preventing the development overlay caused by autofill/extension-added input attributes.
- Pending orders now automatically expire after 45 minutes and move to session summary/order history as `expired`, not `cancelled`.
- Staff order list/history APIs now enforce the 45-minute pending expiry before returning data, so expired pending orders are removed from the active queue and appear in session summary/order history even if the browser-side expiry timer has not run yet.
- Added `backend/seed/order-status-expired.sql` to update the database `orders_status_check` constraint so `orders.status` accepts `expired`. This SQL must be applied in Supabase before automatic expiry can persist.
- Staff session summary and order history now show an `Auto-expired after 45m` label for expired orders, making the automated rule clearer during demos and defense.
- Staff Order History UI was reviewed and improved with a searchable sticky toolbar, compact history summary chips, clearer date/export controls, selected-row highlighting, and a stronger side detail inspector with status, fulfillment, and total chips.
- Staff Order History summary chip labels were clarified from `Matching`/`Loaded` to `Total Found`/`Shown` so staff can understand the difference between all filtered results and currently displayed rows.
- Staff Order Queue UI was refined without changing the board concept: large summary cards were changed into compact operations chips, pickup/delivery filters were surfaced on the board, header controls were made more responsive, order cards were tightened, selected cards are highlighted, and the 5-column board now waits for wider screens before compressing into five columns.
- Staff shared header was polished again with a warmer cafe-gradient surface, a small title accent marker, a softer mobile menu button, and a responsive controls tray that can move to its own row on smaller screens.
- Staff shared header was tuned for laptop widths by keeping the title and command controls in a clean two-row layout until very wide screens, preventing search/status controls from crowding or overlapping the page title.
- Frontend hook warnings were cleaned up by stabilizing the staff order loader and customer feedback prompt helpers, keeping lint clean while preserving auto-sync and feedback behavior.

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

# KadaServe Documentation

Last updated: 2026-05-16

## Project Focus

KadaServe is a Computer Science focused cafe ordering and analytics system. The project is not only an IT operations tool. Its core value is the intelligent ordering workflow, customer preference learning, recommendation support, delivery distance computation, and feedback-driven personalization.

## Current Progress

- Customer menu supports search, category filtering, item customization, and add to cart.
- Customer menu, customization, and cart now show estimated nutrition for staff-recipe drinks, covering calories, protein, carbs, fat, sugar, sodium, and serving volume using KadaServe staff recipes plus generic ingredient estimates pending supplier-label confirmation.
- Customer notifications now live behind a top bell button instead of a bottom tab; the bottom mobile navigation stays focused on Home, Menu, Orders, and Profile while the bell drawer shows timestamped active order updates, delivered-order receipt details, and feedback reminders.
- A shared toast notification layer now gives standard success, error, and info feedback across auth entry pages, customer checkout/profile/menu actions, staff order workflows, and admin analytics/menu/store controls.
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
- PayMongo online payment now uses QR Ph for accounts without GCash/Maya/card eligibility. Online orders remain `pending_payment` until the verified PayMongo webhook marks them paid.
- Customer order tracker now auto-syncs order status from `/api/customer/orders` every 10 seconds, so customers do not need to refresh the page.
- Staff-triggered delivery and receipt emails were removed from the order status flow; order updates and receipt details are now surfaced through KadaServe in-app notifications while account/security emails remain separate.
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
- Added `frontend/codex.md` as the frontend working guide for future Codex sessions, including the KadaServe stack, cafe color palette, UI/engineering rules, and the `Build -> Test -> Approve -> Next Feature` one-feature-at-a-time workflow.
- Admin Feature 1 removed the stock-management module from the active code and admin panel flow so future work can focus on analytics, preference learning, menu intelligence, and demand intelligence.
- Admin Feature 2 merged `All Orders`, `Time Series`, and `Peak Hours` into one `Demand` admin module with internal views, reducing sidebar clutter while keeping demand records, hourly volume, and peak-window detection together.
- Admin Feature 3 merged `Item Ranking`, `Satisfaction`, `Customer Pref`, and `Feedback` into one `Customer Intelligence` admin module with internal views for preference signals, item ranking, satisfaction quality, and raw feedback review.
- Admin Feature 4 upgraded the admin dashboard with a `Decision Support Snapshot` that computes demand, growth, preference, and satisfaction signals from existing order, analytics, ranking, and feedback data.
- Admin Feature 5 upgraded the `Menu` module into `Menu Intelligence` by computing recommendation candidates, strongest category, review candidates, active coverage, and per-item performance signals from order ranking, rating, revenue, availability, and category demand.
- Admin UI copy was trimmed to remove developer-style explanatory text from the Dashboard, Demand, Customer Intelligence, and Menu Intelligence headers so the admin panel reads like a ready-to-demonstrate system.
- Admin visual design pass 1 restyled the admin shell and dashboard using the provided dark dashboard reference as inspiration: stronger deep-green sidebar, dark top command bar, warm content canvas, raised KPI cards, dark snapshot band, and cleaner dashboard chart panels.
- Admin visual design pass 2 corrected the admin header/dashboard back to a warm light theme and replaced the old weekly trend bars with a `Demand Growth` line/area chart inspired by the provided graph reference, using existing weekly analytics data.
- Admin `Demand Growth` chart was improved with a smoother line, selected-range summary, hover/focus point details, active guide line, stronger point state, and safer axis labels that do not clip on wide labels.
- Admin dashboard lower cards were balanced: `Orders - Week`, `Hourly Order Volume`, `Top Items`, and `Satisfaction` now use equal card rows, tighter inner spacing, compact chart/list surfaces, and wrapped hourly mini-bars to avoid oversized widths.
- Admin `Demand Growth` now supports quick selected ranges (`Last 4`, `Last 8`, `All`), and the `Peak Hours` card was tightened with a strongest-slot summary and compact heatmap cells to better match the balanced dashboard card system.
- Admin dashboard `Demand Growth` and `Peak Hours` cards now use equal-width, equal-height grid columns with a slightly more compact growth chart so the top analytics row aligns cleanly.
- Admin dashboard top analytics row was tightened again after visual review: the `Demand Growth` chart now uses a shorter SVG, smaller range controls, tighter tooltip spacing, and the `Peak Hours Heatmap` uses smaller cells plus a compact inline intensity legend. The top row no longer forces both cards to stretch to the tallest card, preventing empty space under `Demand Growth`.
- Admin dashboard lower analytics rows were compacted after visual review: `Orders by Day` now uses a shorter chart surface, `Hourly Volume` uses denser mini-bars, and `Top Sellers`/`Customer Ratings` use tighter row spacing so the cards feel balanced on laptop-sized screens.
- Admin dashboard analytics cards were normalized into paired heights for `Demand Growth`/`Peak Hours`, `Orders by Day`/`Hourly Volume`, and `Top Sellers`/`Customer Ratings`, with chart colors corrected back to the KadaServe deep green, coffee brown, cream, and tan palette.
- Admin `Demand` module was polished with Huashu Design direction: the module header now uses compact segmented views, the order ledger has real demand summary cards, filters are cleaner, `expired` is available as a status filter, the order table is denser and more scannable, and the time-series/peak-hour views use the KadaServe palette without tutorial-style copy.
- Admin `Time Series` inside the Demand module was upgraded into a stronger hourly demand profile with KPI cards, a hoverable full-day demand curve, service-window totals, a compact 24-hour volume scan, ranked top hours, and a denser hourly breakdown table.
- Admin `Time Series` paired analytics cards were balanced so the demand curve and 24-hour scan use equal-width columns and matched card heights on laptop-sized admin screens.
- Admin `Demand` orders view was refined with Huashu Design direction: a compact demand ledger header, local order search, action/status summary chips, cleaner range/status/type/payment controls, responsive mobile order cards, and a denser desktop order ledger with status dots for faster scanning.
- Customer preference generation logic was corrected for the intelligent-system flow: item frequency now uses ordered quantity, frequency is normalized per customer, recency uses a 30-day decay curve, feedback ignores missing rating fields instead of treating them as zero, item-level feedback is matched through `order_item_id` when available, and the final score stays on a 0-1 scale using 50% frequency, 30% recency, and 20% feedback.
- Customer recommendation cards now use the same live recommendation engine as the admin Customer Intelligence profile before falling back to saved analytics rows, preventing stale `customer_preferences` rows from showing a different `Best for You` item than the admin panel. Recommendation cards also show the basis text for preference, top-seller, and popularity picks.
- Admin Customer Intelligence was redesigned as a cohesive decision-support module: the header now summarizes customer orders, feedback samples, and ranked items; Preferences shows profile-level Top-N recommendation reasoning; Ranking highlights leader, ranked demand, and review candidates; Satisfaction uses a rating quality map; and Feedback uses a compact feedback stream with item-level averages.
- Admin UI now uses a local KadaServe custom SVG icon set instead of `lucide-react` inside admin screens, giving the sidebar, analytics cards, menu intelligence, demand views, and admin actions a more original visual identity while keeping icons monochrome and theme-colored.

## Current Payment Behavior

- Pickup: Pay at Cafe.
- Delivery: Cash on Delivery.
- Online Payment: PayMongo-ready but feature-flagged off.
- Staff sees paid/unpaid status separately from the payment method.

PayMongo test and live use the same code. The difference is only the deployed environment variables and the PayMongo dashboard mode:

```env
NEXT_PUBLIC_ENABLE_PAYMONGO_CHECKOUT=true
PAYMONGO_SECRET_KEY=sk_test_xxx   # test defense flow
PAYMONGO_WEBHOOK_SECRET=whsk_test_xxx

PAYMONGO_SECRET_KEY=sk_live_xxx   # live payment flow
PAYMONGO_WEBHOOK_SECRET=whsk_live_xxx
```

The webhook URL is `/api/paymongo/webhook`; enable `payment.paid`, `payment.failed`, `qrph.expired`, and optionally `checkout_session.payment.paid` for backward compatibility.

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

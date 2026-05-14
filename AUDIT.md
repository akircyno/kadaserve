# KadaServe – Comprehensive Application Audit Report

## Overall Health Scores
- **Overall Flow & Security:** 3/10 — The application contains critical financial vulnerabilities (client-side price authority) and poor transaction handling. Route protection is purely client-side rather than edge-based.
- **UI/UX:** 7.5/10 — Strong design system, good use of Tailwind, and consistent components. However, offline UX is severely lacking as API requests fail silently or awkwardly without a network.
- **Performance:** 2/10 — Critical architectural issues with database queries (missing pagination and date filters) and massive frontend bundles (monolithic components) that guarantee severe performance degradation.

---

## 1. Domain: Overall Flow & Security

### Finding: Critical Vulnerability — Client-Side Price Authority
- **Severity:** CRITICAL
- **Location:** `src/app/api/checkout/route.ts` and `src/app/api/staff/orders/create/route.ts`
- **Description:** The backend API accepts `base_price` and `addon_price` directly from the client payload during checkout, calculating the `subtotal` by simply doing math on the request body (`sum + (item.base_price + item.addon_price) * item.quantity`). There is **zero** server-side verification against the `menu_items` table to ensure the prices are correct.
- **Impact:** A malicious user or compromised staff account can intercept the HTTP request, set `base_price: 1` or `base_price: 0`, and checkout successfully for free. This is a fatal flaw for an e-commerce platform.
- **Recommendation:** Refactor the checkout endpoints. The client should only send `menu_item_id`, `quantity`, and `addons`. The backend must independently query the `menu_items` table using those IDs to resolve the true `base_price` and compute the total server-side before inserting into `orders`.

### Finding: Lack of Transactional Integrity on Order Creation
- **Severity:** Major
- **Location:** `src/app/api/checkout/route.ts` (Order Insertion Logic)
- **Description:** Order creation relies on sequential REST API calls from Node.js to Supabase (`insert into orders`, then `insert into order_items`). If the `order_items` insertion fails, the backend attempts to manually rollback by sending a `delete` request to `orders`.
- **Impact:** If the Node.js process crashes, times out, or loses network connection between the insertion and the manual deletion, the database is left with an "orphaned order" (an order with no items).
- **Recommendation:** Implement a PostgreSQL RPC (Stored Procedure) in Supabase to handle checkout. Pass the JSON payload to the RPC, allowing Postgres to execute the inserts within a single ACID-compliant database transaction.

### Finding: Missing Next.js Edge Middleware for Route Protection
- **Severity:** Major
- **Location:** `src/app/admin/page.tsx` & Root Setup
- **Description:** Route protection is not enforced at the Next.js routing edge (no `middleware.ts`). Client components load, make protected API fetches, receive a `401 Unauthorized`, and only then update the UI.
- **Impact:** Unauthenticated users download unnecessary JS bundles and see flashes of the application UI or generic error states instead of being seamlessly redirected to `/login`.
- **Recommendation:** Implement a Next.js `middleware.ts` using `@supabase/ssr` to intercept requests to `/admin`, `/staff`, and `/customer` routes natively.

### Finding: Side-Effects on GET Requests
- **Severity:** Minor
- **Location:** `src/app/api/staff/orders/list/route.ts`
- **Description:** The `GET` request for fetching the orders list invokes `expireOverduePendingOrders(supabase)`.
- **Impact:** GET requests must be idempotent. Mutating state during a read operation causes race conditions and unnecessary database writes on simple page refreshes.
- **Recommendation:** Move order expiration to a dedicated cron job (e.g., Supabase pg_cron) or trigger it only during order creation/status update mutations.

---

## 2. Domain: UI/UX

### Finding: Unhandled Offline API Failures in PWA
- **Severity:** Major
- **Location:** `public/sw.js` and Client Dashboards
- **Description:** The custom Service Worker caches the app shell and uses network-first navigation. However, it explicitly skips API routes (`if (url.pathname.startsWith("/api/")) return;`). The frontend React components lack explicit error boundaries or fallbacks for `fetch` failures when offline.
- **Impact:** If a user opens the PWA offline, the shell loads but data fetching fails silently or hangs. Users will likely see infinite loading spinners or generic "Something went wrong" errors.
- **Recommendation:** Use `navigator.onLine` checks or intercept `fetch` errors to display a dedicated "You are offline. Please reconnect to view the menu." state.

### Finding: Form Validation is Weak and Manual
- **Severity:** Suggestion
- **Location:** All API routes (e.g., checkout, feedback)
- **Description:** Validation relies on manual `if (!deliveryAddress)` checks scattered throughout the route handlers.
- **Impact:** Difficult to maintain, prone to missing edge cases (e.g., negative quantities, extremely long strings, or malformed emails).
- **Recommendation:** Integrate a schema validation library like `Zod` to strictly parse and validate incoming API payloads.

---

## 3. Domain: Performance

### Finding: Extreme Frontend Component Bloat (Monoliths)
- **Severity:** Critical
- **Location:** `src/features/customer/components/customer-dashboard.tsx` (and Staff equivalents)
- **Description:** The `customer-dashboard.tsx` file is a staggering ~4,600 lines long (189KB). It manages dozens of distinct states (cart, tracking, modals, search inputs, active tabs) inside a single React component tree.
- **Impact:** Typing a single character into the search bar (`setQuery`) triggers a re-render of the *entire* 4,600-line application state. This guarantees severe input lag (high INP) and massive JavaScript parsing bottlenecks on low-end mobile devices.
- **Recommendation:** Drastically decompose this file. Move independent UI sections (like `MenuTab`, `OrdersTab`, `CheckoutModal`) into separate files. Wrap expensive list renders in `React.memo` and use Next.js `dynamic` imports for off-screen components.

### Finding: Unfiltered Full-Table Scans for Analytics
- **Severity:** Critical
- **Location:** `src/app/api/admin/analytics/hourly/route.ts`
- **Description:** The backend aggregator fetches all non-cancelled orders from the database into Node.js memory (`.neq("status", "cancelled")`) without a `.gte()` date filter.
- **Impact:** As the coffee shop accumulates thousands of orders, this endpoint will run out of memory (OOM), crash the Node process, and cause massive API latency.
- **Recommendation:** Filter the query by a specific date range, or better yet, perform time-series aggregations directly in PostgreSQL using views or RPCs rather than calculating them in Node.js maps.

### Finding: Missing Pagination on Lists
- **Severity:** Critical
- **Location:** `src/app/api/staff/orders/list/route.ts` & `src/app/api/customer/orders/route.ts`
- **Description:** The API selects all records from `admin_orders_view` and `orders` without `.limit()`, `.range()`, or cursor-based logic.
- **Impact:** The application fetches the entire historical order list of the café/customer on every dashboard load. This destroys network bandwidth, increases database load linearly, and crashes mobile browsers rendering massive DOM lists.
- **Recommendation:** Implement cursor-based or offset-based pagination. For the live staff dashboard, fetch only "pending/active" orders or orders from the "current day". Move history to a separate paginated route.

---

## Action Plans

### 🔥 Priority Fix List (Critical Path)
1. **Fix Checkout Price Authority:** Immediately rewrite checkout APIs to query `menu_items` for the source-of-truth `base_price` instead of trusting the client payload.
2. **Paginate Orders & Analytics:** Add `.limit(50)` to customer orders, filter staff orders by `status` or `date`, and filter analytics queries to a bounded time window.
3. **Split Monolith Dashboards:** Refactor `customer-dashboard.tsx` (4,600+ lines) into smaller, localized state components to stop global re-renders on keystrokes.
4. **Implement ACID Transactions:** Replace manual REST fallback deletions (`.delete()`) with Supabase RPCs for order insertion.
5. **Add Route Middleware:** Protect `/admin`, `/staff`, and `/customer` seamlessly via a `middleware.ts` file.

### ⚡ Quick Wins
- Move `expireOverduePendingOrders` out of the GET request and into a `pg_cron` job.
- Display an "Offline Mode" banner using `window.addEventListener('offline')` to handle PWA network failures gracefully.

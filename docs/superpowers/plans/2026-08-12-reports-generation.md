# Reports Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two pure, testable HTML-report builder functions — a Staff Session Summary
(today's finished orders, Manila time) and an Admin Analytics Summary (KPIs, trends, top
sellers, peak hours, demand forecast) — and wire a "Report" button into each dashboard that
opens the report in a new tab and calls `window.print()`, matching the existing (untested)
print-to-PDF pattern already used for order exports.

**Architecture:** Two new files in `frontend/src/lib/*.ts`. `staff-session-report.ts` imports
two existing sibling lib helpers via relative imports (`./admin-order-totals`,
`./customer-display`) so it can do its own today-scoping and name-masking.
`admin-analytics-report.ts` has zero imports — it takes plain already-computed dashboard data
and returns an HTML string. Both are pure `(data) => string` functions, testable via this
project's standalone `node` script convention. Component-side "open a tab and print" glue is
duplicated locally in each dashboard component, matching how `admin-orders-view.tsx`'s
existing `openPdfReport`/`downloadPrintableReport` pair is untested, local, non-shared glue.

**Tech Stack:** TypeScript, React (Next.js client components), no new npm dependencies.

## Global Constraints

- No new npm dependencies. No PDF library — the print-to-PDF pattern (`window.open` → write
  HTML → `window.print()`, with a `downloadPrintableReport` fallback for popup-blocked
  browsers) already works and has zero dependency cost.
- No Jest/Vitest — tests are a standalone script (`frontend/scripts/verify-reports.mjs`) run
  via `node`, following the existing `verify-analytics.mjs`/`verify-recommendations.mjs`
  convention.
- `staff-session-report.ts` must use **relative** imports for its two lib dependencies
  (`./admin-order-totals`, `./customer-display`), not the `@/lib/...` path alias. Both files
  already live in `frontend/src/lib/`, so this is a same-directory sibling import — and,
  critically, only relative imports can be resolved by this project's temp-file test-transpile
  trick (see `verify-recommendations.mjs`'s pattern for `recommendations.ts` importing
  `./item-similarity`). A `@/lib/...` aliased *value* import would not resolve under plain
  Node ESM and would break the test script. (Type-only imports like
  `import type { StaffOrder } from "@/types/orders"` are fine either way — `ts.transpileModule`
  strips them entirely, so they never need runtime resolution.)
- `admin-analytics-report.ts` must have **zero imports of any kind** (not even type-only) —
  define its own local types for the plain-data shapes it accepts, so it stays testable via
  the simplest data-URL transpile trick with no temp-file setup at all.
- Match existing visual style: colors `#0D2E18` (dark green), `#684B35` (brown), `#FFFCF7`/
  `#FFF8EF`/`#FFF0DA` (cream backgrounds), `#E7D7BC` (borders) — copy from
  `buildPdfReportHtml` in `admin-orders-view.tsx`, don't invent new colors.
- Both report builders must render **something sensible** on every input, including the empty
  states already specified (zero orders today, `demandForecast: null`,
  `peakHourWindows: []`) — never throw.

---

### Task 1: Staff Session Summary report (`staff-session-report.ts`) + verification harness

**Files:**
- Create: `frontend/src/lib/staff-session-report.ts`
- Create: `frontend/scripts/verify-reports.mjs`
- Modify: `frontend/package.json` (add `test:reports` script)

**Interfaces:**
- Consumes: `getManilaDateOnly` from `./admin-order-totals` (existing), `maskCustomerName`/
  `formatNameFromEmail` from `./customer-display` (existing), `type StaffOrder` from
  `@/types/orders` (existing, type-only).
- Produces: `buildStaffSessionSummaryHtml(params: { orders: StaffOrder[]; staffName: string;
  referenceDate?: Date }): string`. Consumed by Task 3's `staff-dashboard.tsx`.

- [ ] **Step 1: Write `staff-session-report.ts`**

```typescript
// frontend/src/lib/staff-session-report.ts
import type { StaffOrder } from "@/types/orders";
import { getManilaDateOnly } from "./admin-order-totals";
import { formatNameFromEmail, maskCustomerName } from "./customer-display";

// Mirrors staff-dashboard.tsx's own `finalStatuses` — "finished" means no
// longer in progress. Duplicated locally (not imported) because it's a
// component-internal constant there, and this module must stay independently
// testable with only the two lib imports above.
const FINISHED_STATUSES = ["completed", "delivered", "cancelled", "expired"];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function peso(value: number): string {
  return `₱${Math.round(value).toLocaleString("en-PH")}`;
}

function formatOrderCode(orderId: string): string {
  return `#${orderId.slice(0, 8).toUpperCase()}`;
}

function getOrderDisplayName(order: StaffOrder): string {
  return maskCustomerName(
    order.walkin_name?.trim() ||
      formatNameFromEmail(order.delivery_email) ||
      order.customer_profile?.full_name ||
      null,
    order.order_type === "delivery" ? "Delivery Customer" : "Walk-in Customer"
  );
}

function formatOrderItems(order: StaffOrder): string {
  return order.order_items
    .map((item) => `${item.quantity}x ${item.menu_items?.name ?? "Menu item"}`)
    .join(", ");
}

function formatTime(dateString: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(dateString));
}

function formatStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function isPaidValidOrder(order: StaffOrder): boolean {
  return (
    order.payment_status === "paid" &&
    order.status !== "cancelled" &&
    order.status !== "expired"
  );
}

export function buildStaffSessionSummaryHtml(params: {
  orders: StaffOrder[];
  staffName: string;
  referenceDate?: Date;
}): string {
  const { orders, staffName, referenceDate = new Date() } = params;
  const todayKey = getManilaDateOnly(referenceDate).getTime();

  const finishedOrders = orders
    .filter(
      (order) =>
        getManilaDateOnly(new Date(order.ordered_at)).getTime() === todayKey &&
        FINISHED_STATUSES.includes(order.status)
    )
    .sort((a, b) => new Date(a.ordered_at).getTime() - new Date(b.ordered_at).getTime());

  const totalRevenue = finishedOrders
    .filter(isPaidValidOrder)
    .reduce((sum, order) => sum + order.total_amount, 0);
  const cashRevenue = finishedOrders
    .filter((order) => isPaidValidOrder(order) && order.payment_method === "cash")
    .reduce((sum, order) => sum + order.total_amount, 0);
  const onlineRevenue = totalRevenue - cashRevenue;

  const typeCounts = { Delivery: 0, Pickup: 0, "Walk-in": 0 };
  finishedOrders.forEach((order) => {
    if (order.order_type === "delivery") {
      typeCounts.Delivery += 1;
    } else if (order.walkin_name?.trim()) {
      typeCounts["Walk-in"] += 1;
    } else {
      typeCounts.Pickup += 1;
    }
  });

  const statusCounts = { completed: 0, cancelled: 0, expired: 0 };
  finishedOrders.forEach((order) => {
    if (order.status === "completed" || order.status === "delivered") {
      statusCounts.completed += 1;
    } else if (order.status === "cancelled") {
      statusCounts.cancelled += 1;
    } else if (order.status === "expired") {
      statusCounts.expired += 1;
    }
  });

  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(referenceDate);

  return `
    <!doctype html>
    <html>
      <head>
        <title>KadaServe Session Report</title>
        <style>
          body { color: #0D2E18; font-family: Arial, Helvetica, sans-serif; margin: 32px; }
          .brand { color: #0D2E18; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin-bottom: 4px; }
          .summary { border-bottom: 2px solid #684B35; margin-bottom: 20px; padding-bottom: 14px; }
          .summary h1 { font-size: 20px; margin: 0 0 8px; }
          .summary p { color: #684B35; font-size: 13px; margin: 0; }
          .stats { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 20px; }
          .stat { background: #FFF8EF; border: 1px solid #E7D7BC; border-radius: 8px; min-width: 140px; padding: 10px 14px; }
          .stat .label { color: #684B35; font-size: 11px; text-transform: uppercase; }
          .stat .value { font-size: 18px; font-weight: 700; }
          table { border-collapse: collapse; font-size: 11px; width: 100%; }
          th { background: #FFF0DA; color: #0D2E18; text-align: left; }
          th, td { border-bottom: 1px solid #E7D7BC; padding: 9px 7px; vertical-align: top; }
          .money { font-weight: 700; text-align: right; white-space: nowrap; }
          .empty { color: #8C7A64; padding: 24px 0; text-align: center; }
          @media print { body { margin: 18px; } }
        </style>
      </head>
      <body>
        <div class="brand">KadaServe</div>
        <section class="summary">
          <h1>Session Summary &mdash; ${escapeHtml(staffName)}</h1>
          <p>${escapeHtml(dateLabel)}</p>
        </section>
        <div class="stats">
          <div class="stat"><div class="label">Orders Handled</div><div class="value">${finishedOrders.length}</div></div>
          <div class="stat"><div class="label">Revenue Collected</div><div class="value">${escapeHtml(peso(totalRevenue))}</div></div>
          <div class="stat"><div class="label">Cash</div><div class="value">${escapeHtml(peso(cashRevenue))}</div></div>
          <div class="stat"><div class="label">Online</div><div class="value">${escapeHtml(peso(onlineRevenue))}</div></div>
          <div class="stat"><div class="label">Delivery</div><div class="value">${typeCounts.Delivery}</div></div>
          <div class="stat"><div class="label">Pickup</div><div class="value">${typeCounts.Pickup}</div></div>
          <div class="stat"><div class="label">Walk-in</div><div class="value">${typeCounts["Walk-in"]}</div></div>
          <div class="stat"><div class="label">Completed</div><div class="value">${statusCounts.completed}</div></div>
          <div class="stat"><div class="label">Cancelled</div><div class="value">${statusCounts.cancelled}</div></div>
          <div class="stat"><div class="label">Expired</div><div class="value">${statusCounts.expired}</div></div>
        </div>
        ${
          finishedOrders.length === 0
            ? `<p class="empty">No orders today</p>`
            : `
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Type</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Total</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${finishedOrders
              .map(
                (order) => `
                  <tr>
                    <td>${escapeHtml(formatOrderCode(order.id))}</td>
                    <td>${escapeHtml(getOrderDisplayName(order))}</td>
                    <td>${escapeHtml(formatOrderItems(order) || "No items")}</td>
                    <td>${escapeHtml(order.order_type)}</td>
                    <td>${escapeHtml(order.payment_method ?? "-")}</td>
                    <td>${escapeHtml(formatStatusLabel(order.status))}</td>
                    <td class="money">${escapeHtml(peso(order.total_amount))}</td>
                    <td>${escapeHtml(formatTime(order.ordered_at))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
        `
        }
        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
    </html>
  `;
}
```

- [ ] **Step 2: Write the verification script**

```javascript
// frontend/scripts/verify-reports.mjs
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

async function importDataUrlModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const transpiled = transpile(source);
  const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled)}`;
  return import(moduleUrl);
}

function makeOrder(overrides) {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    customer_id: null,
    order_type: "pickup",
    status: "completed",
    payment_method: "cash",
    payment_status: "paid",
    total_amount: 150,
    delivery_fee: null,
    ordered_at: "2026-08-12T06:00:00.000Z", // 2PM Manila (UTC+8)
    updated_at: null,
    walkin_name: null,
    delivery_address: null,
    delivery_lat: null,
    delivery_lng: null,
    delivery_email: null,
    delivery_phone: null,
    encoded_by: null,
    encoded_by_profile: null,
    customer_profile: null,
    order_items: [
      {
        id: "item-1",
        quantity: 2,
        unit_price: 75,
        sugar_level: 100,
        ice_level: "normal",
        size: "medium",
        temperature: "cold",
        addons: [],
        special_instructions: null,
        menu_items: { name: "Spanish Latte" },
      },
    ],
    ...overrides,
  };
}

console.log("Testing staff-session-report.ts...");

// staff-session-report.ts imports from ./admin-order-totals and
// ./customer-display, both relative imports -- transpile all three to temp
// .mjs files on disk so Node's real module resolution can follow them,
// following the exact pattern used in verify-recommendations.mjs for
// recommendations.ts's relative imports.
const tempDir = await mkdtemp(path.join(tmpdir(), "kadaserve-verify-reports-"));

try {
  const adminOrderTotalsSource = await readFile(
    new URL("../src/lib/admin-order-totals.ts", import.meta.url),
    "utf8"
  );
  const customerDisplaySource = await readFile(
    new URL("../src/lib/customer-display.ts", import.meta.url),
    "utf8"
  );
  const staffReportSource = await readFile(
    new URL("../src/lib/staff-session-report.ts", import.meta.url),
    "utf8"
  );

  const adminOrderTotalsPath = path.join(tempDir, "admin-order-totals.mjs");
  const customerDisplayPath = path.join(tempDir, "customer-display.mjs");
  const staffReportPath = path.join(tempDir, "staff-session-report.mjs");

  await writeFile(adminOrderTotalsPath, transpile(adminOrderTotalsSource), "utf8");
  await writeFile(customerDisplayPath, transpile(customerDisplaySource), "utf8");
  await writeFile(
    staffReportPath,
    transpile(staffReportSource)
      .replace('"./admin-order-totals"', '"./admin-order-totals.mjs"')
      .replace('"./customer-display"', '"./customer-display.mjs"'),
    "utf8"
  );

  const { buildStaffSessionSummaryHtml } = await import(pathToFileURL(staffReportPath).href);

  // Reference date fixed at 2026-08-12 14:00 Manila time, so "today" is
  // unambiguous regardless of when this test actually runs.
  const referenceDate = new Date("2026-08-12T06:00:00.000Z");

  // Today-scoping: an order from yesterday must not appear in the report.
  {
    const todayOrder = makeOrder({ id: "today-order", total_amount: 150 });
    const yesterdayOrder = makeOrder({
      id: "yesterday-order",
      total_amount: 999,
      ordered_at: "2026-08-11T06:00:00.000Z",
    });
    const html = buildStaffSessionSummaryHtml({
      orders: [todayOrder, yesterdayOrder],
      staffName: "Chrizelda",
      referenceDate,
    });
    assert.ok(html.includes(">1<"), "today's order should be counted in the Orders Handled stat");
    assert.ok(!html.includes("999"), "yesterday's order total must not appear in today's report");
    console.log("  PASS: today-scoping excludes orders from other days");
  }

  // Zero orders today -> "No orders today", no crash.
  {
    const html = buildStaffSessionSummaryHtml({
      orders: [],
      staffName: "Chrizelda",
      referenceDate,
    });
    assert.ok(html.includes("No orders today"));
    assert.ok(html.includes("Chrizelda"));
    console.log("  PASS: zero orders today renders the empty state, not a crash");
  }

  // In-progress orders (not in FINISHED_STATUSES) are excluded even if
  // they're from today.
  {
    const finished = makeOrder({ id: "finished", status: "completed", total_amount: 150 });
    const inProgress = makeOrder({ id: "in-progress", status: "preparing", total_amount: 500 });
    const html = buildStaffSessionSummaryHtml({
      orders: [finished, inProgress],
      staffName: "Chrizelda",
      referenceDate,
    });
    assert.ok(!html.includes("500"), "an in-progress order's total must not appear");
    console.log("  PASS: in-progress (non-finished) orders are excluded from today's report");
  }

  // Revenue / cash-vs-online breakdown, hand-computed.
  {
    const cashOrder = makeOrder({
      id: "cash-order",
      payment_method: "cash",
      payment_status: "paid",
      total_amount: 100,
    });
    const onlineOrder = makeOrder({
      id: "online-order",
      payment_method: "gcash",
      payment_status: "paid",
      total_amount: 60,
    });
    const unpaidOrder = makeOrder({
      id: "unpaid-order",
      payment_method: "cash",
      payment_status: "unpaid",
      total_amount: 1000,
    });
    const html = buildStaffSessionSummaryHtml({
      orders: [cashOrder, onlineOrder, unpaidOrder],
      staffName: "Chrizelda",
      referenceDate,
    });
    // total revenue = 100 + 60 = 160 (unpaid excluded); cash = 100; online = 60
    assert.ok(html.includes("₱160"), "total revenue should be 160");
    assert.ok(html.includes("₱100"), "cash revenue should be 100");
    assert.ok(html.includes("₱60"), "online revenue should be 60");
    assert.ok(!html.includes("1,000") && !html.includes("1000"), "unpaid order total must not be counted");
    console.log("  PASS: revenue and cash-vs-online breakdown match hand-computed values, excluding unpaid orders");
  }

  // Walk-in / pickup / delivery breakdown, hand-computed.
  {
    const deliveryOrder = makeOrder({ id: "delivery-order", order_type: "delivery" });
    const walkinOrder = makeOrder({ id: "walkin-order", order_type: "pickup", walkin_name: "Juan" });
    const pickupOrder = makeOrder({ id: "pickup-order", order_type: "pickup", walkin_name: null });
    const html = buildStaffSessionSummaryHtml({
      orders: [deliveryOrder, walkinOrder, pickupOrder],
      staffName: "Chrizelda",
      referenceDate,
    });
    // Each bucket should show 1 -- check the labeled stat blocks contain a "1".
    const deliveryBlock = html.split("Delivery</div>")[1]?.slice(0, 40) ?? "";
    const pickupBlock = html.split("Pickup</div>")[1]?.slice(0, 40) ?? "";
    const walkinBlock = html.split("Walk-in</div>")[1]?.slice(0, 40) ?? "";
    assert.ok(deliveryBlock.includes(">1<"), "expected 1 delivery order");
    assert.ok(pickupBlock.includes(">1<"), "expected 1 pickup order");
    assert.ok(walkinBlock.includes(">1<"), "expected 1 walk-in order");
    console.log("  PASS: order-type breakdown (delivery/pickup/walk-in) matches hand-computed counts");
  }

  // Masked customer name appears in the finished-orders table (privacy).
  {
    const order = makeOrder({
      id: "masked-name-order",
      customer_profile: { full_name: "Juan Dela Cruz", email: "juan@example.com", phone: null },
      delivery_email: null,
      walkin_name: null,
    });
    const html = buildStaffSessionSummaryHtml({
      orders: [order],
      staffName: "Chrizelda",
      referenceDate,
    });
    assert.ok(!html.includes("Juan Dela Cruz"), "full customer name must not appear unmasked");
    console.log("  PASS: customer names in the report are masked, not shown in full");
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("\nAll staff-session-report.ts checks passed.");
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd frontend && node scripts/verify-reports.mjs`
Expected: FAIL (module not found), since `staff-session-report.ts` doesn't exist yet if run
before Step 1 is applied. Since Steps 1 and 2 are provided together above, confirm failure by
temporarily renaming `staff-session-report.ts`, then restore it.

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && node scripts/verify-reports.mjs`
Expected: exits 0, prints all 6 PASS lines under "Testing staff-session-report.ts...", ending
in `All staff-session-report.ts checks passed.`

- [ ] **Step 5: Add the `test:reports` script to `frontend/package.json`**

In the `"scripts"` block, add a new line after the existing `"test:item-action-insights"` line:

```json
    "test:item-action-insights": "node scripts/verify-item-action-insights.mjs",
    "test:reports": "node scripts/verify-reports.mjs",
```

- [ ] **Step 6: Run via npm to confirm the script wiring works**

Run: `cd frontend && npm run test:reports`
Expected: same pass output as Step 4, invoked through npm.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/staff-session-report.ts frontend/scripts/verify-reports.mjs frontend/package.json
git commit -m "feat: add staff session summary report builder"
```

---

### Task 2: Admin Analytics Summary report (`admin-analytics-report.ts`)

**Files:**
- Create: `frontend/src/lib/admin-analytics-report.ts`
- Modify: `frontend/scripts/verify-reports.mjs` (append)

**Interfaces:**
- Consumes: nothing (zero imports — local types only).
- Produces: `buildAdminAnalyticsSummaryHtml(params: {
  periodLabel: string;
  generatedAt?: Date;
  kpis: { totalOrders: number; totalRevenue: number; averageOrderValue: number; averageRating: number };
  weeklyTrend: Array<{ label: string; orders: number }>;
  topSellers: Array<{ item: string; orders: number; revenue: number; rating: number }>;
  peakHourWindows: Array<{ day_of_week: number; hour_start: number; hour_end: number; avg_order_count: number; intensity: string }>;
  demandForecast: { forecast: Array<{ date: string; predictedOrders: number }>; diagnostics: { rSquared: number; rmse: number } } | null;
  }): string`. Consumed by Task 4's `admin-dashboard.tsx`.

- [ ] **Step 1: Write `admin-analytics-report.ts`**

```typescript
// frontend/src/lib/admin-analytics-report.ts

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function peso(value: number): string {
  return `₱${Math.round(value).toLocaleString("en-PH")}`;
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
}

function formatPeakWindowLabel(window: { day_of_week: number; hour_start: number; hour_end: number }): string {
  const dayName = DAY_NAMES[window.day_of_week] ?? "Unknown";
  return `${dayName} ${formatHourLabel(window.hour_start)}–${formatHourLabel(window.hour_end)}`;
}

export function buildAdminAnalyticsSummaryHtml(params: {
  periodLabel: string;
  generatedAt?: Date;
  kpis: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    averageRating: number;
  };
  weeklyTrend: Array<{ label: string; orders: number }>;
  topSellers: Array<{ item: string; orders: number; revenue: number; rating: number }>;
  peakHourWindows: Array<{
    day_of_week: number;
    hour_start: number;
    hour_end: number;
    avg_order_count: number;
    intensity: string;
  }>;
  demandForecast: {
    forecast: Array<{ date: string; predictedOrders: number }>;
    diagnostics: { rSquared: number; rmse: number };
  } | null;
}): string {
  const { periodLabel, generatedAt = new Date(), kpis, weeklyTrend, topSellers, peakHourWindows, demandForecast } = params;

  const generatedLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(generatedAt);

  const topPeakWindows = [...peakHourWindows]
    .sort((a, b) => b.avg_order_count - a.avg_order_count)
    .slice(0, 3);

  const forecastTotal = demandForecast
    ? demandForecast.forecast.reduce((sum, point) => sum + point.predictedOrders, 0)
    : 0;

  return `
    <!doctype html>
    <html>
      <head>
        <title>KadaServe Analytics Summary</title>
        <style>
          body { color: #0D2E18; font-family: Arial, Helvetica, sans-serif; margin: 32px; }
          .brand { color: #0D2E18; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin-bottom: 4px; }
          .summary { border-bottom: 2px solid #684B35; margin-bottom: 20px; padding-bottom: 14px; }
          .summary h1 { font-size: 20px; margin: 0 0 8px; }
          .summary p { color: #684B35; font-size: 13px; margin: 0; }
          .stats { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 20px; }
          .stat { background: #FFF8EF; border: 1px solid #E7D7BC; border-radius: 8px; min-width: 140px; padding: 10px 14px; }
          .stat .label { color: #684B35; font-size: 11px; text-transform: uppercase; }
          .stat .value { font-size: 18px; font-weight: 700; }
          section { margin-bottom: 24px; }
          section h2 { border-bottom: 1px solid #E7D7BC; font-size: 15px; padding-bottom: 6px; }
          table { border-collapse: collapse; font-size: 11px; width: 100%; }
          th { background: #FFF0DA; color: #0D2E18; text-align: left; }
          th, td { border-bottom: 1px solid #E7D7BC; padding: 9px 7px; vertical-align: top; }
          .money { font-weight: 700; text-align: right; white-space: nowrap; }
          .empty { color: #8C7A64; padding: 12px 0; }
          @media print { body { margin: 18px; } }
        </style>
      </head>
      <body>
        <div class="brand">KadaServe</div>
        <section class="summary">
          <h1>Analytics Summary &mdash; ${escapeHtml(periodLabel)}</h1>
          <p>Generated ${escapeHtml(generatedLabel)}</p>
        </section>

        <div class="stats">
          <div class="stat"><div class="label">Total Orders</div><div class="value">${kpis.totalOrders}</div></div>
          <div class="stat"><div class="label">Revenue</div><div class="value">${escapeHtml(peso(kpis.totalRevenue))}</div></div>
          <div class="stat"><div class="label">Avg Order Value</div><div class="value">${escapeHtml(peso(kpis.averageOrderValue))}</div></div>
          <div class="stat"><div class="label">Satisfaction</div><div class="value">${kpis.averageRating.toFixed(1)}/5</div></div>
        </div>

        <section>
          <h2>Weekly Trend</h2>
          ${
            weeklyTrend.length === 0
              ? `<p class="empty">Not enough data yet</p>`
              : `
          <table>
            <thead><tr><th>Week</th><th>Orders</th></tr></thead>
            <tbody>
              ${weeklyTrend
                .map((point) => `<tr><td>${escapeHtml(point.label)}</td><td>${point.orders}</td></tr>`)
                .join("")}
            </tbody>
          </table>
          `
          }
        </section>

        <section>
          <h2>Top Sellers</h2>
          ${
            topSellers.length === 0
              ? `<p class="empty">Not enough data yet</p>`
              : `
          <table>
            <thead><tr><th>Item</th><th>Orders</th><th>Revenue</th><th>Rating</th></tr></thead>
            <tbody>
              ${topSellers
                .slice(0, 10)
                .map(
                  (item) => `
                    <tr>
                      <td>${escapeHtml(item.item)}</td>
                      <td>${item.orders}</td>
                      <td class="money">${escapeHtml(peso(item.revenue))}</td>
                      <td>${item.rating.toFixed(1)}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
          `
          }
        </section>

        <section>
          <h2>Peak Hours</h2>
          ${
            topPeakWindows.length === 0
              ? `<p class="empty">Not enough data yet</p>`
              : `
          <table>
            <thead><tr><th>Window</th><th>Avg Orders</th><th>Intensity</th></tr></thead>
            <tbody>
              ${topPeakWindows
                .map(
                  (window) => `
                    <tr>
                      <td>${escapeHtml(formatPeakWindowLabel(window))}</td>
                      <td>${window.avg_order_count.toFixed(1)}</td>
                      <td>${escapeHtml(window.intensity)}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
          `
          }
        </section>

        <section>
          <h2>Demand Forecast</h2>
          ${
            demandForecast
              ? `<p>Next 7 days: <strong>${Math.round(forecastTotal)} predicted orders</strong> (R² ${demandForecast.diagnostics.rSquared.toFixed(3)}, RMSE ${demandForecast.diagnostics.rmse.toFixed(2)}).</p>`
              : `<p class="empty">Not enough order history yet for a forecast</p>`
          }
        </section>

        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
    </html>
  `;
}
```

- [ ] **Step 2: Append tests to `frontend/scripts/verify-reports.mjs`**

Add this block at the very end of the file (after the `console.log("\nAll staff-session-report.ts checks passed.");` line from Task 1):

```javascript
console.log("\nTesting admin-analytics-report.ts...");

// Zero imports -- the simple data-URL trick works directly, no temp files.
const { buildAdminAnalyticsSummaryHtml } = await importDataUrlModule(
  "../src/lib/admin-analytics-report.ts"
);

function makeKpis(overrides) {
  return {
    totalOrders: 48,
    totalRevenue: 6672,
    averageOrderValue: 139,
    averageRating: 4.6,
    ...overrides,
  };
}

// KPI numbers thread through correctly.
{
  const html = buildAdminAnalyticsSummaryHtml({
    periodLabel: "May 2026",
    generatedAt: new Date("2026-08-12T06:00:00.000Z"),
    kpis: makeKpis(),
    weeklyTrend: [{ label: "May 11-17", orders: 48 }],
    topSellers: [{ item: "Spanish Latte", orders: 42, revenue: 3990, rating: 4.9 }],
    peakHourWindows: [
      { day_of_week: 1, hour_start: 19, hour_end: 20, avg_order_count: 5, intensity: "high" },
    ],
    demandForecast: null,
  });
  assert.ok(html.includes("May 2026"));
  assert.ok(html.includes("48")); // totalOrders
  assert.ok(html.includes("₱6,672"));
  assert.ok(html.includes("4.6/5"));
  console.log("  PASS: KPI numbers are threaded through correctly");
}

// Weekly trend and top sellers render real rows.
{
  const html = buildAdminAnalyticsSummaryHtml({
    periodLabel: "May 2026",
    kpis: makeKpis(),
    weeklyTrend: [
      { label: "Apr 27-May 3", orders: 12 },
      { label: "May 4-10", orders: 24 },
      { label: "May 11-17", orders: 48 },
    ],
    topSellers: [
      { item: "Spanish Latte", orders: 42, revenue: 3990, rating: 4.9 },
      { item: "Strawberry Matcha", orders: 36, revenue: 3240, rating: 4.8 },
    ],
    peakHourWindows: [],
    demandForecast: null,
  });
  assert.ok(html.includes("Apr 27-May 3") && html.includes("May 11-17"));
  assert.ok(html.includes("Spanish Latte") && html.includes("Strawberry Matcha"));
  console.log("  PASS: weekly trend and top sellers render the given rows");
}

// Peak hours: only the top 3 by avg_order_count appear, sorted descending.
{
  const html = buildAdminAnalyticsSummaryHtml({
    periodLabel: "May 2026",
    kpis: makeKpis(),
    weeklyTrend: [],
    topSellers: [],
    peakHourWindows: [
      { day_of_week: 1, hour_start: 19, hour_end: 20, avg_order_count: 3, intensity: "medium" },
      { day_of_week: 5, hour_start: 20, hour_end: 21, avg_order_count: 9, intensity: "high" },
      { day_of_week: 6, hour_start: 21, hour_end: 22, avg_order_count: 7, intensity: "high" },
      { day_of_week: 0, hour_start: 14, hour_end: 15, avg_order_count: 1, intensity: "low" },
    ],
    demandForecast: null,
  });
  const windowSectionIndex = html.indexOf("Peak Hours");
  const windowSection = html.slice(windowSectionIndex, windowSectionIndex + 1200);
  assert.ok(windowSection.includes("Friday"), "the 9-order Friday window should be in the top 3");
  assert.ok(windowSection.includes("Saturday"), "the 7-order Saturday window should be in the top 3");
  assert.ok(windowSection.includes("Monday"), "the 3-order Monday window should be in the top 3");
  assert.ok(!windowSection.includes("Sunday"), "the 1-order Sunday window (4th highest) should be excluded by the top-3 cap");
  console.log("  PASS: peak hours shows only the top 3 windows by avg_order_count");
}

// Graceful degradation: demandForecast null.
{
  const html = buildAdminAnalyticsSummaryHtml({
    periodLabel: "May 2026",
    kpis: makeKpis(),
    weeklyTrend: [],
    topSellers: [],
    peakHourWindows: [],
    demandForecast: null,
  });
  assert.ok(html.includes("Not enough order history yet for a forecast"));
  console.log("  PASS: null demandForecast renders the graceful-degradation message, not a crash");
}

// Graceful degradation: demandForecast present, correct total/R2/RMSE shown.
{
  const html = buildAdminAnalyticsSummaryHtml({
    periodLabel: "May 2026",
    kpis: makeKpis(),
    weeklyTrend: [],
    topSellers: [],
    peakHourWindows: [],
    demandForecast: {
      forecast: [
        { date: "2026-06-01", predictedOrders: 10 },
        { date: "2026-06-02", predictedOrders: 12 },
      ],
      diagnostics: { rSquared: 0.994, rmse: 0.38 },
    },
  });
  assert.ok(html.includes("22 predicted orders"), "forecast total should be 10 + 12 = 22");
  assert.ok(html.includes("0.994"));
  assert.ok(html.includes("0.38"));
  console.log("  PASS: a present demandForecast shows the correct next-7-day total, R2, and RMSE");
}

// Graceful degradation: peakHourWindows empty.
{
  const html = buildAdminAnalyticsSummaryHtml({
    periodLabel: "May 2026",
    kpis: makeKpis(),
    weeklyTrend: [],
    topSellers: [],
    peakHourWindows: [],
    demandForecast: null,
  });
  const windowSectionIndex = html.indexOf("Peak Hours");
  const windowSection = html.slice(windowSectionIndex, windowSectionIndex + 200);
  assert.ok(windowSection.includes("Not enough data yet"));
  console.log("  PASS: empty peakHourWindows renders the graceful-degradation message, not a crash");
}

console.log("\nAll admin-analytics-report.ts checks passed.");
```

- [ ] **Step 3: Run to verify it fails, then passes**

Run: `cd frontend && node scripts/verify-reports.mjs`
Expected before Step 1 is applied: FAIL (module not found for `admin-analytics-report.ts`).
Since Steps 1 and 2 are given together, confirm failure by temporarily renaming
`admin-analytics-report.ts`, then restore it and re-run.

Run: `cd frontend && node scripts/verify-reports.mjs`
Expected: exits 0, prints all PASS lines from BOTH "Testing staff-session-report.ts..." and
"Testing admin-analytics-report.ts..." sections, ending in
`All admin-analytics-report.ts checks passed.`

- [ ] **Step 4: Run via npm**

Run: `cd frontend && npm run test:reports`
Expected: same full pass output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/admin-analytics-report.ts frontend/scripts/verify-reports.mjs
git commit -m "feat: add admin analytics summary report builder"
```

---

### Task 3: Wire "Session Report" button into `staff-dashboard.tsx`

**Files:**
- Modify: `frontend/src/features/staff/components/staff-dashboard.tsx`

**Interfaces:**
- Consumes: `buildStaffSessionSummaryHtml` from `@/lib/staff-session-report` (Task 1).

- [ ] **Step 1: Import the builder**

Near the top of `frontend/src/features/staff/components/staff-dashboard.tsx`, alongside the
other `@/lib/...` imports, add:

```typescript
import { buildStaffSessionSummaryHtml } from "@/lib/staff-session-report";
```

- [ ] **Step 2: Add the open-tab-and-print handler, with popup-blocked fallback**

Find the `finalStatuses` constant near the top of the file (currently):

```typescript
const finalStatuses: OrderStatus[] = [
  "completed",
  "delivered",
  "cancelled",
  "expired",
];
const sessionSummaryPageSize = 8;
```

Leave it as-is (it stays local to this component; the report builder has its own internal
copy for independence, per Task 1). Now find the component function body — near where
`orders` and `staffProfile` state are declared (search for
`const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);`) — and add a
handler function inside the component, placed near other handler functions (e.g. right after
wherever `loadOrders` is defined):

```typescript
  function handleSessionReport() {
    const staffName = staffProfile?.fullName?.trim() || "Staff";
    const html = buildStaffSessionSummaryHtml({ orders, staffName });
    const reportWindow = window.open("", "_blank");

    if (!reportWindow) {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kadaserve-session-report-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return;
    }

    reportWindow.document.write(html);
    reportWindow.document.close();
  }
```

(This mirrors `openPdfReport`/`downloadPrintableReport` in `admin-orders-view.tsx` exactly —
inline rather than importing that pair, since they're component-local, untested glue there
too, not exported utilities.)

- [ ] **Step 3: Add the button next to the existing "Open History" link**

Find this block (the "Session Summary" panel header, search for
`{historyOrders.length} shown`):

```tsx
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-[#EFE3CF] px-2.5 py-1 font-sans text-xs font-semibold text-[#684B35]">
        {historyOrders.length} shown
      </span>
      <Link
        href="/staff/order-history"
        className="rounded-full bg-[#0D2E18] px-3 py-1.5 font-sans text-xs font-semibold text-[#FFF0DA]"
      >
        Open History
      </Link>
    </div>
```

Replace with (adds a new button before the existing `Link`, matching its pill styling but as
a `<button>` since it triggers a client action rather than navigating):

```tsx
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-[#EFE3CF] px-2.5 py-1 font-sans text-xs font-semibold text-[#684B35]">
        {historyOrders.length} shown
      </span>
      <button
        type="button"
        onClick={handleSessionReport}
        className="rounded-full border border-[#0D2E18] px-3 py-1.5 font-sans text-xs font-semibold text-[#0D2E18] transition hover:bg-[#0D2E18] hover:text-[#FFF0DA]"
      >
        Session Report
      </button>
      <Link
        href="/staff/order-history"
        className="rounded-full bg-[#0D2E18] px-3 py-1.5 font-sans text-xs font-semibold text-[#FFF0DA]"
      >
        Open History
      </Link>
    </div>
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `cd frontend && npx eslint src/features/staff/components/staff-dashboard.tsx src/lib/staff-session-report.ts`
Expected: no errors.

- [ ] **Step 6: Manually verify in the browser**

Start the dev server, log in as staff. On the dashboard, find the "Session Summary" panel and
click the new "Session Report" button. Expected: a new tab opens showing the KadaServe-branded
report with today's stats and finished-orders table (or "No orders today" if there are none),
and the browser's print dialog appears automatically. No console errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/staff/components/staff-dashboard.tsx
git commit -m "feat: add Session Report button to staff dashboard"
```

---

### Task 4: Wire "Analytics Summary Report" button into `admin-dashboard.tsx`

**Files:**
- Modify: `frontend/src/features/admin/components/admin-dashboard.tsx`

**Interfaces:**
- Consumes: `buildAdminAnalyticsSummaryHtml` from `@/lib/admin-analytics-report` (Task 2),
  `getAdminReportRangeLabel` from `@/lib/admin-order-totals` (existing, not currently
  imported in this file — needs adding).

- [ ] **Step 1: Add imports**

Find the existing `@/lib/admin-order-totals` import (currently):

```typescript
import {
  getAdminOrderTotals,
  getAdminOrdersMetricLabel,
  getAdminReportOrders,
  getManilaDateOnly,
  isValidAdminOrder,
} from "@/lib/admin-order-totals";
```

Add `getAdminReportRangeLabel`:

```typescript
import {
  getAdminOrderTotals,
  getAdminOrdersMetricLabel,
  getAdminReportOrders,
  getAdminReportRangeLabel,
  getManilaDateOnly,
  isValidAdminOrder,
} from "@/lib/admin-order-totals";
```

Then add a new import for the report builder, near the top of the file alongside other
`@/lib/...` imports:

```typescript
import { buildAdminAnalyticsSummaryHtml } from "@/lib/admin-analytics-report";
```

- [ ] **Step 2: Add the open-tab-and-print handler**

Add this handler function inside the `AdminDashboard` component body, near where
`dashboardMetrics`/`dashboardRange`/`demandForecast` are already computed (search for
`const dashboardMetrics = {` and add this function right after that block closes):

```typescript
  function handleAnalyticsSummaryReport() {
    const periodLabel = getAdminReportRangeLabel(
      dashboardRange.timeFilter,
      dashboardRange.customStartDate,
      dashboardRange.customEndDate
    );
    const html = buildAdminAnalyticsSummaryHtml({
      periodLabel,
      kpis: {
        totalOrders: dashboardMetrics.totalOrders,
        totalRevenue: dashboardMetrics.totalRevenue,
        averageOrderValue: dashboardMetrics.averageOrderValue,
        averageRating: dashboardMetrics.averageRating,
      },
      weeklyTrend: weeklyTrendCounts,
      topSellers: displayItemRanking,
      peakHourWindows,
      demandForecast,
    });
    const reportWindow = window.open("", "_blank");

    if (!reportWindow) {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kadaserve-analytics-summary-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return;
    }

    reportWindow.document.write(html);
    reportWindow.document.close();
  }
```

(Note: `dashboardMetrics.totalRevenue` is the same value exposed under the `monthlyRevenue`
alias elsewhere in this file — both refer to `dashboardOrderTotals.totalRevenue`. Using
`totalRevenue` here for clarity since `admin-analytics-report.ts`'s `kpis.totalRevenue` field
name matches it directly.)

- [ ] **Step 3: Add the button to the header, next to "Refresh Analytics"**

Find this block (currently):

```tsx
{/* CENTER: Refresh Button */}
<div className="hidden xl:block">
  <button
    type="button"
    onClick={() => void handleRefreshAnalytics()}
    disabled={isRefreshingAnalytics}
    aria-label="Refresh analytics"
    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#D6C6AC] bg-[#FFF8EF] px-3.5 font-sans text-[0.7rem] font-bold text-[#684B35] transition hover:bg-white disabled:opacity-60"
  >
    <RefreshCw size={14} strokeWidth={1.8} className={isRefreshingAnalytics ? "animate-spin" : ""} />
    {isRefreshingAnalytics ? "Refreshing" : "Refresh Analytics"}
  </button>
</div>
```

Replace with (wraps both buttons in a flex row so they sit side by side):

```tsx
{/* CENTER: Refresh + Report Buttons */}
<div className="hidden items-center gap-2 xl:flex">
  <button
    type="button"
    onClick={() => void handleRefreshAnalytics()}
    disabled={isRefreshingAnalytics}
    aria-label="Refresh analytics"
    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#D6C6AC] bg-[#FFF8EF] px-3.5 font-sans text-[0.7rem] font-bold text-[#684B35] transition hover:bg-white disabled:opacity-60"
  >
    <RefreshCw size={14} strokeWidth={1.8} className={isRefreshingAnalytics ? "animate-spin" : ""} />
    {isRefreshingAnalytics ? "Refreshing" : "Refresh Analytics"}
  </button>
  <button
    type="button"
    onClick={handleAnalyticsSummaryReport}
    aria-label="Generate analytics summary report"
    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#D6C6AC] bg-[#FFF8EF] px-3.5 font-sans text-[0.7rem] font-bold text-[#684B35] transition hover:bg-white"
  >
    Analytics Summary Report
  </button>
</div>
```

(`RefreshCw` is already imported for the existing button, unaffected by this change.)

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. If there's an error about `getAdminReportRangeLabel` not being exported
from `@/lib/admin-order-totals`, confirm it's exported there (it is — it's already used
internally by `getAdminOrdersMetricLabel` in that same file and imported directly by
`admin-orders-view.tsx`).

- [ ] **Step 5: Lint**

Run: `cd frontend && npx eslint src/features/admin/components/admin-dashboard.tsx src/lib/admin-analytics-report.ts`
Expected: no errors.

- [ ] **Step 6: Run the full report verification suite one more time**

Run: `cd frontend && npm run test:reports`
Expected: all PASS lines, unaffected by this UI-only task.

- [ ] **Step 7: Manually verify in the browser**

Start the dev server, log in as admin, open the Dashboard tab. Click "Analytics Summary
Report" in the header. Expected: a new tab opens with the KPI summary, weekly trend, top
sellers, peak hours, and demand forecast recap (or its graceful-degradation message if there's
not enough order history), matching the period shown on-screen. Print dialog appears
automatically. No console errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/admin/components/admin-dashboard.tsx
git commit -m "feat: add Analytics Summary Report button to admin dashboard"
```

---

### Task 5: Final full verification pass

**Files:** none (verification only), except the spec doc status update in Step 5.

**Interfaces:** none — this task exercises everything built in Tasks 1-4 together.

- [ ] **Step 1: Full verification script suite**

Run: `cd frontend && npm run test:analytics && npm run test:dashboard-range && npm run test:recommendations && npm run test:item-action-insights && npm run test:reports`
Expected: all five scripts print their full PASS lists, all exit 0.

- [ ] **Step 2: Full project typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint the touched files**

Run: `cd frontend && npx eslint src/lib/staff-session-report.ts src/lib/admin-analytics-report.ts src/features/staff/components/staff-dashboard.tsx src/features/admin/components/admin-dashboard.tsx`
Expected: no errors.

- [ ] **Step 4: End-to-end browser walkthrough**

Start the dev server. As staff: click "Session Report" on the dashboard, confirm the report
tab opens with correct today's data (or the empty state). As admin: click "Analytics Summary
Report" on the Dashboard tab, confirm the report tab opens with correct period-matched data
(or graceful-degradation messages if forecast/peak-hour data is thin). Confirm neither report
button interferes with the existing CSV/PDF export buttons on `admin-orders-view.tsx` or
`staff-order-history.tsx` (those are untouched by this plan — spot check they still work).
No console errors anywhere in this walkthrough.

- [ ] **Step 5: Update the spec doc status line**

In `docs/superpowers/specs/2026-08-09-reports-generation-design.md`, change the `Status:`
line from "Approved by user (2026-08-09), pending write-up review" to
"Implemented (2026-08-12)".

- [ ] **Step 6: Final commit**

```bash
git add docs/superpowers/specs/2026-08-09-reports-generation-design.md
git commit -m "docs: mark reports generation spec as implemented"
```

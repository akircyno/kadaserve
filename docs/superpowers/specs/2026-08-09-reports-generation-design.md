# Reports Generation Improvements — Design

Status: Approved by user (2026-08-09), pending write-up review
Origin: Thesis defense panel revision — "Reports generation improvements" (Staff and Admin page)

## Context

This is Sub-project C of three derived from the panel's revision list:

- A. AI Analytics + Presentation (Admin) — **implemented and merged**
- B. AI Recommendations (Customer) — **implemented and merged**
- **C. Reports Generation (Staff + Admin) — this doc**
- (Online Payment — parked, blocked on the manager's PayMongo account)

### What already exists

Both current exports are raw transaction dumps, not summary reports:

- **Admin** (`frontend/src/features/admin/components/admin-orders-view.tsx`) — a CSV export
  (`downloadCsv`/`getExportRows`, lines 122-193) and a "PDF" export (`openPdfReport`/
  `buildPdfReportHtml`, lines 204-317) on the Demand → Orders view. The "PDF" is not a real
  PDF — it opens an HTML page in a new tab and calls `window.print()`, relying on the
  browser's Save-as-PDF. Both are order-list tables (one row per order) plus a single revenue
  total line. No PDF library is installed in this project (`grep -i pdf frontend/package.json`
  returns nothing).
- **Staff** (`frontend/src/features/staff/components/staff-order-history.tsx`) — CSV export
  only (`handleDownloadCsv`, line 334), fetched server-side via `?export=csv` on the order
  history API route. Same shape: one row per order.

Neither surface has anything aggregated — no revenue summary, no top items, no trends. The
gap this sub-project fills is a genuine **summary report**, not a bigger order dump.

There is no shift/clock-in system anywhere in the codebase (confirmed: no session-start
tracking, no login-timestamp-based scoping). "Session Summary" in the staff dashboard today
is just a UI label over recent finished/cancelled/expired orders, not a bounded shift window.

## Goals

1. Add a **Staff Session Summary report** — scoped to today (Manila calendar day), covering
   what a staff member would hand over at end of shift: orders handled, revenue collected,
   payment-method and order-type breakdowns, and the day's finished order list.
2. Add an **Admin Analytics Summary report** — a real aggregated report (KPIs, trends, top
   items, peak hours, and the Sub-project A demand forecast), sourced entirely from data
   already loaded in the admin dashboard's state. Distinct from the existing raw order-list
   export, which stays as-is.
3. Keep both reports testable: extract them as pure, isolated builder functions (data in,
   HTML string out) rather than inline in the large view components, so they get real
   automated coverage via this project's standalone-script test convention — unlike the
   existing `buildPdfReportHtml`, which is untested.

## Non-goals

- Not touching the existing CSV/order-list PDF exports on either page. They serve a different
  purpose (raw data for spreadsheets/audits) and stay exactly as they are.
- Not adding a PDF-generation library. The print-to-PDF pattern already works, has zero
  dependency cost, and matches how the existing export already behaves — consistent with the
  "no new npm dependencies" constraint both prior sub-projects held to.
- Not adding shift/clock-in tracking. The Staff report is date-scoped (today), not a true
  per-shift boundary — a real shift system is a separate, much larger feature.
- Not adding scheduling, emailing, or server-side report storage. Both reports are
  generate-on-demand, client-side, matching the existing export UX exactly.

## Architecture

Two new files, following the flat `frontend/src/lib/*.ts` convention:

- `frontend/src/lib/staff-session-report.ts` — `buildStaffSessionSummaryHtml(params): string`.
  Pure function. Takes the full orders list already loaded in `staff-dashboard.tsx`'s state
  (confirmed via `/api/staff/orders/list` — it returns all orders, unfiltered by date) plus
  the staff profile name, and does the today-scoping itself using the existing
  `getManilaDateOnly` helper from `@/lib/admin-order-totals` (Manila calendar day, matching
  the timezone convention already used for admin dashboard range filtering) before rendering.
  Imports only `getManilaDateOnly` from `@/lib/admin-order-totals` and
  `maskCustomerName`/`formatNameFromEmail` from `@/lib/customer-display` (both already small,
  minimal-dependency lib files) — no other value imports, keeping it testable via the same
  temp-file transpile pattern established in `verify-recommendations.mjs` for files with a
  relative/aliased import.
- `frontend/src/lib/admin-analytics-report.ts` — `buildAdminAnalyticsSummaryHtml(params): string`.
  Pure function. Takes the already-computed dashboard metrics as plain data (KPI totals,
  `weeklyTrendCounts`, top-seller item ranking, `peakHourWindows`, `demandForecast` — the
  exact shapes already used to render `admin-dashboard.tsx`/`admin-overview-view.tsx`) and
  returns a complete HTML document string. Zero imports beyond types.

Component-side glue (not separately tested, matches the existing untested `openPdfReport`
pattern exactly):

- `frontend/src/features/staff/components/staff-dashboard.tsx` — new "Session Report" button
  near the existing Session Summary panel; on click, calls `buildStaffSessionSummaryHtml`
  with today's orders already in state, opens a new tab, writes the HTML, matching the
  existing `openPdfReport`/`downloadPrintableReport` popup-blocked fallback exactly.
- `frontend/src/features/admin/components/admin-overview-view.tsx` (or `admin-dashboard.tsx`,
  wherever the data is most directly in scope) — new "Analytics Summary Report" button on the
  Dashboard tab; same open-tab-and-print mechanism, fed from state already computed for the
  on-screen dashboard.

## Data flow

`(data already loaded for the on-screen dashboard) → pure builder function → HTML string →
new tab → window.print()`. No new API routes. No new fetching. The admin report reads the
exact same `dashboardRange`-selected period (Sub-project A's `computeAdminDashboardRange`)
already driving the on-screen KPIs, so the report and the screen never disagree about what
period they're describing.

## Report content

**Staff Session Summary:**
- Header: KadaServe branding, staff name, date (today, Manila timezone)
- Summary stats: total orders handled, total revenue collected (paid, valid orders only),
  cash vs. online breakdown, pickup/delivery/walk-in breakdown, completed/cancelled/expired
  counts
- Table: today's finished orders — order code, masked customer name, item summary, type,
  payment, status, total, time
- Zero orders today → report still renders, states "No orders today" rather than erroring

**Admin Analytics Summary:**
- Header: KadaServe branding, report period (from `dashboardRange`), generated timestamp
- KPI summary: total orders, revenue, average order value, satisfaction
- Weekly trend: the same week-over-week order counts shown on-screen
- Top sellers: item ranking table (name, orders, revenue, rating)
- Peak hours: top 3 busiest windows from `peakHourWindows`
- Demand forecast recap: next-7-day predicted total plus the model's R² and RMSE
  (Sub-project A's diagnostics), or "Not enough order history yet for a forecast" if
  `demandForecast` is null — matching the on-screen empty state exactly, never a crash
- Missing peak-hour data → "Not enough data yet" in that section, same principle

## Error handling

Both builders are pure functions over already-validated data (the same data already
successfully rendering the dashboard, so no new validation surface). The only failure mode
worth handling is the browser blocking `window.open` — both report buttons reuse the existing
`downloadPrintableReport` fallback (download the HTML as a file directly) already proven in
`admin-orders-view.tsx`.

## Testing

Following the established convention (no Jest/Vitest): `frontend/scripts/verify-reports.mjs`,
covering both builder functions with **content-presence assertions** (the output HTML string
contains the correct computed total revenue, correct order count, etc.) rather than brittle
exact-string/snapshot matching, since these are HTML documents with styling markup that
shouldn't be pinned byte-for-byte. Covers: correct today-scoping for the staff report, the
zero-orders empty state, correct KPI numbers threaded through for the admin report, and both
of the admin report's graceful-degradation cases (`demandForecast: null`,
`peakHourWindows: []`).

## References

None beyond this project's own established patterns — this sub-project extends existing,
already-working mechanisms (print-to-PDF, standalone-script testing) rather than introducing
new techniques or citing new literature, unlike Sub-projects A and B.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

console.log("Testing computeAdminDashboardRange (admin-order-totals.ts, real exported function)...");

// Fixed reference date used for every scenario below so the test is
// deterministic regardless of when it's actually run (not tied to wall-clock
// "now"). Falls in August 2026, matching the synthetic order dates.
const REFERENCE_DATE = new Date("2026-08-15T12:00:00Z");

const { computeAdminDashboardRange, getAdminReportOrders, getAdminOrdersMetricLabel } =
  await importDataUrlModule("../src/lib/admin-order-totals.ts");

function makeOrder(orderedAt) {
  return {
    id: "x",
    ordered_at: orderedAt,
    total_amount: 100,
    payment_method: "cash",
    payment_status: "paid",
    status: "delivered",
    order_type: "delivery",
  };
}

// Scenario 1: the reference "current" month (August 2026) has NO orders
// among the synthetic set (only May orders exist) -> must fall back to a
// custom range covering May 2026, the month of the most recent order. This
// reproduces the exact historical bug scenario: real data spanned only
// 2026-04-30..2026-05-31, and "now" being past May caused "month" to show 0.
{
  const validOrders = [
    makeOrder("2026-05-01T10:00:00Z"),
    makeOrder("2026-05-15T10:00:00Z"),
    makeOrder("2026-05-31T10:00:00Z"),
  ];

  const range = computeAdminDashboardRange(validOrders, REFERENCE_DATE);
  console.log("  Scenario 1 range:", JSON.stringify(range));
  assert.equal(range.timeFilter, "custom");
  assert.equal(range.customStartDate, "2026-05-01");
  assert.equal(range.customEndDate, "2026-05-31");

  const dashboardOrders = getAdminReportOrders(validOrders, {
    timeFilter: range.timeFilter,
    customStartDate: range.customStartDate,
    customEndDate: range.customEndDate,
  });
  console.log("  Scenario 1 dashboardOrders.length:", dashboardOrders.length);
  assert.equal(dashboardOrders.length, 3);

  const label = getAdminOrdersMetricLabel(range.timeFilter, range.customStartDate, range.customEndDate);
  console.log("  Scenario 1 label:", label);
  assert.equal(label, "May 1, 2026 - May 31, 2026 Orders");

  console.log("  PASS: empty current month falls back to most-recent-month-with-data as a custom range");
}

// Scenario 2: the reference "current" month (August 2026) has at least one
// order -> must stay on "month" (no fallback needed), matching what the live
// dev database looked like when this scenario was written (an order on
// 2026-08-03).
{
  const validOrders = [makeOrder("2026-08-03T14:00:00Z"), makeOrder("2026-05-01T10:00:00Z")];
  const range = computeAdminDashboardRange(validOrders, REFERENCE_DATE);
  console.log("  Scenario 2 range:", JSON.stringify(range));
  assert.equal(range.timeFilter, "month");
  assert.equal(range.customStartDate, undefined);
  assert.equal(range.customEndDate, undefined);
  console.log("  PASS: non-empty current month stays on \"month\", no fallback triggered");
}

// Scenario 3: no orders at all -> must not throw, safely defaults to "month".
{
  const range = computeAdminDashboardRange([]);
  console.log("  Scenario 3 range:", JSON.stringify(range));
  assert.equal(range.timeFilter, "month");
  assert.equal(range.customStartDate, undefined);
  assert.equal(range.customEndDate, undefined);
  console.log("  PASS: empty orders array does not throw, defaults to \"month\"");
}

console.log("\nAll checks passed.");

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

  // Revenue / cash-vs-online breakdown, hand-computed. The unpaid order
  // still appears in the finished-orders table (it's still a "finished"
  // order for record-keeping / cancelled-count purposes), but its amount
  // must not be counted in any of the revenue stat totals.
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
    const revenueBlock = html.split("Revenue Collected</div>")[1]?.slice(0, 60) ?? "";
    const cashBlock = html.split("Cash</div>")[1]?.slice(0, 60) ?? "";
    const onlineBlock = html.split("Online</div>")[1]?.slice(0, 60) ?? "";
    assert.ok(revenueBlock.includes("₱160"), "total revenue stat should be 160");
    assert.ok(cashBlock.includes("₱100"), "cash revenue stat should be 100");
    assert.ok(onlineBlock.includes("₱60"), "online revenue stat should be 60");
    assert.ok(
      !revenueBlock.includes("1000") && !revenueBlock.includes("1,000"),
      "unpaid order's total must not be counted in the revenue stat, even though it still appears in the finished-orders table"
    );
    console.log("  PASS: revenue and cash-vs-online stats exclude unpaid orders, even though unpaid orders can still appear in the table");
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

  // Regression test: a cancelled order is (by definition) never "paid", but
  // it must still be counted in the Cancelled stat -- finishedOrders itself
  // must not be filtered by payment status, only the revenue totals should be.
  {
    const cancelledOrder = makeOrder({
      id: "cancelled-order",
      status: "cancelled",
      payment_status: "unpaid",
      total_amount: 200,
    });
    const html = buildStaffSessionSummaryHtml({
      orders: [cancelledOrder],
      staffName: "Chrizelda",
      referenceDate,
    });
    const cancelledBlock = html.split("Cancelled</div>")[1]?.slice(0, 40) ?? "";
    assert.ok(cancelledBlock.includes(">1<"), "a cancelled order must still be counted in the Cancelled stat");
    console.log("  PASS: cancelled orders are counted in the Cancelled stat despite being unpaid");
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("\nAll staff-session-report.ts checks passed.");

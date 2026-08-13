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
          <h1>Daily Session Summary</h1>
          <p>Prepared by ${escapeHtml(staffName)} &middot; ${escapeHtml(dateLabel)}</p>
        </section>
        <div class="stats">
          <div class="stat"><div class="label">Orders Today</div><div class="value">${finishedOrders.length}</div></div>
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

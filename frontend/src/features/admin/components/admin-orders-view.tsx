"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Download } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  getAdminOrderTotals,
  type AdminPaymentFilter,
  type AdminStatusFilter,
  type AdminTypeFilter,
} from "@/lib/admin-order-totals";
import type { OrderStatus, StaffOrder } from "@/types/orders";

type DateRange = "today" | "yesterday" | "custom" | "all";

function peso(value: number) {
  return `\u20B1${Math.round(value).toLocaleString("en-PH")}`;
}

function formatOrderCode(id: string) {
  return `#KD-${id.slice(0, 4).toUpperCase()}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatus(status: OrderStatus) {
  switch (status) {
    case "pending_payment":
      return "Pending payment";
    case "out_for_delivery":
      return "Out for delivery";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function formatPaymentMethod(paymentMethod: StaffOrder["payment_method"]) {
  if (paymentMethod === "online") return "Online";
  if (paymentMethod === "gcash") return "GCash";
  if (paymentMethod === "cash") return "Cash";
  return "No method";
}

function formatPaymentStatus(paymentStatus: StaffOrder["payment_status"]) {
  if (paymentStatus === "paid") return "Paid";
  if (paymentStatus === "unpaid") return "Unpaid";
  return "No status";
}

function formatOrderTypeLabel(orderType: StaffOrder["order_type"]) {
  return orderType === "pickup" ? "Pickup" : "Delivery";
}

function formatNameFromEmail(email: string | null) {
  if (!email) return null;

  const name = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();

  if (!name) return null;

  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getOrderDisplayName(order: StaffOrder) {
  return (
    order.customer_profile?.full_name?.trim() ||
    order.walkin_name?.trim() ||
    formatNameFromEmail(order.customer_profile?.email ?? null) ||
    formatNameFromEmail(order.delivery_email) ||
    (order.order_type === "delivery" ? "Delivery Customer" : "Walk-in Customer")
  );
}

function formatOrderItems(order: StaffOrder) {
  return order.order_items
    .map((item) => `${item.menu_items?.name ?? "Menu item"} x ${item.quantity}`)
    .join(", ");
}

function getContactEmail(order: StaffOrder) {
  return order.customer_profile?.email || order.delivery_email || "";
}

function getContactPhone(order: StaffOrder) {
  return order.customer_profile?.phone || order.delivery_phone || "";
}

function getEncodedByName(order: StaffOrder) {
  return (
    order.encoded_by_profile?.full_name?.trim() ||
    formatNameFromEmail(order.encoded_by_profile?.email ?? null) ||
    (order.customer_id ? "Customer self-order" : "Staff POS")
  );
}

function getManilaDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatDateKeyLabel(value: string) {
  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getDateRangeLabel(dateRange: DateRange, customFrom: string, customTo: string) {
  if (dateRange === "today") {
    return formatDateKeyLabel(getManilaDateKey(new Date()));
  }

  if (dateRange === "yesterday") {
    const today = new Date(`${getManilaDateKey(new Date())}T00:00:00+08:00`);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return formatDateKeyLabel(getManilaDateKey(yesterday));
  }

  if (dateRange === "custom") {
    if (!customFrom || !customTo) return "Custom range";
    return `${formatDateKeyLabel(customFrom)} - ${formatDateKeyLabel(customTo)}`;
  }

  return "All time";
}

function csvCell(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

function getExportRows(orders: StaffOrder[]) {
  return orders.map((order) => ({
    order_id: order.id,
    order_code: formatOrderCode(order.id),
    customer_name: getOrderDisplayName(order),
    customer_email: getContactEmail(order),
    customer_phone: getContactPhone(order),
    order_type: order.order_type,
    status: order.status,
    payment_method: order.payment_method ?? "",
    payment_status: order.payment_status ?? "",
    items_array: JSON.stringify(
      order.order_items.map((item) => ({
        name: item.menu_items?.name ?? "Menu item",
        quantity: item.quantity,
        unit_price: item.unit_price,
        size: item.size,
        temperature: item.temperature,
        addons: item.addons ?? [],
        special_instructions: item.special_instructions ?? "",
      }))
    ),
    total_amount: order.total_amount,
    delivery_fee: order.delivery_fee ?? 0,
    delivery_address: order.delivery_address ?? "",
    delivery_lat: order.delivery_lat ?? "",
    delivery_lng: order.delivery_lng ?? "",
    created_at: order.ordered_at,
  }));
}

function downloadCsv(orders: StaffOrder[], dateRange: DateRange) {
  const rows = getExportRows(orders);
  const columns = Object.keys(rows[0] ?? {
    order_id: "",
    order_code: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    order_type: "",
    status: "",
    payment_method: "",
    payment_status: "",
    items_array: "",
    total_amount: "",
    delivery_fee: "",
    delivery_address: "",
    delivery_lat: "",
    delivery_lng: "",
    created_at: "",
  });
  const csv = [
    columns.map(csvCell).join(","),
    ...rows.map((row) =>
      columns.map((column) => csvCell(row[column as keyof typeof row])).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kadaserve-orders-${dateRange}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPdfReportHtml(
  orders: StaffOrder[],
  dateRange: DateRange,
  rangeLabel: string
) {
  const revenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
  return `
    <!doctype html>
    <html>
      <head>
        <title>KadaServe Sales Report</title>
        <style>
          body { color: #0D2E18; font-family: Arial, Helvetica, sans-serif; margin: 32px; }
          .brand { color: #0D2E18; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin-bottom: 18px; }
          .summary { border-bottom: 2px solid #684B35; margin-bottom: 20px; padding-bottom: 14px; }
          .summary h1 { font-size: 20px; margin: 0 0 8px; }
          .summary p { color: #684B35; font-size: 13px; margin: 0; }
          table { border-collapse: collapse; font-size: 11px; width: 100%; }
          th { background: #FFF0DA; color: #0D2E18; text-align: left; }
          th, td { border-bottom: 1px solid #E7D7BC; padding: 9px 7px; vertical-align: top; }
          .money { font-weight: 700; text-align: right; white-space: nowrap; }
          @media print { body { margin: 18px; } }
        </style>
      </head>
      <body>
        <div class="brand">KadaServe</div>
        <section class="summary">
          <h1>Sales Report: ${escapeHtml(rangeLabel)}</h1>
          <p>Total Orders: ${orders.length} | Revenue: ${escapeHtml(peso(revenue))} | Filter: ${escapeHtml(dateRange)}</p>
        </section>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Type</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Total</th>
              <th>Date / Time</th>
            </tr>
          </thead>
          <tbody>
            ${orders
              .map(
                (order) => `
                  <tr>
                    <td>${escapeHtml(formatOrderCode(order.id))}</td>
                    <td>${escapeHtml(getOrderDisplayName(order))}</td>
                    <td>${escapeHtml(formatOrderItems(order) || "No items")}</td>
                    <td>${escapeHtml(formatOrderTypeLabel(order.order_type))}</td>
                    <td>${escapeHtml(`${formatPaymentMethod(order.payment_method)} / ${formatPaymentStatus(order.payment_status)}`)}</td>
                    <td>${escapeHtml(formatStatus(order.status))}</td>
                    <td class="money">${escapeHtml(peso(order.total_amount))}</td>
                    <td>${escapeHtml(`${formatDate(order.ordered_at)} ${formatTime(order.ordered_at)}`)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
        <script>
          window.onload = () => {
            window.print();
          };
        </script>
      </body>
    </html>
  `;
}

function downloadPrintableReport(html: string, dateRange: DateRange) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kadaserve-sales-report-${dateRange}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openPdfReport(
  orders: StaffOrder[],
  dateRange: DateRange,
  rangeLabel: string
) {
  const html = buildPdfReportHtml(orders, dateRange, rangeLabel);
  const reportWindow = window.open("", "_blank");

  if (!reportWindow) {
    downloadPrintableReport(html, dateRange);
    return;
  }

  reportWindow.document.write(html);
  reportWindow.document.close();
}

function getOrderTypeStyle(orderType: StaffOrder["order_type"]) {
  return orderType === "pickup"
    ? "border border-[#DCCFB8] bg-[#FFF8EF] text-[#684B35]"
    : "border border-[#DCCFB8] bg-[#FFF8EF] text-[#684B35]";
}

function getPaymentStyle(paymentMethod: StaffOrder["payment_method"]) {
  return paymentMethod === "gcash"
    ? "border border-[#DCCFB8] bg-[#FFF8EF] text-[#684B35]"
    : "border border-[#DCCFB8] bg-[#FFF8EF] text-[#684B35]";
}

function getPaymentStatusStyle(paymentStatus: StaffOrder["payment_status"]) {
  return paymentStatus === "paid"
    ? "border border-[#0F441D]/15 bg-[#E6F2E8] text-[#0F441D]"
    : "border border-[#C55432]/15 bg-[#FFF1EC] text-[#C55432]";
}

function getStatusStyle(status: OrderStatus) {
  switch (status) {
    case "completed":
    case "delivered":
      return "border border-[#0F441D]/15 bg-[#E7F4EA] text-[#0F441D]";
    case "cancelled":
      return "border border-[#C55432]/15 bg-[#FFF1EC] text-[#C55432]";
    case "out_for_delivery":
      return "border border-[#684B35]/20 bg-[#FFF0DA] text-[#684B35]";
    case "ready":
      return "border border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35]";
    default:
      return "border border-[#D6C6AC] bg-transparent text-[#684B35]";
  }
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-8 text-center font-sans text-sm text-[#8C7A64]">
      {label}
    </div>
  );
}

export function OrdersView({
  filteredOrders,
  onOpenOrder,
}: {
  filteredOrders: StaffOrder[];
  onOpenOrder: (order: StaffOrder) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | StaffOrder["order_type"]>(
    "all"
  );
  const [paymentFilter, setPaymentFilter] = useState<
    "all" | "paid" | "unpaid" | "cash" | "gcash" | "online"
  >("all");
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [customFrom, setCustomFrom] = useState(getManilaDateKey(new Date()));
  const [customTo, setCustomTo] = useState(getManilaDateKey(new Date()));
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);

  const visibleOrders = useMemo(() => {
    const todayKey = getManilaDateKey(new Date());
    const yesterdayDate = new Date(`${todayKey}T00:00:00+08:00`);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = getManilaDateKey(yesterdayDate);

    const scopedOrders = filteredOrders.filter((order) => {
      const orderKey = getManilaDateKey(new Date(order.ordered_at));

      if (dateRange === "today") return orderKey === todayKey;
      if (dateRange === "yesterday") return orderKey === yesterdayKey;
      if (dateRange === "custom") {
        if (!customFrom || !customTo) return false;
        return orderKey >= customFrom && orderKey <= customTo;
      }

      return true;
    });

    return scopedOrders.filter((order) => {
      const matchesStatus: boolean =
        statusFilter === "all"
          ? order.status !== "cancelled"
          : order.status === statusFilter;
      const matchesType: boolean =
        typeFilter === "all" || order.order_type === typeFilter;
      const matchesPayment: boolean =
        paymentFilter === "all" ||
        order.payment_status === paymentFilter ||
        order.payment_method === paymentFilter;

      return matchesStatus && matchesType && matchesPayment;
    });
  }, [
    customFrom,
    customTo,
    dateRange,
    filteredOrders,
    paymentFilter,
    statusFilter,
    typeFilter,
  ]);

  const visibleTotals = useMemo(
    () => getAdminOrderTotals(visibleOrders),
    [visibleOrders]
  );

  const statusOptions: Array<{ value: AdminStatusFilter; label: string }> = [
    { value: "all", label: "All Active" },
    { value: "pending", label: "Pending" },
    { value: "preparing", label: "Preparing" },
    { value: "ready", label: "Ready" },
    { value: "out_for_delivery", label: "Out for Delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const typeOptions: Array<{ value: AdminTypeFilter; label: string }> = [
    { value: "all", label: "All Types" },
    { value: "pickup", label: "Pickup" },
    { value: "delivery", label: "Delivery" },
  ];

  const paymentOptions: Array<{ value: AdminPaymentFilter; label: string }> = [
    { value: "all", label: "All Payments" },
    { value: "paid", label: "Paid" },
    { value: "unpaid", label: "Unpaid" },
    { value: "cash", label: "Cash" },
    { value: "gcash", label: "GCash" },
    { value: "online", label: "Online" },
  ];

  return (
    <div className="space-y-4">
      {/* Controls Section */}
      <div className="rounded-[24px] border border-[#D8C8AA]/60 bg-[#FFFCF7] p-5">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.08em] text-[#8C7A64]">
                ORDER RECORDS
              </p>
              <p className="mt-1.5 font-sans text-sm font-medium text-[#684B35]">
                {getDateRangeLabel(dateRange, customFrom, customTo)} · Showing {visibleTotals.totalOrders} orders · {peso(visibleTotals.totalRevenue)}
              </p>
            </div>
            
            {/* Export Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportOpen((current) => !current)}
                disabled={isExportingReport}
                className="inline-flex items-center gap-2 rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-4 py-2 font-sans text-sm font-medium text-[#0D2E18] transition hover:bg-[#FFF1EC]"
              >
                {isExportingReport ? (
                  <LoadingSpinner label="Generating report" />
                ) : (
                  <Download size={16} />
                )}
                {isExportingReport ? "Generating..." : "Export"}
              </button>

              {isExportOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-[16px] border border-[#D8C8AA] bg-[#FFFCF7] p-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportingReport(true);
                      openPdfReport(
                        visibleOrders,
                        dateRange,
                        getDateRangeLabel(dateRange, customFrom, customTo)
                      );
                      setIsExportOpen(false);
                      window.setTimeout(() => setIsExportingReport(false), 450);
                    }}
                    className="w-full rounded-[12px] px-3 py-2.5 text-left font-sans text-sm font-semibold text-[#0D2E18] transition hover:bg-[#FFF0DA]"
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportingReport(true);
                      downloadCsv(visibleOrders, dateRange);
                      setIsExportOpen(false);
                      window.setTimeout(() => setIsExportingReport(false), 450);
                    }}
                    className="w-full rounded-[12px] px-3 py-2.5 text-left font-sans text-sm font-semibold text-[#0D2E18] transition hover:bg-[#FFF0DA]"
                  >
                    Download CSV
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Time Period Filter */}
          <div className="flex flex-wrap gap-2">
            {(["today", "yesterday", "custom", "all"] as const).map((range) => {
              const label =
                range === "today"
                  ? "Today"
                  : range === "yesterday"
                  ? "Yesterday"
                  : range === "custom"
                  ? "Custom"
                  : "All";

              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDateRange(range)}
                  className={`rounded-full px-4 py-1.5 font-sans text-sm font-medium transition ${
                    dateRange === range
                      ? "bg-[#0D2E18] text-[#FFF8EF]"
                      : "border border-[#DCCFB8] bg-transparent text-[#8C7A64] hover:bg-[#FFF8EF]"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {range === "custom" ? <CalendarDays size={15} /> : null}
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {dateRange === "custom" ? (
            <div className="flex flex-wrap gap-3">
              <label className="block">
                <span className="font-sans text-xs text-[#8C7A64]">From</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="mt-2 h-10 rounded-xl border border-[#DCCFB8] bg-white px-3.5 font-sans text-sm text-[#0D2E18] outline-none transition hover:border-[#D8C8AA] focus:border-[#0D2E18] focus:ring-1 focus:ring-[#0D2E18]/20"
                />
              </label>
              <label className="block">
                <span className="font-sans text-xs text-[#8C7A64]">To</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="mt-2 h-10 rounded-xl border border-[#DCCFB8] bg-white px-3.5 font-sans text-sm text-[#0D2E18] outline-none transition hover:border-[#D8C8AA] focus:border-[#0D2E18] focus:ring-1 focus:ring-[#0D2E18]/20"
                />
              </label>
            </div>
          ) : null}

          {/* Filter Dropdowns */}
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="font-sans text-xs text-[#8C7A64]">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | OrderStatus)
                }
                className="mt-2 h-10 w-full rounded-xl border border-[#DCCFB8] bg-white px-3.5 font-sans text-sm text-[#0D2E18] outline-none transition hover:border-[#D8C8AA] focus:border-[#0D2E18] focus:ring-1 focus:ring-[#0D2E18]/20"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            
            <label className="block">
              <span className="font-sans text-xs text-[#8C7A64]">
                Type
              </span>
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as "all" | StaffOrder["order_type"])
                }
                className="mt-2 h-10 w-full rounded-xl border border-[#DCCFB8] bg-white px-3.5 font-sans text-sm text-[#0D2E18] outline-none transition hover:border-[#D8C8AA] focus:border-[#0D2E18] focus:ring-1 focus:ring-[#0D2E18]/20"
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            
            <label className="block">
              <span className="font-sans text-xs text-[#8C7A64]">
                Payment
              </span>
              <select
                value={paymentFilter}
                onChange={(event) =>
                  setPaymentFilter(
                    event.target.value as "all" | "paid" | "unpaid" | "cash" | "gcash"
                  )
                }
                className="mt-2 h-10 w-full rounded-xl border border-[#DCCFB8] bg-white px-3.5 font-sans text-sm text-[#0D2E18] outline-none transition hover:border-[#D8C8AA] focus:border-[#0D2E18] focus:ring-1 focus:ring-[#0D2E18]/20"
              >
                {paymentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Data Table Card */}
      <div className="overflow-hidden rounded-[24px] border border-[#D8C8AA]/60 bg-[#FFFCF7]">
        {/* Table Header */}
        <div className="grid grid-cols-[110px_1.5fr_120px_105px_1.1fr_1fr_95px_90px_52px] gap-4 border-b border-[#D8C8AA]/70 px-6 py-4 font-sans text-xs font-medium text-[#8C7A64]">
          <span>Order</span>
          <span>Customer</span>
          <span>Encoded by</span>
          <span>Type</span>
          <span>Payment</span>
          <span>Status</span>
          <span>Total</span>
          <span>Time</span>
          <span />
        </div>

        {/* Table Rows */}
        <div>
          {visibleOrders.map((order, idx) => (
            <div
              key={order.id}
              className={`group grid grid-cols-[110px_1.5fr_120px_105px_1.1fr_1fr_95px_90px_52px] items-start gap-4 border-b border-[#D8C8AA]/70 px-6 py-4 font-sans text-sm transition hover:bg-[#FFF8EF] ${
                idx % 2 === 0 ? "bg-white/40" : ""
              }`}
            >
              <span className="font-mono text-sm font-semibold text-[#0D2E18]">
                {formatOrderCode(order.id)}
              </span>
              
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#0D2E18] truncate">
                  {getOrderDisplayName(order)}
                </p>
                <p className="mt-0.5 line-clamp-2 font-normal text-xs text-[#8C7A64]">
                  {formatOrderItems(order) || "No items"}
                </p>
              </div>
              
              <span className="text-xs text-[#8C7A64]">
                {getEncodedByName(order)}
              </span>
              
              <span
                className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${getOrderTypeStyle(
                  order.order_type
                )}`}
              >
                {formatOrderTypeLabel(order.order_type)}
              </span>
              
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentStyle(
                    order.payment_method
                  )}`}
                >
                  {formatPaymentMethod(order.payment_method)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentStatusStyle(
                    order.payment_status
                  )}`}
                >
                  {formatPaymentStatus(order.payment_status)}
                </span>
              </div>
              
              <span
                className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusStyle(
                  order.status
                )}`}
              >
                {formatStatus(order.status)}
              </span>
              
              <span className="font-mono text-sm text-[#0D2E18]">
                {peso(order.total_amount)}
              </span>
              
              <span className="text-xs text-[#8C7A64]">
                {formatTime(order.ordered_at)}
              </span>
              
              <button
                type="button"
                onClick={() => onOpenOrder(order)}
                aria-label={`View ${formatOrderCode(order.id)}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#684B35] transition hover:bg-[#FFF0DA] hover:text-[#0D2E18]"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          ))}
          
          {visibleOrders.length === 0 ? (
            <div className="px-6 py-8">
              <EmptyState label="No orders found matching your filters" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

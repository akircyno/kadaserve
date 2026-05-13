"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Download,
  Search,
  SlidersHorizontal,
  PackageCheck,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  getAdminOrderTotals,
  getAdminReportOrders,
  getAdminReportRangeLabel,
  type AdminTimeFilter,
} from "@/lib/admin-order-totals";
import type { OrderStatus, StaffOrder } from "@/types/orders";

type TimeFilter = AdminTimeFilter;

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

function getTimeFilterLabel(timeFilter: TimeFilter) {
  switch (timeFilter) {
    case "today":
      return "Today";
    case "week":
      return "This Week";
    case "month":
      return "This Month";
    case "year":
      return "This Year";
  }
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

function downloadCsv(orders: StaffOrder[], timeFilter: TimeFilter) {
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
  link.download = `kadaserve-orders-${timeFilter}.csv`;
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

function buildPdfReportHtml(orders: StaffOrder[], timeFilter: TimeFilter) {
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
          <h1>Sales Report: ${escapeHtml(getAdminReportRangeLabel(timeFilter))}</h1>
          <p>Total Orders: ${orders.length} | Revenue: ${escapeHtml(peso(revenue))} | Filter: ${escapeHtml(getTimeFilterLabel(timeFilter))}</p>
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

function downloadPrintableReport(html: string, timeFilter: TimeFilter) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kadaserve-sales-report-${timeFilter}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openPdfReport(orders: StaffOrder[], timeFilter: TimeFilter) {
  const html = buildPdfReportHtml(orders, timeFilter);
  const reportWindow = window.open("", "_blank");

  if (!reportWindow) {
    downloadPrintableReport(html, timeFilter);
    return;
  }

  reportWindow.document.write(html);
  reportWindow.document.close();
}

function getOrderTypeStyle(orderType: StaffOrder["order_type"]) {
  return orderType === "pickup"
    ? "border border-[#D6C6AC]/70 bg-transparent text-[#684B35]"
    : "border border-[#D6C6AC]/70 bg-transparent text-[#684B35]";
}

function getPaymentStyle(paymentMethod: StaffOrder["payment_method"]) {
  return paymentMethod === "gcash"
    ? "border border-[#D6C6AC]/70 bg-transparent text-[#684B35]"
    : "border border-[#D6C6AC]/70 bg-transparent text-[#684B35]";
}

function getPaymentStatusStyle(paymentStatus: StaffOrder["payment_status"]) {
  return paymentStatus === "paid"
    ? "border border-[#0F441D]/15 bg-[#E7F4EA] text-[#0F441D]"
    : "border border-[#684B35] bg-[#684B35] text-[#FFF0DA]";
}

function getStatusStyle(status: OrderStatus) {
  switch (status) {
    case "completed":
    case "delivered":
      return "border border-[#0F441D]/15 bg-[#E7F4EA] text-[#0F441D]";
    case "cancelled":
    case "expired":
      return "border border-[#C55432]/15 bg-[#FFF1EC] text-[#C55432]";
    case "out_for_delivery":
      return "border border-[#684B35]/20 bg-[#FFF0DA] text-[#684B35]";
    case "ready":
      return "border border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35]";
    default:
      return "border border-[#D6C6AC] bg-transparent text-[#684B35]";
  }
}

function getStatusDotStyle(status: OrderStatus) {
  switch (status) {
    case "completed":
    case "delivered":
      return "bg-[#0F441D]";
    case "cancelled":
    case "expired":
      return "bg-[#C55432]";
    case "out_for_delivery":
      return "bg-[#684B35]";
    case "ready":
      return "bg-[#7D6B55]";
    default:
      return "bg-[#D6C6AC]";
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
    "all" | "paid" | "unpaid" | "cash" | "gcash"
  >("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");
  const [orderSearch, setOrderSearch] = useState("");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);

  const reportOrders = useMemo(() => {
    return getAdminReportOrders(filteredOrders, {
      paymentFilter,
      statusFilter,
      timeFilter,
      typeFilter,
    });
  }, [filteredOrders, paymentFilter, statusFilter, timeFilter, typeFilter]);

  const visibleOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();

    if (!query) return reportOrders;

    return reportOrders.filter((order) => {
      const searchable = [
        formatOrderCode(order.id),
        getOrderDisplayName(order),
        getEncodedByName(order),
        getContactEmail(order),
        getContactPhone(order),
        formatOrderItems(order),
        formatStatus(order.status),
        formatOrderTypeLabel(order.order_type),
        formatPaymentMethod(order.payment_method),
        formatPaymentStatus(order.payment_status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [orderSearch, reportOrders]);

  const visibleTotals = useMemo(
    () => getAdminOrderTotals(visibleOrders),
    [visibleOrders]
  );
  const completedCount = visibleOrders.filter((order) =>
    ["completed", "delivered"].includes(order.status)
  ).length;
  const expiredCount = visibleOrders.filter(
    (order) => order.status === "expired"
  ).length;
  const pickupCount = visibleOrders.filter(
    (order) => order.order_type === "pickup"
  ).length;
  const deliveryCount = visibleOrders.length - pickupCount;
  const paidCount = visibleOrders.filter(
    (order) => order.payment_status === "paid"
  ).length;
  const attentionCount = visibleOrders.filter((order) =>
    ["pending", "preparing", "ready", "out_for_delivery", "pending_payment"].includes(
      order.status
    )
  ).length;
  const avgOrderValue = visibleOrders.length
    ? Math.round(visibleTotals.totalRevenue / visibleOrders.length)
    : 0;
  const demandCards = [
    {
      icon: ReceiptText,
      label: "Orders",
      value: String(visibleTotals.totalOrders),
      detail: getAdminReportRangeLabel(timeFilter),
    },
    {
      icon: WalletCards,
      label: "Gross Sales",
      value: peso(visibleTotals.totalRevenue),
      detail: `${paidCount} paid orders`,
    },
    {
      icon: PackageCheck,
      label: "Fulfilled",
      value: String(completedCount),
      detail: expiredCount ? `${expiredCount} expired` : "No expired orders",
    },
    {
      icon: CalendarDays,
      label: "Order Mix",
      value: `${pickupCount}/${deliveryCount}`,
      detail: "Pickup / Delivery",
    },
  ];
  const statusSummary = [
    {
      label: "Needs Action",
      value: attentionCount,
      className: "border-[#DCCFB8] bg-[#FFF0DA] text-[#684B35]",
    },
    {
      label: "Completed",
      value: completedCount,
      className: "border-[#0F441D]/15 bg-[#E6F2E8] text-[#0F441D]",
    },
    {
      label: "Expired",
      value: expiredCount,
      className: "border-[#C55432]/15 bg-[#FFF1EC] text-[#C55432]",
    },
    {
      label: "AOV",
      value: peso(avgOrderValue),
      className: "border-[#DCCFB8] bg-white text-[#0D2E18]",
    },
  ];

  const statusOptions: Array<{ value: "all" | OrderStatus; label: string }> = [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "preparing", label: "Preparing" },
    { value: "ready", label: "Ready" },
    { value: "out_for_delivery", label: "Out for Delivery" },
    { value: "expired", label: "Expired" },
    { value: "delivered", label: "Delivered" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const typeOptions: Array<{
    value: "all" | StaffOrder["order_type"];
    label: string;
  }> = [
    { value: "all", label: "All Types" },
    { value: "pickup", label: "Pickup" },
    { value: "delivery", label: "Delivery" },
  ];

  const paymentOptions: Array<{
    value: "all" | "paid" | "unpaid" | "cash" | "gcash";
    label: string;
  }> = [
    { value: "all", label: "All Payments" },
    { value: "paid", label: "Paid" },
    { value: "unpaid", label: "Unpaid" },
    { value: "cash", label: "Cash" },
    { value: "gcash", label: "GCash" },
  ];

  const timeOptions: Array<{ value: TimeFilter; label: string }> = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "year", label: "This Year" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[#DCCFB8] bg-[#FFFCF7] p-4 shadow-[0_12px_30px_rgba(75,50,24,0.08)] sm:p-5">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
                Demand Ledger
              </p>
              <h3 className="mt-1 font-sans text-2xl font-bold text-[#0D2E18]">
                {getAdminReportRangeLabel(timeFilter)}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {statusSummary.map((item) => (
                  <span
                    key={item.label}
                    className={`rounded-full border px-3 py-1.5 font-sans text-xs font-bold ${item.className}`}
                  >
                    {item.label}: {item.value}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 xl:max-w-[640px]">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative flex-1">
                  <span className="sr-only">Search demand orders</span>
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8C7A64]"
                    size={17}
                  />
                  <input
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                    placeholder="Search order, customer, item..."
                    className="h-11 w-full rounded-full border border-[#DCCFB8] bg-white pl-11 pr-4 font-sans text-sm font-semibold text-[#0D2E18] outline-none transition placeholder:text-[#8C7A64] hover:border-[#D6C6AC] focus:border-[#0D2E18] focus:ring-2 focus:ring-[#0D2E18]/10"
                  />
                </label>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsExportOpen((current) => !current)}
                    disabled={isExportingReport}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0D2E18] px-5 font-sans text-sm font-bold text-[#FFF8EF] transition hover:bg-[#0F441D] hover:shadow-[0_8px_20px_rgba(13,46,24,0.2)] sm:w-auto"
                  >
                    {isExportingReport ? (
                      <LoadingSpinner label="Generating report" />
                    ) : (
                      <Download size={16} />
                    )}
                    {isExportingReport ? "Generating..." : "Export"}
                  </button>

                  {isExportOpen ? (
                    <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-[16px] border border-[#DCCFB8] bg-[#FFFCF7] p-2 shadow-[0_18px_45px_rgba(42,29,12,0.14)]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportingReport(true);
                          openPdfReport(visibleOrders, timeFilter);
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
                          downloadCsv(visibleOrders, timeFilter);
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

              <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-[#EFE3CF] bg-white px-3 py-2">
                <SlidersHorizontal size={15} className="text-[#7D6B55]" />
                <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                  Filters
                </span>
                <span className="rounded-full bg-[#FFF8EF] px-3 py-1 font-sans text-xs font-bold text-[#684B35]">
                  {getTimeFilterLabel(timeFilter)}
                </span>
                <span className="rounded-full bg-[#FFF8EF] px-3 py-1 font-sans text-xs font-bold text-[#684B35]">
                  {statusFilter === "all" ? "All statuses" : formatStatus(statusFilter)}
                </span>
                <span className="rounded-full bg-[#FFF8EF] px-3 py-1 font-sans text-xs font-bold text-[#684B35]">
                  {visibleOrders.length}/{reportOrders.length} shown
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {demandCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-[18px] border border-[#EFE3CF] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(75,50,24,0.04)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                      {card.label}
                    </p>
                    <Icon size={16} className="text-[#7D6B55]" />
                  </div>
                  <p className="mt-3 font-sans text-2xl font-bold text-[#0D2E18]">
                    {card.value}
                  </p>
                  <p className="mt-1 font-sans text-xs font-semibold text-[#8C7A64]">
                    {card.detail}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.95fr)]">
            <div>
              <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                Range
              </span>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-full border border-[#DCCFB8] bg-[#FFF8EF] p-1 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4">
                {timeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTimeFilter(option.value)}
                    className={`rounded-full px-3 py-2 font-sans text-xs font-bold transition ${
                      timeFilter === option.value
                        ? "bg-[#0D2E18] text-[#FFF8EF] shadow-[0_4px_12px_rgba(13,46,24,0.15)]"
                        : "text-[#684B35] hover:bg-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | OrderStatus)
                }
                className="mt-2 h-11 w-full rounded-[16px] border border-[#DCCFB8] bg-white px-3.5 font-sans text-sm font-semibold text-[#0D2E18] outline-none transition hover:border-[#D6C6AC] focus:border-[#0D2E18] focus:ring-1 focus:ring-[#0D2E18]/20"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            
            <label className="block">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                Type
              </span>
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as "all" | StaffOrder["order_type"])
                }
                className="mt-2 h-11 w-full rounded-[16px] border border-[#DCCFB8] bg-white px-3.5 font-sans text-sm font-semibold text-[#0D2E18] outline-none transition hover:border-[#D6C6AC] focus:border-[#0D2E18] focus:ring-1 focus:ring-[#0D2E18]/20"
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            
            <label className="block">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                Payment
              </span>
              <select
                value={paymentFilter}
                onChange={(event) =>
                  setPaymentFilter(
                    event.target.value as "all" | "paid" | "unpaid" | "cash" | "gcash"
                  )
                }
                className="mt-2 h-11 w-full rounded-[16px] border border-[#DCCFB8] bg-white px-3.5 font-sans text-sm font-semibold text-[#0D2E18] outline-none transition hover:border-[#D6C6AC] focus:border-[#0D2E18] focus:ring-1 focus:ring-[#0D2E18]/20"
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

      <div className="space-y-3 lg:hidden">
        {visibleOrders.map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => onOpenOrder(order)}
            className="w-full rounded-[22px] border border-[#DCCFB8] bg-[#FFFCF7] p-4 text-left font-sans shadow-[0_12px_28px_rgba(75,50,24,0.07)] transition hover:border-[#D6C6AC] hover:bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${getStatusDotStyle(
                      order.status
                    )}`}
                  />
                  <span className="font-bold text-[#0D2E18]">
                    {formatOrderCode(order.id)}
                  </span>
                </div>
                <p className="mt-1 truncate font-semibold text-[#0D2E18]">
                  {getOrderDisplayName(order)}
                </p>
              </div>
              <span className="shrink-0 font-bold text-[#0D2E18]">
                {peso(order.total_amount)}
              </span>
            </div>

            <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-[#8C7A64]">
              {formatOrderItems(order) || "No items"}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span
                className={`rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase ${getStatusStyle(
                  order.status
                )}`}
              >
                {formatStatus(order.status)}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase ${getOrderTypeStyle(
                  order.order_type
                )}`}
              >
                {formatOrderTypeLabel(order.order_type)}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${getPaymentStatusStyle(
                  order.payment_status
                )}`}
              >
                {formatPaymentStatus(order.payment_status)}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[#EFE3CF] pt-3 text-xs font-semibold text-[#8C7A64]">
              <span>{getEncodedByName(order)}</span>
              <span>
                {formatDate(order.ordered_at)} · {formatTime(order.ordered_at)}
              </span>
            </div>
          </button>
        ))}

        {visibleOrders.length === 0 ? (
          <EmptyState label="No orders found matching your filters" />
        ) : null}
      </div>

      <div className="hidden overflow-hidden rounded-[24px] border border-[#DCCFB8] bg-[#FFFCF7] shadow-[0_12px_30px_rgba(75,50,24,0.08)] lg:block">
        <div className="overflow-x-auto">
          <div className="grid min-w-[1080px] grid-cols-[112px_minmax(220px,1.35fr)_minmax(128px,0.9fr)_94px_minmax(170px,1fr)_minmax(140px,0.9fr)_96px_96px_44px] gap-4 border-b border-[#EFE3CF] bg-[#FFF8EF] px-5 py-3 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
            <span>Order ID</span>
            <span>Customer / Items</span>
            <span>Encoded By</span>
            <span>Type</span>
            <span>Payment</span>
            <span>Status</span>
            <span>Total</span>
            <span>Date</span>
            <span></span>
          </div>

          <div className="min-w-[1080px] divide-y divide-[#EFE3CF]">
            {visibleOrders.map((order, idx) => (
              <div
                key={order.id}
                className={`group grid grid-cols-[112px_minmax(220px,1.35fr)_minmax(128px,0.9fr)_94px_minmax(170px,1fr)_minmax(140px,0.9fr)_96px_96px_44px] items-center gap-4 px-5 py-3.5 font-sans text-sm transition hover:bg-[#FFF8EF] ${
                  idx % 2 === 0 ? "bg-white/55" : "bg-[#FFFCF7]"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${getStatusDotStyle(
                        order.status
                      )}`}
                    />
                    <span className="font-bold text-[#0D2E18]">
                      {formatOrderCode(order.id)}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#8C7A64]">
                    {formatTime(order.ordered_at)}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#0D2E18]">
                    {getOrderDisplayName(order)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs font-normal leading-relaxed text-[#8C7A64]">
                    {formatOrderItems(order) || "No items"}
                  </p>
                </div>

                <span className="text-xs font-semibold leading-snug text-[#684B35]">
                  {getEncodedByName(order)}
                </span>

                <span
                  className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold uppercase ${getOrderTypeStyle(
                    order.order_type
                  )}`}
                >
                  {formatOrderTypeLabel(order.order_type)}
                </span>

                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${getPaymentStyle(
                      order.payment_method
                    )}`}
                  >
                    {formatPaymentMethod(order.payment_method)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${getPaymentStatusStyle(
                      order.payment_status
                    )}`}
                  >
                    {formatPaymentStatus(order.payment_status)}
                  </span>
                </div>

                <span
                  className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold uppercase ${getStatusStyle(
                    order.status
                  )}`}
                >
                  {formatStatus(order.status)}
                </span>

                <span className="font-bold text-[#0D2E18]">
                  {peso(order.total_amount)}
                </span>

                <span className="text-xs font-semibold leading-snug text-[#8C7A64]">
                  {formatDate(order.ordered_at)}
                </span>

                <button
                  type="button"
                  onClick={() => onOpenOrder(order)}
                  aria-label={`View ${formatOrderCode(order.id)}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#684B35] transition hover:bg-[#E6F2E8] hover:text-[#0D2E18] group-hover:bg-[#FFF0DA]/70"
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
    </div>
  );
}

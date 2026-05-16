"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import type { OrderStatus, StaffOrder } from "@/types/orders";

type DateRange = "today" | "yesterday" | "custom" | "all";

const pageSize = 40;

function manilaDate(offsetDays = 0) {
  const base = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function formatOrderCode(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function formatStatus(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "Pending";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready";
    case "out_for_delivery":
      return "Out for Delivery";
    case "delivered":
      return "Delivered";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

function getStatusStyle(status: OrderStatus) {
  switch (status) {
    case "delivered":
    case "out_for_delivery":
      return "bg-[#FFF0DA] text-[#684B35]";
    case "completed":
      return "bg-[#E6F2E8] text-[#0F441D]";
    case "cancelled":
      return "bg-[#FFF1EC] text-[#C55432]";
    case "expired":
      return "bg-[#FDE8E2] text-[#A6422A]";
    default:
      return "bg-[#F4EEE6] text-[#684B35]";
  }
}

function getExpiredOrderLabel(status: OrderStatus) {
  return status === "expired" ? "Auto-expired after 45m" : null;
}

function getCustomerName(order: StaffOrder) {
  return (
    order.walkin_name?.trim() ||
    order.customer_profile?.full_name?.trim() ||
    order.delivery_email ||
    order.customer_profile?.email ||
    "Customer"
  );
}

function getCustomerPhone(order: StaffOrder) {
  return order.delivery_phone || order.customer_profile?.phone || "No phone";
}

function getCustomerEmail(order: StaffOrder) {
  return order.delivery_email || order.customer_profile?.email || "No email";
}

function hasDeliveryPin(order: StaffOrder) {
  return (
    typeof order.delivery_lat === "number" &&
    typeof order.delivery_lng === "number"
  );
}

function buildOpenStreetMapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
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

function peso(value: number) {
  return `\u20B1${Math.round(value)}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPaymentMethodLabel(order: StaffOrder) {
  if (order.payment_method === "online") return "Online";
  if (order.payment_method === "gcash") return "GCash";
  if (order.payment_method === "cash") {
    return order.order_type === "delivery" ? "Cash on Delivery" : "Pay at Cafe";
  }
  return "Payment pending";
}

function getPaymentStatusLabel(order: StaffOrder) {
  if (order.status === "pending_payment") return "Awaiting Payment";
  return order.payment_status === "paid" ? "Paid" : "Unpaid";
}

function getDeliveryFee(order: StaffOrder) {
  return order.order_type === "delivery" ? Number(order.delivery_fee ?? 0) : 0;
}

function getHistoryGrandTotal(order: StaffOrder) {
  return Number(order.total_amount ?? 0);
}

function getHistoryOrderSubtotal(order: StaffOrder) {
  return Math.max(0, getHistoryGrandTotal(order) - getDeliveryFee(order));
}

function getSpecialRemarks(order: StaffOrder) {
  return order.order_items
    .map((item) => item.special_instructions?.trim())
    .filter((remark): remark is string => Boolean(remark));
}

export function StaffOrderHistory() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [customFrom, setCustomFrom] = useState(manilaDate());
  const [customTo, setCustomTo] = useState(manilaDate());
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);

  const visibleTotal = useMemo(
    () => orders.reduce((sum, order) => sum + order.total_amount, 0),
    [orders]
  );
  const completedCount = useMemo(
    () => orders.filter((order) => order.status === "completed" || order.status === "delivered").length,
    [orders]
  );
  const exceptionCount = useMemo(
    () => orders.filter((order) => order.status === "cancelled" || order.status === "expired").length,
    [orders]
  );
  const deliveryCount = useMemo(
    () => orders.filter((order) => order.order_type === "delivery").length,
    [orders]
  );

  const buildParams = useCallback(
    (nextPage: number, exportCsv = false) => {
      const params = new URLSearchParams({
        q: search.trim(),
        range: dateRange,
        page: String(nextPage),
        pageSize: String(pageSize),
      });

      if (dateRange === "custom") {
        params.set("from", customFrom);
        params.set("to", customTo);
      }

      if (exportCsv) {
        params.set("export", "csv");
      }

      return params;
    },
    [customFrom, customTo, dateRange, search]
  );

  const loadHistory = useCallback(
    async (nextPage = 0, mode: "replace" | "append" = "replace") => {
      if (dateRange === "custom" && (!customFrom || !customTo)) {
        return;
      }

      setError("");
      if (mode === "append") {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        const response = await fetch(
          `/api/staff/orders/history?${buildParams(nextPage).toString()}`
        );
        const result = await response.json();

        if (!response.ok) {
          setError(result.error || "Failed to load order history.");
          showToast({
            title: "History not loaded",
            description: result.error || "Failed to load order history.",
            variant: "error",
          });
          return;
        }

        setOrders((current) =>
          mode === "append" ? [...current, ...(result.orders ?? [])] : result.orders ?? []
        );
        setPage(result.page ?? nextPage);
        setTotalCount(result.count ?? 0);
        setHasMore(Boolean(result.hasMore));
      } catch {
        setError("Something went wrong while loading order history.");
        showToast({
          title: "History not loaded",
          description: "Something went wrong while loading order history.",
          variant: "error",
        });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [buildParams, customFrom, customTo, dateRange, showToast]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadHistory(0, "replace");
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [loadHistory]);

  async function handleDownloadCsv() {
    setIsExporting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/staff/orders/history?${buildParams(0, true).toString()}`
      );

      if (!response.ok) {
        const result = await response.json();
        setError(result.error || "Failed to export order history.");
        showToast({
          title: "Export failed",
          description: result.error || "Failed to export order history.",
          variant: "error",
        });
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kadaserve-order-history-${manilaDate()}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      showToast({
        title: "Export downloaded",
        description: "Order history CSV is ready.",
        variant: "success",
      });
    } catch {
      setError("Something went wrong while exporting order history.");
      showToast({
        title: "Export failed",
        description: "Something went wrong while exporting order history.",
        variant: "error",
      });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF0DA] text-[#0D2E18] lg:flex lg:h-[calc(100dvh-4.5rem)] lg:flex-col lg:overflow-hidden">
      <section className="flex-1 overflow-y-auto px-1 py-3 sm:px-2 lg:px-0">
        <div className="sticky top-0 z-20 border-b border-[#E6D7C0] bg-[#FFF0DA]/95 px-4 pb-3 pt-2 backdrop-blur sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#DCCFB8] bg-white px-4 shadow-[0_4px_12px_rgba(104,75,53,0.04)]">
                <span className="font-sans text-[10px] font-black uppercase tracking-[0.14em] text-[#8C7A64]">
                  Total Found
                </span>
                <span className="font-sans text-base font-black tabular-nums text-[#0D2E18]">
                  {totalCount}
                </span>
              </div>
              <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#DCCFB8] bg-white px-4 shadow-[0_4px_12px_rgba(104,75,53,0.04)]">
                <span className="font-sans text-[10px] font-black uppercase tracking-[0.14em] text-[#8C7A64]">
                  Shown
                </span>
                <span className="font-sans text-base font-black tabular-nums text-[#0D2E18]">
                  {orders.length}
                </span>
              </div>
              <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#DCCFB8] bg-white px-4 shadow-[0_4px_12px_rgba(104,75,53,0.04)]">
                <span className="font-sans text-[10px] font-black uppercase tracking-[0.14em] text-[#8C7A64]">
                  Total
                </span>
                <span className="font-sans text-base font-black tabular-nums text-[#684B35]">
                  {peso(visibleTotal)}
                </span>
              </div>
              <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#DCCFB8] bg-white px-4 shadow-[0_4px_12px_rgba(104,75,53,0.04)]">
                <span className="font-sans text-[10px] font-black uppercase tracking-[0.14em] text-[#8C7A64]">
                  Done
                </span>
                <span className="font-sans text-base font-black tabular-nums text-[#0F441D]">
                  {completedCount}
                </span>
              </div>
              <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#DCCFB8] bg-white px-4 shadow-[0_4px_12px_rgba(104,75,53,0.04)]">
                <span className="font-sans text-[10px] font-black uppercase tracking-[0.14em] text-[#8C7A64]">
                  Delivery
                </span>
                <span className="font-sans text-base font-black tabular-nums text-[#684B35]">
                  {deliveryCount}
                </span>
              </div>
              <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#DCCFB8] bg-white px-4 shadow-[0_4px_12px_rgba(104,75,53,0.04)]">
                <span className="font-sans text-[10px] font-black uppercase tracking-[0.14em] text-[#8C7A64]">
                  Exceptions
                </span>
                <span className="font-sans text-base font-black tabular-nums text-[#A6422A]">
                  {exceptionCount}
                </span>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="flex h-11 min-w-[17rem] flex-1 items-center gap-2 rounded-full border border-[#D6C6AC] bg-white px-4 shadow-[0_4px_12px_rgba(104,75,53,0.04)] xl:w-80 xl:flex-none">
                <Search size={16} className="shrink-0 text-[#8C7A64]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search order, customer, phone..."
                  className="min-w-0 flex-1 bg-transparent font-sans text-sm font-semibold text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                />
              </label>

              <button
                type="button"
                onClick={() => loadHistory(0, "replace")}
                disabled={isLoading}
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#D6C6AC] bg-white px-4 font-sans text-sm font-bold text-[#684B35] transition hover:border-[#0D2E18] disabled:opacity-60"
              >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "yesterday", "custom", "all"] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDateRange(range)}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 font-sans text-sm font-bold capitalize transition ${
                dateRange === range
                  ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                  : "border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] hover:border-[#0D2E18]"
              }`}
            >
              {range === "custom" ? <CalendarDays size={15} /> : null}
              {range}
            </button>
          ))}

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isExporting || orders.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#0D2E18] bg-[#0D2E18] px-4 font-sans text-sm font-bold text-[#FFF0DA] transition hover:bg-[#123821] disabled:cursor-not-allowed disabled:border-[#D6C6AC] disabled:bg-[#F7FBF5] disabled:text-[#8D9C87]"
          >
            <Download size={16} />
            {isExporting ? "Exporting..." : "CSV"}
          </button>
        </div>

        {dateRange === "custom" ? (
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="block">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                From
              </span>
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="mt-2 h-11 rounded-full border border-[#D6C6AC] bg-white px-4 font-sans text-sm font-semibold text-[#0D2E18] outline-none"
              />
            </label>

            <label className="block">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                To
              </span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="mt-2 h-11 rounded-full border border-[#D6C6AC] bg-white px-4 font-sans text-sm font-semibold text-[#0D2E18] outline-none"
              />
            </label>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-[16px] bg-[#FFF1EC] px-4 py-3 font-sans text-sm text-[#9C543D]">
            {error}
          </div>
        ) : null}

        <section className="mt-4 overflow-hidden rounded-[22px] border border-[#DCCFB8] bg-white shadow-[0_8px_20px_rgba(104,75,53,0.05)]">
          <div className="hidden grid-cols-[1.05fr_1.3fr_0.9fr_0.85fr_0.85fr] gap-3 border-b border-[#EFE3CF] bg-[#FFF8EF] px-4 py-3 font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35] lg:grid">
            <span>Order ID</span>
            <span>Customer</span>
            <span>Status</span>
            <span>Total</span>
            <span>Time</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-12 font-sans text-sm font-bold text-[#684B35]">
              <Loader2 size={18} className="animate-spin" />
              Loading order history
            </div>
          ) : null}

          {!isLoading && orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <SlidersHorizontal className="h-9 w-9 text-[#8C7A64]" />
              <p className="mt-3 font-sans text-lg font-bold text-[#0D2E18]">
                No orders match this view
              </p>
              <p className="mt-1 font-sans text-sm text-[#8C7A64]">
                Try another date range or search term.
              </p>
            </div>
          ) : null}

          {!isLoading
            ? orders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;

                return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className={`grid w-full gap-3 border-b border-[#EFE3CF] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#FFF8EF] lg:grid-cols-[1.05fr_1.3fr_0.9fr_0.85fr_0.85fr] lg:items-center ${
                    isSelected ? "bg-[#FBFFF7] shadow-[inset_4px_0_0_#0D2E18]" : ""
                  }`}
                >
                  <div>
                    <p className="font-sans text-sm font-bold tabular-nums text-[#0D2E18]">
                      {formatOrderCode(order.id)}
                    </p>
                    <p
                      className={`mt-1 w-fit rounded-full px-2 py-0.5 font-sans text-[11px] font-bold ${
                        order.order_type === "delivery"
                          ? "bg-[#FFF0DA] text-[#684B35]"
                          : "bg-[#E6F2E8] text-[#0D2E18]"
                      }`}
                    >
                      {order.order_type === "delivery" ? "Delivery" : "Pickup"}
                    </p>
                  </div>
                  <div>
                    <p className="font-sans text-sm text-[#0D2E18]">
                      {getCustomerName(order)}
                    </p>
                    <p className="mt-0.5 font-sans text-xs text-[#8C7A64]">
                      {getCustomerPhone(order)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`w-fit rounded-full px-2.5 py-1 font-sans text-xs font-bold ${getStatusStyle(
                        order.status
                      )}`}
                    >
                      {formatStatus(order.status)}
                    </span>
                    {getExpiredOrderLabel(order.status) ? (
                      <span className="w-fit rounded-full bg-[#FDE8E2] px-2.5 py-1 font-sans text-[11px] font-bold text-[#A6422A]">
                        {getExpiredOrderLabel(order.status)}
                      </span>
                    ) : null}
                  </div>
                  <p className="font-sans text-base font-bold tabular-nums text-[#684B35]">
                    {peso(order.total_amount)}
                  </p>
                  <div>
                    <p className="font-sans text-sm font-bold tabular-nums text-[#0D2E18]">
                      {formatTime(order.ordered_at)}
                    </p>
                    <p className="font-sans text-xs text-[#8C7A64]">
                      {formatDate(order.ordered_at)}
                    </p>
                  </div>
                </button>
                );
              })
            : null}
        </section>

        {hasMore ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => loadHistory(page + 1, "append")}
              disabled={isLoadingMore}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#D6C6AC] bg-white px-5 font-sans text-sm font-bold text-[#684B35] transition hover:border-[#0D2E18] disabled:opacity-60"
            >
              {isLoadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
              {isLoadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        ) : null}
        </div>
      </section>

      {selectedOrder ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-[#0D2E18]/35"
            onClick={() => setSelectedOrder(null)}
          />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col overflow-hidden bg-[#FFF8EF] shadow-[-18px_0_40px_rgba(13,46,24,0.18)] sm:rounded-l-[24px]">
            <div className="border-b border-[#DCCFB8] bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                  History Detail
                </p>
                <h2 className="mt-1 truncate font-sans text-3xl font-black text-[#0D2E18]">
                  {formatOrderCode(selectedOrder.id)}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1.5 font-sans text-xs font-black ${getStatusStyle(
                      selectedOrder.status
                    )}`}
                  >
                    {formatStatus(selectedOrder.status)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1.5 font-sans text-xs font-black ${
                      selectedOrder.order_type === "delivery"
                        ? "bg-[#FFF0DA] text-[#684B35]"
                        : "bg-[#E6F2E8] text-[#0D2E18]"
                    }`}
                  >
                    {selectedOrder.order_type === "delivery" ? "Delivery" : "Pickup"}
                  </span>
                  <span className="rounded-full bg-[#0D2E18] px-3 py-1.5 font-sans text-xs font-black text-[#FFF0DA]">
                    {peso(getHistoryGrandTotal(selectedOrder))}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D6C6AC] bg-[#FFF8EF] text-[#0D2E18] transition hover:bg-[#FFF0DA]"
                aria-label="Close order detail"
              >
                <X size={20} />
              </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <section className="rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                      Customer & Contact
                    </p>
                    <p className="mt-2 font-sans text-base font-bold text-[#0D2E18]">
                      {getCustomerName(selectedOrder)}
                    </p>
                    <div className="mt-2 grid gap-1 font-sans text-sm text-[#5F5346]">
                      <p>Phone: {getCustomerPhone(selectedOrder)}</p>
                      <p>Email: {getCustomerEmail(selectedOrder)}</p>
                      {selectedOrder.order_type === "delivery" ? (
                        <div>
                          <p>
                            Address:{" "}
                            {selectedOrder.delivery_address || "No address"}
                          </p>

                          {hasDeliveryPin(selectedOrder) ? (
                            <a
                              href={buildOpenStreetMapUrl(
                                selectedOrder.delivery_lat as number,
                                selectedOrder.delivery_lng as number
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-1.5 font-sans text-xs font-bold text-[#0D2E18] transition hover:bg-[#FFF0DA]"
                            >
                              <MapPin size={13} />
                              View pinned map
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <p className="mt-1 font-sans text-xs text-[#8C7A64]">
                              No map pin saved.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {getExpiredOrderLabel(selectedOrder.status) ? (
                    <p className="w-full rounded-xl border border-[#F2C8BD] bg-[#FFF1EC] px-3 py-2 font-sans text-sm font-semibold text-[#A6422A]">
                      {getExpiredOrderLabel(selectedOrder.status)}. This order was moved out of the active queue by the 45-minute pending expiry rule.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                    Payment
                  </p>
                  <p className="mt-2 font-sans text-sm font-semibold text-[#0D2E18]">
                    {getPaymentMethodLabel(selectedOrder)}
                  </p>
                  <p className="mt-1 font-sans text-sm text-[#5F5346]">
                    Status: {getPaymentStatusLabel(selectedOrder)}
                  </p>
                </div>

                <div className="rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                    Timestamp
                  </p>
                  <p className="mt-2 font-sans text-sm font-semibold tabular-nums text-[#0D2E18]">
                    {formatDateTime(selectedOrder.ordered_at)}
                  </p>
                  <p className="mt-1 font-sans text-sm text-[#5F5346]">
                    {selectedOrder.order_type === "delivery"
                      ? "Delivery"
                      : "Pickup"}
                  </p>
                </div>
              </section>

              <section className="rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                  Financial Summary
                </p>
                <div className="mt-3 space-y-2 font-sans text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-[#5F5346]">Order Price</span>
                    <span className="font-bold tabular-nums text-[#0D2E18]">
                      {peso(getHistoryOrderSubtotal(selectedOrder))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#5F5346]">Delivery Fee</span>
                    <span className="font-bold tabular-nums text-[#0D2E18]">
                      {peso(getDeliveryFee(selectedOrder))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-[#EFE3CF] pt-2">
                    <span className="font-bold text-[#684B35]">Final Total</span>
                    <span className="text-xl font-black tabular-nums text-[#684B35]">
                      {peso(getHistoryGrandTotal(selectedOrder))}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                  Order Items
                </p>
                <div className="mt-3 space-y-2">
                  {selectedOrder.order_items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[16px] border border-[#EFE3CF] bg-[#FFF8EF] px-3 py-2 font-sans text-sm text-[#3C332A]"
                    >
                      <div className="flex justify-between gap-3">
                        <p className="font-bold text-[#0D2E18]">
                          {item.menu_items?.name ?? "Menu item"} x{" "}
                          {item.quantity}
                        </p>
                        <p className="font-bold tabular-nums text-[#684B35]">
                          {peso(item.unit_price * item.quantity)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-[#5F5346]">
                        Size: {item.size} | Temp: {item.temperature} | Sugar:{" "}
                        {item.sugar_level}%
                        {item.ice_level ? ` | Ice: ${item.ice_level}` : ""}
                      </p>
                      {item.addons && item.addons.length > 0 ? (
                        <p className="mt-1 text-xs text-[#5F5346]">
                          Add-ons: {item.addons.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                  Special Remarks
                </p>
                <div className="mt-3 space-y-2">
                  {getSpecialRemarks(selectedOrder).length > 0 ? (
                    getSpecialRemarks(selectedOrder).map((remark) => (
                      <p
                        key={remark}
                        className="rounded-xl bg-[#FFF8EF] px-3 py-2 font-sans text-sm text-[#3C332A]"
                      >
                        {remark}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-xl bg-[#FFF8EF] px-3 py-2 font-sans text-sm text-[#8C7A64]">
                      No special remarks recorded.
                    </p>
                  )}
                </div>
              </section>

            </div>
          </aside>
        </>
      ) : null}
    </main>
  );
}


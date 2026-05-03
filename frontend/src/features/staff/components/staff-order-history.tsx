"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
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
    default:
      return "bg-[#F4EEE6] text-[#684B35]";
  }
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
  if (order.payment_method === "gcash") return "GCash";
  if (order.payment_method === "cash") return "Cash";
  return "Payment pending";
}

function getPaymentStatusLabel(order: StaffOrder) {
  return order.payment_status === "paid" ? "Paid" : "Unpaid";
}

function getDeliveryFee(order: StaffOrder) {
  return order.order_type === "delivery" ? 50 : 0;
}

function getHistoryGrandTotal(order: StaffOrder) {
  return order.total_amount + getDeliveryFee(order);
}

function getSpecialRemarks(order: StaffOrder) {
  return order.order_items
    .map((item) => item.special_instructions?.trim())
    .filter((remark): remark is string => Boolean(remark));
}

export function StaffOrderHistory() {
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
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [buildParams, customFrom, customTo, dateRange]
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
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kadaserve-order-history-${manilaDate()}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Something went wrong while exporting order history.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF0DA] text-[#0D2E18]">
      <header className="border-b border-[#DCCFB8] bg-white px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
              Staff Workspace
            </p>
            <h1 className="mt-1 font-sans text-4xl font-bold text-[#0D2E18]">
              Order History
            </h1>
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isExporting || orders.length === 0}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[#0D2E18] bg-[#0D2E18] px-4 font-sans text-sm font-bold text-[#FFF0DA] transition hover:bg-[#123821] disabled:cursor-not-allowed disabled:border-[#D6C6AC] disabled:bg-[#F7FBF5] disabled:text-[#8D9C87]"
          >
            <Download size={16} />
            {isExporting ? "Preparing..." : "Download CSV"}
          </button>
        </div>
      </header>

      <section className="px-5 py-5">
        <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-4 shadow-[0_8px_20px_rgba(104,75,53,0.05)]">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-end">
            <label className="block">
              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                Global Search
              </span>
              <span className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-[#D6C6AC] bg-[#FFF8EF] px-3">
                <Search size={16} className="text-[#8C7A64]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Order ID, customer name, phone number"
                  className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                />
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              {(["today", "yesterday", "custom", "all"] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDateRange(range)}
                  className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3 font-sans text-sm font-bold capitalize transition ${
                    dateRange === range
                      ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                      : "border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] hover:border-[#0D2E18]"
                  }`}
                >
                  {range === "custom" ? <CalendarDays size={15} /> : null}
                  {range}
                </button>
              ))}
            </div>
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
                  className="mt-2 h-11 rounded-xl border border-[#D6C6AC] bg-[#FFF8EF] px-3 font-sans text-sm text-[#0D2E18] outline-none"
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
                  className="mt-2 h-11 rounded-xl border border-[#D6C6AC] bg-[#FFF8EF] px-3 font-sans text-sm text-[#0D2E18] outline-none"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-4">
            <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#8C7A64]">
              Matching Orders
            </p>
            <p className="mt-1 font-sans text-3xl font-bold tabular-nums text-[#0D2E18]">
              {totalCount}
            </p>
          </div>
          <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-4">
            <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#8C7A64]">
              Loaded
            </p>
            <p className="mt-1 font-sans text-3xl font-bold tabular-nums text-[#0D2E18]">
              {orders.length}
            </p>
          </div>
          <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-4">
            <p className="font-sans text-xs uppercase tracking-[0.12em] text-[#8C7A64]">
              Loaded Total
            </p>
            <p className="mt-1 font-sans text-3xl font-bold tabular-nums text-[#684B35]">
              {peso(visibleTotal)}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-[16px] bg-[#FFF1EC] px-4 py-3 font-sans text-sm text-[#9C543D]">
            {error}
          </div>
        ) : null}

        <section className="mt-4 overflow-hidden rounded-[18px] border border-[#DCCFB8] bg-white shadow-[0_8px_20px_rgba(104,75,53,0.05)]">
          <div className="hidden grid-cols-[1.05fr_1.3fr_0.9fr_0.85fr_0.85fr_0.85fr] gap-3 border-b border-[#EFE3CF] bg-[#FFF8EF] px-4 py-3 font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35] lg:grid">
            <span>Order ID</span>
            <span>Customer</span>
            <span>Status</span>
            <span>Total</span>
            <span>Time</span>
            <span>Action</span>
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
            ? orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="grid w-full gap-3 border-b border-[#EFE3CF] px-4 py-3 text-left transition hover:bg-[#FFF8EF] lg:grid-cols-[1.05fr_1.3fr_0.9fr_0.85fr_0.85fr_0.85fr] lg:items-center"
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
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 font-sans text-xs font-bold ${getStatusStyle(
                      order.status
                    )}`}
                  >
                    {formatStatus(order.status)}
                  </span>
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
                  <span className="font-sans text-xs font-bold text-[#684B35]">
                    Details
                  </span>
                </button>
              ))
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
      </section>

      {selectedOrder ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-[#0D2E18]/35"
            onClick={() => setSelectedOrder(null)}
          />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-[#FFF8EF] shadow-[-18px_0_40px_rgba(13,46,24,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#DCCFB8] px-5 py-4">
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                  History Detail
                </p>
                <h2 className="mt-1 font-sans text-3xl font-bold text-[#0D2E18]">
                  {formatOrderCode(selectedOrder.id)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full bg-white p-2 text-[#0D2E18]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <section className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
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

                  <span
                    className={`rounded-full px-2.5 py-1 font-sans text-xs font-bold ${getStatusStyle(
                      selectedOrder.status
                    )}`}
                  >
                    {formatStatus(selectedOrder.status)}
                  </span>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
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

                <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
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

              <section className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                  Financial Summary
                </p>
                <div className="mt-3 space-y-2 font-sans text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-[#5F5346]">Order Price</span>
                    <span className="font-bold tabular-nums text-[#0D2E18]">
                      {peso(selectedOrder.total_amount)}
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
                    <span className="font-bold tabular-nums text-[#684B35]">
                      {peso(getHistoryGrandTotal(selectedOrder))}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                  Order Items
                </p>
                <div className="mt-3 space-y-2">
                  {selectedOrder.order_items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-[#FFF8EF] px-3 py-2 font-sans text-sm text-[#3C332A]"
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

              <section className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
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

              <section className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                  Voucher & Point Deductions
                </p>
                <p className="mt-3 rounded-xl bg-[#FFF8EF] px-3 py-2 font-sans text-sm text-[#8C7A64]">
                  No voucher or point deductions are recorded for this order.
                </p>
              </section>
            </div>
          </aside>
        </>
      ) : null}
    </main>
  );
}


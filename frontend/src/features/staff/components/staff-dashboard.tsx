"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, RefreshCw, Search, Truck, X } from "lucide-react";
import type { OrderStatus, StaffOrder } from "@/types/orders";

type OrderFilter = "all" | "pickup" | "delivery";

const fallbackOrders: StaffOrder[] = [];
const finalStatuses: OrderStatus[] = ["completed", "delivered", "cancelled"];


const boardColumns: Array<{
  key: OrderStatus;
  label: string;
}> = [
    { key: "pending", label: "Pending" },
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: "Ready" },
    { key: "out_for_delivery", label: "Out for Delivery" },
  ];

function formatOrderCode(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
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
    order.walkin_name?.trim() ||
    formatNameFromEmail(order.delivery_email) ||
    (order.order_type === "delivery" ? "Delivery Customer" : "Walk-in Customer")
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function peso(value: number) {
  return `\u20B1${Math.round(value)}`;
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

function getNextActionLabel(
  orderType: "pickup" | "delivery",
  status: OrderStatus
) {
  if (orderType === "pickup") {
    switch (status) {
      case "pending":
        return "Start Preparing";
      case "preparing":
        return "Mark Ready";
      case "ready":
        return "Complete";
      default:
        return null;
    }
  }

  switch (status) {
    case "pending":
      return "Start Preparing";
    case "preparing":
      return "Mark Ready";
    case "ready":
      return "Dispatch";
    case "out_for_delivery":
      return "Mark Delivered";
    default:
      return null;
  }
}

function getOrderTypeStyle(orderType: "pickup" | "delivery") {
  return orderType === "pickup"
    ? "bg-[#F1E3FF] text-[#7A3FB4]"
    : "bg-[#FFF0E5] text-[#B76522]";
}

function getPaymentStyle(paymentMethod: "cash" | "gcash") {
  return paymentMethod === "cash"
    ? "border border-[#0F441D]/20 bg-[#FFF8EF]/70 text-[#0F441D]"
    : "border border-[#684B35]/20 bg-[#FFF8EF]/70 text-[#684B35]";
}

function getPaymentStatusStyle(paymentStatus: "unpaid" | "paid") {
  return paymentStatus === "paid"
    ? "border border-[#0F441D]/20 bg-[#FFF8EF]/70 text-[#0F441D]"
    : "border border-[#B76522]/25 bg-[#FFF8EF]/70 text-[#B76522]";
}

function getStatusBadgeStyle(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "bg-[#EEF2F6] text-[#516274]";
    case "preparing":
      return "bg-[#E6F2E8] text-[#1E7A3D]";
    case "ready":
      return "bg-[#FFF0DA] text-[#684B35]";
    case "out_for_delivery":
      return "bg-[#FFF0E5] text-[#B76522]";
    case "completed":
      return "bg-[#E6F2E8] text-[#1E7A3D]";
    case "delivered":
      return "bg-[#E8F0FF] text-[#2454C5]";
    case "cancelled":
      return "bg-[#FFF1EC] text-[#C55432]";
    default:
      return "bg-[#F4EEE6] text-[#684B35]";
  }
}

function getColumnActionStyle(status: OrderStatus) {
  if (status === "ready" || status === "out_for_delivery") {
    return "bg-[#C96A12] hover:bg-[#B65D0D]";
  }

  return "bg-[#0D2E18] hover:bg-[#123821]";
}

function requiresPaymentBeforeNextAction(order: StaffOrder) {
  const nextAction = getNextActionLabel(order.order_type, order.status);

  return (
    order.payment_status === "unpaid" &&
    (nextAction === "Complete" || nextAction === "Mark Delivered")
  );
}

function formatOrderSummary(order: StaffOrder) {
  return order.order_items
    .map((item) => {
      const label = item.menu_items?.name ?? "Menu item";
      return `${label} x ${item.quantity}`;
    })
    .filter(Boolean);
}

function formatAddonLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getFinalStatusMessage(status: OrderStatus) {
  switch (status) {
    case "completed":
      return "This pickup order has been completed.";
    case "delivered":
      return "This delivery order has been delivered.";
    case "cancelled":
      return "This order has been cancelled.";
    default:
      return null;
  }
}

export function StaffDashboard() {
  const router = useRouter();

  const [orders, setOrders] = useState<StaffOrder[]>(fallbackOrders);
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<string[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const activeOrders = useMemo(() => {
    return orders.filter((order) => !finalStatuses.includes(order.status));
  }, [orders]);

  const historyOrders = useMemo(() => {
    return orders
      .filter((order) => finalStatuses.includes(order.status))
      .sort(
        (first, second) =>
          new Date(second.ordered_at).getTime() -
          new Date(first.ordered_at).getTime()
      )
      .slice(0, 8);
  }, [orders]);


  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return activeOrders.filter((order) => {
      const matchesType =
        orderFilter === "all" || order.order_type === orderFilter;

      const orderCode = formatOrderCode(order.id).toLowerCase();
      const itemNames = order.order_items
        .map((item) => item.menu_items?.name ?? "")
        .join(" ")
        .toLowerCase();
      const orderType = order.order_type.toLowerCase();
      const customerName = getOrderDisplayName(order).toLowerCase();

      const matchesSearch =
        !keyword ||
        orderCode.includes(keyword) ||
        itemNames.includes(keyword) ||
        orderType.includes(keyword) ||
        customerName.includes(keyword);

      return matchesType && matchesSearch;
    });
  }, [activeOrders, orderFilter, search]);

  const groupedOrders = useMemo(() => {
    return {
      pending: filteredOrders.filter((order) => order.status === "pending"),
      preparing: filteredOrders.filter((order) => order.status === "preparing"),
      ready: filteredOrders.filter((order) => order.status === "ready"),
      out_for_delivery: filteredOrders.filter(
        (order) => order.status === "out_for_delivery"
      ),
    };
  }, [filteredOrders]);

  const summary = useMemo(() => {
    return {
      pending: activeOrders.filter((order) => order.status === "pending").length,
      preparing: activeOrders.filter((order) => order.status === "preparing")
        .length,
      ready: activeOrders.filter((order) => order.status === "ready").length,
      outForDelivery: activeOrders.filter(
        (order) => order.status === "out_for_delivery"
      ).length,
    };
  }, [activeOrders]);

  useEffect(() => {
    loadOrders({ showLoading: true });
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadOrders({ showLoading: false });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  function openOrder(order: StaffOrder) {
    setSelectedOrder(order);
    setIsConfirmingCancel(false);
  }

  function closeOrder() {
    setSelectedOrder(null);
    setIsConfirmingCancel(false);
  }

  async function loadOrders({
    showLoading = true,
  }: {
    showLoading?: boolean;
  } = {}) {
    if (showLoading) {
      setIsLoading(true);
      setError("");
    }

    try {
      const response = await fetch("/api/staff/orders/list", {
        method: "GET",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to load staff orders.");
        return;
      }


      startTransition(() => {
        setOrders(result.orders ?? []);
        setIsBootstrapped(true);
        setLastSyncedAt(new Date());
        setSelectedOrder((currentSelectedOrder) => {
          if (!currentSelectedOrder) {
            return null;
          }

          return (
            (result.orders ?? []).find(
              (order: StaffOrder) => order.id === currentSelectedOrder.id
            ) ?? null
          );
        });
      });
    } catch {
      setError("Something went wrong while loading orders.");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  async function handleAdvance(orderId: string, expectedStatus: OrderStatus) {
    if (updatingOrderIds.includes(orderId)) {
      return;
    }

    setError("");
    setUpdatingOrderIds((current) => [...current, orderId]);

    try {
      const response = await fetch("/api/staff/orders/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, expectedStatus }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to update order status.");
        if (result.currentStatus) {
          await loadOrders();
        }
        return;
      }

      await loadOrders();
      router.refresh();
    } catch {
      setError("Something went wrong while updating status.");
    } finally {
      setUpdatingOrderIds((current) =>
        current.filter((updatingOrderId) => updatingOrderId !== orderId)
      );
    }
  }

  async function handleMarkPaid(orderId: string) {
    setError("");
    setIsMarkingPaid(true);

    try {
      const response = await fetch("/api/staff/orders/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, action: "mark_paid" }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to mark order as paid.");
        return;
      }

      await loadOrders();
      router.refresh();
    } catch {
      setError("Something went wrong while marking payment as paid.");
    } finally {
      setIsMarkingPaid(false);
    }
  }

  async function handleCancel(orderId: string) {
    setError("");
    setIsCancelling(true);

    try {
      const response = await fetch("/api/staff/orders/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to cancel order.");
        return;
      }

      closeOrder();
      await loadOrders();
      router.refresh();
    } catch {
      setError("Something went wrong while cancelling the order.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF0DA] text-[#0D2E18]">
      <header className="border-b border-[#DCCFB8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="font-sans text-sm uppercase tracking-[0.16em] text-[#684B35]">
              Order Queue
            </p>
            <h1 className="font-sans text-4xl font-bold text-[#0D2E18]">
              Active orders
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex min-w-[260px] items-center gap-3 rounded-2xl border border-[#D6C6AC] bg-[#FFF8EF] px-4 py-3">
              <Search size={18} className="text-[#8C7A64]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search orders..."
                className="w-full bg-transparent font-sans text-base text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
              />
            </label>

            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={() => loadOrders({ showLoading: true })}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-full bg-[#0D2E18] px-5 py-3 font-sans text-sm font-semibold text-[#FFF0DA] disabled:opacity-60"
              >
                <RefreshCw size={16} />
                {isLoading ? "Syncing..." : "Sync latest"}
              </button>

              <p className="font-sans text-[11px] text-[#8C7A64]">
                Auto-syncs every 15s
                {lastSyncedAt
                  ? ` - Last ${lastSyncedAt.toLocaleTimeString("en-PH", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0F441D] font-sans text-lg font-bold text-[#FFF0DA]">
                ST
              </div>
              <div>
                <p className="font-sans text-lg font-semibold text-[#0D2E18]">
                  Staff User
                </p>
                <p className="font-sans text-sm text-[#8C7A64]">Staff</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="px-6 py-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-[22px] border border-[#DCCFB8] bg-white p-4 shadow-[0_8px_20px_rgba(104,75,53,0.06)]">
            <p className="font-sans text-sm text-[#8C7A64]">Pending</p>
            <p className="mt-2 font-sans text-5xl font-semibold text-[#B44C1E]">
              {summary.pending}
            </p>
          </div>

          <div className="rounded-[22px] border border-[#DCCFB8] bg-white p-4 shadow-[0_8px_20px_rgba(104,75,53,0.06)]">
            <p className="font-sans text-sm text-[#8C7A64]">Preparing</p>
            <p className="mt-2 font-sans text-5xl font-semibold text-[#B76522]">
              {summary.preparing}
            </p>
          </div>

          <div className="rounded-[22px] border border-[#DCCFB8] bg-white p-4 shadow-[0_8px_20px_rgba(104,75,53,0.06)]">
            <p className="font-sans text-sm text-[#8C7A64]">Ready</p>
            <p className="mt-2 font-sans text-5xl font-semibold text-[#0F7A40]">
              {summary.ready}
            </p>
          </div>

          <div className="rounded-[22px] border border-[#DCCFB8] bg-white p-4 shadow-[0_8px_20px_rgba(104,75,53,0.06)]">
            <p className="font-sans text-sm text-[#8C7A64]">
              Out for delivery
            </p>
            <p className="mt-2 font-sans text-5xl font-semibold text-[#684B35]">
              {summary.outForDelivery}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {(["all", "pickup", "delivery"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setOrderFilter(value)}
              className={`rounded-full px-4 py-2 font-sans text-sm font-semibold transition ${orderFilter === value
                ? "bg-[#0D2E18] text-[#FFF0DA]"
                : "border border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35]"
                }`}
            >
              {value === "all"
                ? "All Orders"
                : value === "pickup"
                  ? "Pickup"
                  : "Delivery"}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-5 rounded-[18px] bg-[#FFF1EC] px-5 py-4 font-sans text-sm text-[#9C543D]">
            {error}
          </div>
        ) : null}

        {!isBootstrapped ? (
          <div className="mt-5 rounded-[24px] border border-[#DCCFB8] bg-white p-6 shadow-[0_8px_20px_rgba(104,75,53,0.06)]">
            <p className="font-sans text-xl font-semibold text-[#0D2E18]">
              Load staff orders
            </p>
            <p className="mt-2 font-sans text-[#6E5D49]">
              Click Refresh Orders to fetch live active orders from Supabase.
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          {boardColumns.map((column) => {
            const columnOrders = groupedOrders[column.key] ?? [];

            return (
              <section
                key={column.key}
                className="rounded-[24px] border border-[#DCCFB8] bg-[#F9F1E4] p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="font-sans text-[1.35rem] font-semibold uppercase tracking-[0.06em] text-[#8C7A64]">
                    {column.label}
                  </h2>
                  <span className="rounded-full bg-[#EFE3CF] px-3 py-1 font-sans text-sm font-semibold text-[#684B35]">
                    {columnOrders.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {columnOrders.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-6 text-center font-sans text-sm text-[#8C7A64]">
                      No orders here
                    </div>
                  ) : null}

                  {columnOrders.map((order) => {
                    const items = formatOrderSummary(order);
                    const nextAction = getNextActionLabel(
                      order.order_type,
                      order.status
                    );
                    const paymentRequired = requiresPaymentBeforeNextAction(order);
                    const isUpdatingOrder = updatingOrderIds.includes(order.id);

                    return (
                      <article
                        key={order.id}
                        onClick={() => openOrder(order)}
                        className="cursor-pointer rounded-[22px] border border-[#DCCFB8] bg-white p-5 shadow-[0_8px_20px_rgba(104,75,53,0.06)] transition hover:shadow-[0_12px_24px_rgba(104,75,53,0.10)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-sans text-[1.9rem] font-bold leading-none text-[#0D2E18]">
                              {formatOrderCode(order.id)}
                            </p>
                            <p className="mt-2 font-sans text-sm font-semibold text-[#684B35]">
                              {getOrderDisplayName(order)}
                            </p>
                          </div>

                          <span
                            className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getStatusBadgeStyle(
                              order.status
                            )}`}
                          >
                            {formatStatus(order.status)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getOrderTypeStyle(
                              order.order_type
                            )}`}
                          >
                            {order.order_type === "pickup"
                              ? "Pickup"
                              : "Delivery"}
                          </span>

                          <span
                            className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getPaymentStyle(
                              order.payment_method
                            )}`}
                          >
                            {order.payment_method === "cash" ? "Cash" : "GCash"}
                          </span>

                          <span
                            className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getPaymentStatusStyle(
                              order.payment_status
                            )}`}
                          >
                            {order.payment_status === "paid" ? "Paid" : "Unpaid"}
                          </span>
                        </div>

                        <div className="mt-4 space-y-1">
                          {items.map((item, index) => (
                            <p
                              key={`${order.id}-${index}-${item}`}
                              className="font-sans text-[1.15rem] text-[#3C332A]"
                            >
                              {item}
                            </p>
                          ))}
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className="font-sans text-lg text-[#9A856C]">
                            {formatTime(order.ordered_at)}
                          </p>
                          <p className="font-sans text-2xl font-semibold text-[#684B35]">
                            {peso(order.total_amount)}
                          </p>
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 font-sans text-sm text-[#6E5D49]">
                            {order.order_type === "delivery" ? (
                              <Truck size={16} />
                            ) : (
                              <ClipboardList size={16} />
                            )}
                            {order.order_type === "delivery"
                              ? "Delivery flow"
                              : "Pickup flow"}
                          </div>

                          {nextAction ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (paymentRequired) {
                                  openOrder(order);
                                  return;
                                }

                                handleAdvance(order.id, order.status);
                              }}
                              disabled={isUpdatingOrder}
                              className={`rounded-[14px] px-4 py-3 font-sans text-base font-semibold transition ${
                                paymentRequired
                                  ? "border border-[#B76522]/30 bg-[#FFF8EF] text-[#B76522]"
                                  : `text-white ${getColumnActionStyle(order.status)}`
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              {paymentRequired
                                ? "Mark Paid First"
                                : isUpdatingOrder
                                ? "Updating..."
                                : nextAction}
                            </button>
                          ) : (
                            <span className="font-sans text-sm text-[#8C7A64]">
                              No next action
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-8 rounded-[24px] border border-[#DCCFB8] bg-[#F9F1E4] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-sans text-sm uppercase tracking-[0.16em] text-[#684B35]">
                Order History
              </p>
              <h2 className="mt-1 font-sans text-2xl font-bold text-[#0D2E18]">
                Recent finished and cancelled orders
              </h2>
            </div>

            <span className="rounded-full bg-[#EFE3CF] px-3 py-1 font-sans text-sm font-semibold text-[#684B35]">
              {historyOrders.length} shown
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {historyOrders.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-6 text-center font-sans text-sm text-[#8C7A64]">
                No finished orders yet
              </div>
            ) : null}

            {historyOrders.map((order) => {
              const items = formatOrderSummary(order);

              return (
                <article
                  key={order.id}
                  onClick={() => openOrder(order)}
                  className="cursor-pointer rounded-[22px] border border-[#DCCFB8] bg-white p-5 shadow-[0_8px_20px_rgba(104,75,53,0.06)] transition hover:shadow-[0_12px_24px_rgba(104,75,53,0.10)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-sans text-[1.5rem] font-bold leading-none text-[#0D2E18]">
                        {formatOrderCode(order.id)}
                      </p>
                      <p className="mt-2 font-sans text-sm font-semibold text-[#684B35]">
                        {getOrderDisplayName(order)}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getStatusBadgeStyle(
                        order.status
                      )}`}
                    >
                      {formatStatus(order.status)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getOrderTypeStyle(
                        order.order_type
                      )}`}
                    >
                      {order.order_type === "pickup" ? "Pickup" : "Delivery"}
                    </span>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getPaymentStyle(
                        order.payment_method
                      )}`}
                    >
                      {order.payment_method === "cash" ? "Cash" : "GCash"}
                    </span>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getPaymentStatusStyle(
                        order.payment_status
                      )}`}
                    >
                      {order.payment_status === "paid" ? "Paid" : "Unpaid"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-1">
                    {items.slice(0, 2).map((item, index) => (
                      <p
                        key={`${order.id}-${index}-${item}`}
                        className="font-sans text-[1rem] text-[#3C332A]"
                      >
                        {item}
                      </p>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="font-sans text-sm text-[#9A856C]">
                      {formatDateTime(order.ordered_at)}
                    </p>
                    <p className="font-sans text-xl font-semibold text-[#684B35]">
                      {peso(order.total_amount)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {selectedOrder ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-[#0D2E18]/35"
            onClick={closeOrder}
          />

          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-[#FFF8EF] shadow-[-18px_0_40px_rgba(13,46,24,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#DCCFB8] px-6 py-5">
              <div>
                <p className="font-sans text-sm uppercase tracking-[0.16em] text-[#684B35]">
                  Order Details
                </p>
                <h2 className="mt-2 font-sans text-4xl font-bold text-[#0D2E18]">
                  {formatOrderCode(selectedOrder.id)}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeOrder}
                className="rounded-full bg-white p-2 text-[#0D2E18]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getOrderTypeStyle(
                    selectedOrder.order_type
                  )}`}
                >
                  {selectedOrder.order_type === "pickup"
                    ? "Pickup"
                    : "Delivery"}
                </span>

                <span
                  className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getPaymentStyle(
                    selectedOrder.payment_method
                  )}`}
                >
                  {selectedOrder.payment_method === "cash" ? "Cash" : "GCash"}
                </span>

                <span
                  className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getPaymentStatusStyle(
                    selectedOrder.payment_status
                  )}`}
                >
                  {selectedOrder.payment_status === "paid" ? "Paid" : "Unpaid"}
                </span>

                <span
                  className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getStatusBadgeStyle(
                    selectedOrder.status
                  )}`}
                >
                  {formatStatus(selectedOrder.status)}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                  <p className="font-sans text-sm text-[#8C7A64]">Placed at</p>
                  <p className="mt-2 font-sans text-lg font-semibold text-[#0D2E18]">
                    {formatDateTime(selectedOrder.ordered_at)}
                  </p>
                </div>

                <div className="rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                  <p className="font-sans text-sm text-[#8C7A64]">Total</p>
                  <p className="mt-2 font-sans text-lg font-semibold text-[#684B35]">
                    {peso(selectedOrder.total_amount)}
                  </p>
                </div>
              </div>

              {selectedOrder.order_type === "delivery" ? (
                <div className="mt-5 rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                  <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
                    Delivery Info
                  </p>

                  <div className="mt-3 space-y-2 font-sans text-sm text-[#3C332A]">
                    <p>
                      <span className="font-semibold">Address:</span>{" "}
                      {selectedOrder.delivery_address || "No address"}
                    </p>
                    <p>
                      <span className="font-semibold">Email:</span>{" "}
                      {selectedOrder.delivery_email || "No email"}
                    </p>
                    <p>
                      <span className="font-semibold">Phone:</span>{" "}
                      {selectedOrder.delivery_phone || "No phone"}
                    </p>
                  </div>
                </div>
              ) : null}

              {getOrderDisplayName(selectedOrder) ? (
                <div className="mt-5 rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                  <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
                    Walk-in Customer
                  </p>
                  <p className="mt-2 font-sans text-base font-semibold text-[#0D2E18]">
                    {getOrderDisplayName(selectedOrder)}
                  </p>
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
                  Order Items
                </p>

                {selectedOrder.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[20px] border border-[#DCCFB8] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-sans text-lg font-semibold text-[#0D2E18]">
                          {item.menu_items?.name ?? "Menu item"} ×{" "}
                          {item.quantity}
                        </p>

                        <div className="mt-2 space-y-1 font-sans text-sm text-[#5F5346]">
                          <p>
                            Size: {item.size} • Temp: {item.temperature}
                          </p>
                          <p>
                            Sugar: {item.sugar_level}%
                            {item.ice_level ? ` • Ice: ${item.ice_level}` : ""}
                          </p>

                          {item.addons && item.addons.length > 0 ? (
                            <p>
                              Add-ons:{" "}
                              {item.addons.map(formatAddonLabel).join(", ")}
                            </p>
                          ) : null}

                          {item.special_instructions ? (
                            <p>Note: {item.special_instructions}</p>
                          ) : null}
                        </div>
                      </div>

                      <p className="font-sans text-lg font-semibold text-[#684B35]">
                        {peso(item.unit_price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[#DCCFB8] px-6 py-5">
              {isConfirmingCancel ? (
                <div className="rounded-[18px] border border-[#E8B8A8] bg-[#FFF1EC] p-4">
                  <p className="font-sans text-base font-semibold text-[#9C543D]">
                    Cancel this order?
                  </p>
                  <p className="mt-1 font-sans text-sm text-[#9C543D]">
                    This will mark the order as cancelled and remove it from the
                    active board.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingCancel(false)}
                      className="rounded-[14px] border border-[#D6C6AC] bg-white px-4 py-2 font-sans text-sm font-semibold text-[#684B35]"
                    >
                      Keep Order
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCancel(selectedOrder.id)}
                      disabled={isCancelling}
                      className="rounded-[14px] bg-[#C55432] px-4 py-2 font-sans text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isCancelling ? "Cancelling..." : "Yes, Cancel"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-sans text-lg font-semibold text-[#0D2E18]">
                      Order actions
                    </p>
                    {getFinalStatusMessage(selectedOrder.status) ? (
                      <p className="mt-1 font-sans text-sm text-[#8C7A64]">
                        {getFinalStatusMessage(selectedOrder.status)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {selectedOrder.payment_status === "unpaid" &&
                    !["cancelled"].includes(selectedOrder.status) ? (
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(selectedOrder.id)}
                        disabled={isMarkingPaid}
                        className="rounded-[14px] border border-[#0F441D]/25 bg-[#FFF8EF] px-5 py-3 font-sans text-base font-semibold text-[#0F441D] transition hover:bg-[#F4EEE6] disabled:opacity-60"
                      >
                        {isMarkingPaid ? "Marking..." : "Mark Paid"}
                      </button>
                    ) : null}

                    {!["completed", "delivered", "cancelled"].includes(
                      selectedOrder.status
                    ) ? (
                      <button
                        type="button"
                        onClick={() => setIsConfirmingCancel(true)}
                        className="rounded-[14px] border border-[#C55432] px-5 py-3 font-sans text-base font-semibold text-[#C55432] transition hover:bg-[#FFF1EC]"
                      >
                        Cancel Order
                      </button>
                    ) : null}

                    {getNextActionLabel(
                      selectedOrder.order_type,
                      selectedOrder.status
                    ) ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (requiresPaymentBeforeNextAction(selectedOrder)) {
                            setError("Mark this order as paid before closing it.");
                            return;
                          }

                          await handleAdvance(
                            selectedOrder.id,
                            selectedOrder.status
                          );
                        }}
                        disabled={updatingOrderIds.includes(selectedOrder.id)}
                        className={`rounded-[14px] px-5 py-3 font-sans text-base font-semibold transition ${
                          requiresPaymentBeforeNextAction(selectedOrder)
                            ? "border border-[#B76522]/30 bg-[#FFF8EF] text-[#B76522]"
                            : `text-white ${getColumnActionStyle(
                                selectedOrder.status
                              )}`
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {requiresPaymentBeforeNextAction(selectedOrder)
                          ? "Payment Required"
                          : updatingOrderIds.includes(selectedOrder.id)
                          ? "Updating..."
                          : getNextActionLabel(
                              selectedOrder.order_type,
                              selectedOrder.status
                            )}
                      </button>
                    ) : (
                      <span className="rounded-[14px] bg-[#F4EEE6] px-4 py-3 font-sans text-sm font-semibold text-[#684B35]">
                        Final Status
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </main>
  );
}

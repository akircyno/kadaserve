"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import type { OrderStatus, StaffOrder } from "@/types/orders";

type OrderFilter = "all" | "pickup" | "delivery";
type StationStatus = "accepting" | "busy";
type StaffProfile = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
};
type BoardOrderStatus = Exclude<
  OrderStatus,
  "completed" | "delivered" | "cancelled"
>;

const fallbackOrders: StaffOrder[] = [];
const finalStatuses: OrderStatus[] = ["completed", "delivered", "cancelled"];


const boardColumns: Array<{
  key: BoardOrderStatus;
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
    order.customer_profile?.full_name?.trim() ||
    formatNameFromEmail(order.delivery_email) ||
    formatNameFromEmail(order.customer_profile?.email ?? null) ||
    (order.order_type === "delivery" ? "Delivery Customer" : "Walk-in Customer")
  );
}

function getOrderEmail(order: StaffOrder) {
  return order.delivery_email || order.customer_profile?.email || null;
}

function getOrderPhone(order: StaffOrder) {
  return order.delivery_phone || order.customer_profile?.phone || null;
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

function formatElapsed(value: string, now: Date) {
  const elapsedMs = Math.max(0, now.getTime() - new Date(value).getTime());
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${Math.max(1, minutes)}m`;
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
    ? "bg-[#E6F2E8] text-[#0D2E18]"
    : "bg-[#FFF0E5] text-[#684B35]";
}

function getPaymentStyle(paymentMethod: StaffOrder["payment_method"]) {
  if (!paymentMethod) {
    return "border border-[#DCCFB8] bg-[#FFF8EF]/70 text-[#8A755D]";
  }

  return paymentMethod === "cash"
    ? "border border-[#0F441D]/20 bg-[#FFF8EF]/70 text-[#0F441D]"
    : "border border-[#684B35]/20 bg-[#FFF8EF]/70 text-[#684B35]";
}

function getPaymentLabel(paymentMethod: StaffOrder["payment_method"]) {
  if (!paymentMethod) {
    return "Payment pending";
  }

  return paymentMethod === "cash" ? "Cash" : "GCash";
}

function getPaymentStatusStyle(paymentStatus: StaffOrder["payment_status"]) {
  return paymentStatus === "paid"
    ? "border border-[#0F441D]/20 bg-[#FFF8EF]/70 text-[#0F441D]"
    : "border border-[#B76522]/25 bg-[#FFF8EF]/70 text-[#B76522]";
}

function getStatusBadgeStyle(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "bg-[#E6F2E8] text-[#0D2E18]";
    case "preparing":
      return "bg-[#E6F2E8] text-[#0D2E18]";
    case "ready":
      return "bg-[#E6F2E8] text-[#0F441D]";
    case "out_for_delivery":
      return "bg-[#FFF0DA] text-[#684B35]";
    case "completed":
      return "bg-[#E6F2E8] text-[#0F441D]";
    case "delivered":
      return "bg-[#FFF0DA] text-[#684B35]";
    case "cancelled":
      return "bg-[#FFF1EC] text-[#C55432]";
    default:
      return "bg-[#F4EEE6] text-[#684B35]";
  }
}

function getColumnActionStyle(status: OrderStatus) {
  if (status === "out_for_delivery") {
    return "bg-[#684B35] hover:bg-[#5A3F2D]";
  }

  if (status === "ready") {
    return "bg-[#0F441D] hover:bg-[#0D2E18]";
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
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [stationStatus, setStationStatus] =
    useState<StationStatus>("accepting");
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<string[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [dispatchToast, setDispatchToast] = useState("");
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

  const ordersHandledToday = useMemo(() => {
    const today = new Date();

    return orders.filter((order) => {
      const orderedAt = new Date(order.ordered_at);
      return (
        finalStatuses.includes(order.status) &&
        orderedAt.getFullYear() === today.getFullYear() &&
        orderedAt.getMonth() === today.getMonth() &&
        orderedAt.getDate() === today.getDate()
      );
    }).length;
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!dispatchToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDispatchToast("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [dispatchToast]);

  function openOrder(order: StaffOrder) {
    setSelectedOrder(order);
    setIsConfirmingCancel(false);
  }

  function toggleOrderCard(orderId: string) {
    setExpandedOrderId((currentOrderId) =>
      currentOrderId === orderId ? null : orderId
    );
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
        setStaffProfile(result.staffProfile ?? null);
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

      if (result.nextStatus === "out_for_delivery") {
        setDispatchToast(
          result.notificationSent
            ? "Email Sent"
            : "Out for delivery. Email not configured."
        );
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
        <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)] lg:items-center lg:px-5">
          <div className="flex items-start gap-2">
            <div>
            <p className="font-sans text-xs uppercase tracking-[0.14em] text-[#684B35]">
              Order Queue
            </p>
            <h1 className="font-sans text-2xl font-bold text-[#0D2E18] lg:text-3xl">
              Active orders
            </h1>
            </div>

            <button
              type="button"
              onClick={() => loadOrders({ showLoading: true })}
              disabled={isLoading}
              title="Force refresh order queue"
              className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] transition hover:bg-[#F4EEE6] disabled:opacity-60"
            >
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
              <span className="sr-only">
                {isLoading ? "Syncing latest orders" : "Sync latest orders"}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 rounded-2xl border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-2 lg:justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F441D] font-sans text-xs font-bold text-[#FFF0DA]">
              {(staffProfile?.fullName || "Staff User")
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-[130px]">
              <p className="font-sans text-sm font-semibold leading-tight text-[#0D2E18]">
                {staffProfile?.fullName || "Staff Chrizelda"}
              </p>
              <p className="font-sans text-xs capitalize text-[#8C7A64]">
                {staffProfile?.role?.replace("_", " ") || "Head Barista"}
              </p>
            </div>

            <div className="h-8 w-px bg-[#DCCFB8]" />

            <div className="min-w-[86px]">
              <p className="font-sans text-[10px] uppercase tracking-[0.1em] text-[#8C7A64]">
                Handled
              </p>
              <p className="font-sans text-xl font-bold leading-none text-[#0D2E18]">
                {ordersHandledToday} today
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <label className="flex min-w-full items-center gap-2 rounded-xl border border-[#D6C6AC] bg-[#FFF8EF] px-3 py-2 sm:min-w-[220px] sm:max-w-[280px]">
              <Search size={16} className="text-[#8C7A64]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search orders..."
                className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
              />
            </label>

              <button
                type="button"
                onClick={() =>
                  setStationStatus((currentStatus) =>
                    currentStatus === "accepting" ? "busy" : "accepting"
                  )
                }
                className={`inline-flex h-9 items-center gap-2 rounded-full px-3 font-sans text-xs font-semibold transition ${
                  stationStatus === "accepting"
                    ? "bg-[#E6F2E8] text-[#0F441D]"
                    : "bg-[#FFF0E5] text-[#B76522]"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                {stationStatus === "accepting" ? "Accepting" : "Busy"}
              </button>

              <button
                type="button"
                title="Security settings"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D6C6AC] bg-white text-[#684B35] transition hover:bg-[#F4EEE6]"
              >
                <ShieldCheck size={15} />
                <span className="sr-only">Security settings</span>
              </button>

              <div className="basis-full font-sans text-[11px] text-[#8C7A64] sm:basis-auto">
                Auto-sync 15s
                {lastSyncedAt
                  ? ` - Last ${lastSyncedAt.toLocaleTimeString("en-PH", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                  : ""}
              </div>
          </div>
        </div>
      </header>

      <section className="px-4 py-4 lg:px-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-3 shadow-[0_6px_16px_rgba(104,75,53,0.05)]">
            <p className="font-sans text-xs text-[#8C7A64]">Pending</p>
            <p className="mt-1 font-sans text-3xl font-bold text-[#0D2E18]">
              {summary.pending}
            </p>
          </div>

          <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-3 shadow-[0_6px_16px_rgba(104,75,53,0.05)]">
            <p className="font-sans text-xs text-[#8C7A64]">Preparing</p>
            <p className="mt-1 font-sans text-3xl font-bold text-[#0D2E18]">
              {summary.preparing}
            </p>
          </div>

          <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-3 shadow-[0_6px_16px_rgba(104,75,53,0.05)]">
            <p className="font-sans text-xs text-[#8C7A64]">Ready</p>
            <p className="mt-1 font-sans text-3xl font-bold text-[#0F441D]">
              {summary.ready}
            </p>
          </div>

          <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-3 shadow-[0_6px_16px_rgba(104,75,53,0.05)]">
            <p className="font-sans text-xs text-[#8C7A64]">
              Out for delivery
            </p>
            <p className="mt-1 font-sans text-3xl font-bold text-[#684B35]">
              {summary.outForDelivery}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", "pickup", "delivery"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setOrderFilter(value)}
              className={`rounded-full px-3 py-1.5 font-sans text-xs font-semibold transition ${orderFilter === value
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
          <div className="mt-4 rounded-[16px] bg-[#FFF1EC] px-4 py-3 font-sans text-sm text-[#9C543D]">
            {error}
          </div>
        ) : null}

        {!isBootstrapped ? (
          <div className="mt-4 rounded-[18px] border border-[#DCCFB8] bg-white p-4 shadow-[0_6px_16px_rgba(104,75,53,0.05)]">
            <p className="font-sans text-lg font-semibold text-[#0D2E18]">
              Load staff orders
            </p>
            <p className="mt-1 font-sans text-sm text-[#6E5D49]">
              Click Refresh Orders to fetch live active orders from Supabase.
            </p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {boardColumns.map((column) => {
            const columnOrders = groupedOrders[column.key] ?? [];

            return (
              <section
                key={column.key}
                className="rounded-[20px] border border-[#DCCFB8] bg-[#F9F1E4] p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2
                    className={`font-sans text-base font-bold ${
                      column.key === "out_for_delivery"
                        ? "text-[#684B35]"
                        : "text-[#0D2E18]"
                    }`}
                  >
                    {column.label}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${
                      column.key === "out_for_delivery"
                        ? "bg-[#FFF0DA] text-[#684B35]"
                        : "bg-[#EFE3CF] text-[#684B35]"
                    }`}
                  >
                    {columnOrders.length}
                  </span>
                </div>

                {column.key === "out_for_delivery" && dispatchToast ? (
                  <div className="mb-3 rounded-full border border-[#684B35]/20 bg-[#FFF8EF] px-3 py-1.5 text-center font-sans text-xs font-semibold text-[#684B35] shadow-[0_6px_14px_rgba(104,75,53,0.08)]">
                    {dispatchToast}
                  </div>
                ) : null}

                <div className="space-y-3">
                  {columnOrders.length === 0 ? (
                    <div className="rounded-[16px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-3 py-5 text-center font-sans text-sm text-[#8C7A64]">
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
                    const isExpanded = expandedOrderId === order.id;
                    const orderEmail = getOrderEmail(order);
                    const orderPhone = getOrderPhone(order);
                    const specialRemarks = order.order_items
                      .map((item) => item.special_instructions?.trim())
                      .filter((remark): remark is string => Boolean(remark));

                    return (
                      <article
                        key={order.id}
                        onClick={() => toggleOrderCard(order.id)}
                        className="group/order cursor-pointer rounded-[18px] border border-[#DCCFB8] bg-white p-3 shadow-[0_6px_16px_rgba(104,75,53,0.05)] transition hover:shadow-[0_10px_20px_rgba(104,75,53,0.09)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-sans text-[1.2rem] font-bold leading-none text-[#0D2E18]">
                              {formatOrderCode(order.id)}
                            </p>
                            <p className="mt-1 font-sans text-xs font-semibold text-[#684B35]">
                              {getOrderDisplayName(order)}
                            </p>
                            {orderEmail || orderPhone ? (
                              <p className="mt-1 max-h-0 overflow-hidden font-sans text-[11px] leading-snug text-[#8C7A64] opacity-0 transition-all duration-200 group-hover/order:max-h-10 group-hover/order:opacity-100 group-focus-within/order:max-h-10 group-focus-within/order:opacity-100">
                                {[orderEmail, orderPhone].filter(Boolean).join(" | ")}
                              </p>
                            ) : null}
                          </div>

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getStatusBadgeStyle(
                              order.status
                            )}`}
                          >
                            {formatStatus(order.status)}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex rounded-full bg-[#F4EEE6] px-2.5 py-1 font-sans text-xs font-semibold text-[#684B35]">
                            {formatElapsed(order.ordered_at, now)}
                          </span>

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getOrderTypeStyle(
                              order.order_type
                            )}`}
                          >
                            {order.order_type === "pickup"
                              ? "Pickup"
                              : "Delivery"}
                          </span>

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getPaymentStyle(
                              order.payment_method
                            )}`}
                          >
                            {getPaymentLabel(order.payment_method)}
                          </span>

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getPaymentStatusStyle(
                              order.payment_status
                            )}`}
                          >
                            {order.payment_status === "paid" ? "Paid" : "Unpaid"}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 font-sans">
                          <p className="truncate text-sm text-[#3C332A]">
                            {items[0] ?? "No item summary"}
                            {items.length > 1 ? ` +${items.length - 1}` : ""}
                          </p>
                          <div className="text-right">
                            <p className="text-[11px] text-[#9A856C]">
                              {formatTime(order.ordered_at)}
                            </p>
                            <p className="text-base font-semibold text-[#684B35]">
                              {peso(order.total_amount)}
                            </p>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div className="mt-3 space-y-3 border-t border-[#EFE3CF] pt-3">
                            <div className="space-y-1">
                              {items.map((item, index) => (
                                <p
                                  key={`${order.id}-${index}-${item}`}
                                  className="font-sans text-xs text-[#3C332A]"
                                >
                                  {item}
                                </p>
                              ))}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {orderPhone ? (
                                <a
                                  href={`tel:${orderPhone}`}
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex h-9 items-center gap-2 rounded-full border border-[#D6C6AC] bg-[#FFF8EF] px-3 font-sans text-xs font-semibold text-[#684B35]"
                                >
                                  <Phone size={14} />
                                  Call
                                </a>
                              ) : null}

                              {orderEmail ? (
                                <a
                                  href={`mailto:${orderEmail}`}
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex h-9 items-center gap-2 rounded-full border border-[#D6C6AC] bg-[#FFF8EF] px-3 font-sans text-xs font-semibold text-[#684B35]"
                                >
                                  <Mail size={14} />
                                  Email
                                </a>
                              ) : null}

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openOrder(order);
                                }}
                                className="inline-flex h-9 items-center gap-2 rounded-full border border-[#D6C6AC] bg-white px-3 font-sans text-xs font-semibold text-[#684B35]"
                              >
                                <UserRound size={14} />
                                Details
                              </button>
                            </div>

                            <div className="rounded-xl bg-[#FFF8EF] p-3 font-sans text-xs text-[#5F5346]">
                              <p className="font-semibold text-[#0D2E18]">
                                Special remarks
                              </p>
                              {specialRemarks.length > 0 ? (
                                <ul className="mt-1 space-y-1">
                                  {specialRemarks.map((remark, index) => (
                                    <li key={`${order.id}-remark-${index}`}>
                                      {remark}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-[#8C7A64]">
                                  No special request
                                </p>
                              )}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-1.5 font-sans text-xs text-[#6E5D49]">
                            {order.order_type === "delivery" ? (
                              <Truck size={14} />
                            ) : (
                              <ClipboardList size={14} />
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
                              className={`rounded-xl px-3 py-2 font-sans text-xs font-semibold transition ${
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

        <div className="mt-5 rounded-[20px] border border-[#DCCFB8] bg-[#F9F1E4] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-sans text-xs uppercase tracking-[0.14em] text-[#684B35]">
                Order History
              </p>
              <h2 className="mt-1 font-sans text-xl font-bold text-[#0D2E18]">
                Recent finished and cancelled orders
              </h2>
            </div>

            <span className="rounded-full bg-[#EFE3CF] px-2.5 py-1 font-sans text-xs font-semibold text-[#684B35]">
              {historyOrders.length} shown
            </span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {historyOrders.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-5 text-center font-sans text-sm text-[#8C7A64]">
                No finished orders yet
              </div>
            ) : null}

            {historyOrders.map((order) => {
              const items = formatOrderSummary(order);

              return (
                <article
                  key={order.id}
                  onClick={() => openOrder(order)}
                  className="cursor-pointer rounded-[18px] border border-[#DCCFB8] bg-white p-3 shadow-[0_6px_16px_rgba(104,75,53,0.05)] transition hover:shadow-[0_10px_20px_rgba(104,75,53,0.09)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-sans text-[1.15rem] font-bold leading-none text-[#0D2E18]">
                        {formatOrderCode(order.id)}
                      </p>
                      <p className="mt-1 font-sans text-xs font-semibold text-[#684B35]">
                        {getOrderDisplayName(order)}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getStatusBadgeStyle(
                        order.status
                      )}`}
                    >
                      {formatStatus(order.status)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getOrderTypeStyle(
                        order.order_type
                      )}`}
                    >
                      {order.order_type === "pickup" ? "Pickup" : "Delivery"}
                    </span>

                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getPaymentStyle(
                        order.payment_method
                      )}`}
                    >
                      {getPaymentLabel(order.payment_method)}
                    </span>

                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getPaymentStatusStyle(
                        order.payment_status
                      )}`}
                    >
                      {order.payment_status === "paid" ? "Paid" : "Unpaid"}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1">
                    {items.slice(0, 2).map((item, index) => (
                      <p
                        key={`${order.id}-${index}-${item}`}
                        className="font-sans text-sm text-[#3C332A]"
                      >
                        {item}
                      </p>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="font-sans text-sm text-[#9A856C]">
                      {formatDateTime(order.ordered_at)}
                    </p>
                    <p className="font-sans text-lg font-semibold text-[#684B35]">
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

          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-[#FFF8EF] shadow-[-18px_0_40px_rgba(13,46,24,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#DCCFB8] px-5 py-4">
              <div>
                <p className="font-sans text-xs uppercase tracking-[0.14em] text-[#684B35]">
                  Order Details
                </p>
                <h2 className="mt-1 font-sans text-2xl font-bold text-[#0D2E18]">
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

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getOrderTypeStyle(
                    selectedOrder.order_type
                  )}`}
                >
                  {selectedOrder.order_type === "pickup"
                    ? "Pickup"
                    : "Delivery"}
                </span>

                <span
                  className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getPaymentStyle(
                    selectedOrder.payment_method
                  )}`}
                >
                  {getPaymentLabel(selectedOrder.payment_method)}
                </span>

                <span
                  className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getPaymentStatusStyle(
                    selectedOrder.payment_status
                  )}`}
                >
                  {selectedOrder.payment_status === "paid" ? "Paid" : "Unpaid"}
                </span>

                <span
                  className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getStatusBadgeStyle(
                    selectedOrder.status
                  )}`}
                >
                  {formatStatus(selectedOrder.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                  <p className="font-sans text-xs text-[#8C7A64]">Placed at</p>
                  <p className="mt-1 font-sans text-sm font-semibold text-[#0D2E18]">
                    {formatDateTime(selectedOrder.ordered_at)}
                  </p>
                </div>

                <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                  <p className="font-sans text-xs text-[#8C7A64]">Total</p>
                  <p className="mt-1 font-sans text-sm font-semibold text-[#684B35]">
                    {peso(selectedOrder.total_amount)}
                  </p>
                </div>
              </div>

              {selectedOrder.order_type === "delivery" ? (
                <div className="mt-4 rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                  <p className="font-sans text-xs uppercase tracking-[0.08em] text-[#684B35]">
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
                <div className="mt-4 rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                  <p className="font-sans text-xs uppercase tracking-[0.08em] text-[#684B35]">
                    Walk-in Customer
                  </p>
                  <p className="mt-1 font-sans text-sm font-semibold text-[#0D2E18]">
                    {getOrderDisplayName(selectedOrder)}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                <p className="font-sans text-xs uppercase tracking-[0.08em] text-[#684B35]">
                  Order Items
                </p>

                {selectedOrder.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[16px] border border-[#DCCFB8] bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-sans text-base font-semibold text-[#0D2E18]">
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

                      <p className="font-sans text-base font-semibold text-[#684B35]">
                        {peso(item.unit_price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[#DCCFB8] px-5 py-4">
              {isConfirmingCancel ? (
                <div className="rounded-[16px] border border-[#E8B8A8] bg-[#FFF1EC] p-3">
                  <p className="font-sans text-sm font-semibold text-[#9C543D]">
                    Cancel this order?
                  </p>
                  <p className="mt-1 font-sans text-sm text-[#9C543D]">
                    This will mark the order as cancelled and remove it from the
                    active board.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingCancel(false)}
                      className="rounded-xl border border-[#D6C6AC] bg-white px-3 py-2 font-sans text-xs font-semibold text-[#684B35]"
                    >
                      Keep Order
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCancel(selectedOrder.id)}
                      disabled={isCancelling}
                      className="rounded-xl bg-[#C55432] px-3 py-2 font-sans text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {isCancelling ? "Cancelling..." : "Yes, Cancel"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-sans text-base font-semibold text-[#0D2E18]">
                      Order actions
                    </p>
                    {getFinalStatusMessage(selectedOrder.status) ? (
                      <p className="mt-1 font-sans text-sm text-[#8C7A64]">
                        {getFinalStatusMessage(selectedOrder.status)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedOrder.payment_status === "unpaid" &&
                    !["cancelled"].includes(selectedOrder.status) ? (
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(selectedOrder.id)}
                        disabled={isMarkingPaid}
                        className="rounded-xl border border-[#0F441D]/25 bg-[#FFF8EF] px-3 py-2 font-sans text-sm font-semibold text-[#0F441D] transition hover:bg-[#F4EEE6] disabled:opacity-60"
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
                        className="rounded-xl border border-[#C55432] px-3 py-2 font-sans text-sm font-semibold text-[#C55432] transition hover:bg-[#FFF1EC]"
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
                        className={`rounded-xl px-3 py-2 font-sans text-sm font-semibold transition ${
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
                      <span className="rounded-xl bg-[#F4EEE6] px-3 py-2 font-sans text-sm font-semibold text-[#684B35]">
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

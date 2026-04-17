"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  LayoutGrid,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Truck,
  X,
} from "lucide-react";

type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

type OrderFilter = "all" | "pickup" | "delivery";

type StaffOrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  sugar_level: number;
  ice_level: string | null;
  size: string;
  temperature: string;
  addons: string[] | null;
  special_instructions: string | null;
  menu_items: {
    name: string;
  } | null;
};

type StaffOrder = {
  id: string;
  order_type: "pickup" | "delivery";
  status: OrderStatus;
  payment_method: "cash" | "gcash";
  payment_status: "unpaid" | "paid";
  total_amount: number;
  ordered_at: string;
  walkin_name: string | null;
  delivery_address: string | null;
  delivery_email: string | null;
  delivery_phone: string | null;
  order_items: StaffOrderItem[];
};

const fallbackOrders: StaffOrder[] = [];

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
  return `₱${Math.round(value)}`;
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
        return "Start";
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
      return "Start";
    case "preparing":
      return "Mark Ready";
    case "ready":
      return "Dispatch";
    case "out_for_delivery":
      return "Delivered";
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
    ? "bg-[#E6F7E8] text-[#1E7A3D]"
    : "bg-[#E8F0FF] text-[#2454C5]";
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

function formatOrderSummary(order: StaffOrder) {
  return order.order_items
    .map((item) => {
      const label = item.menu_items?.name ?? "Menu item";
      return `${label} × ${item.quantity}`;
    })
    .filter(Boolean);
}

function formatAddonLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function StaffPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<StaffOrder[]>(fallbackOrders);
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const activeOrders = useMemo(() => {
    return orders.filter(
      (order) => !["completed", "delivered", "cancelled"].includes(order.status)
    );
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

      const matchesSearch =
        !keyword ||
        orderCode.includes(keyword) ||
        itemNames.includes(keyword) ||
        orderType.includes(keyword);

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

  async function loadOrders() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/staff/orders/list", {
        method: "GET",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to load staff orders.");
        return;
      }

      setOrders(result.orders ?? []);
      setIsBootstrapped(true);

      if (selectedOrder) {
        const updatedSelectedOrder =
          (result.orders ?? []).find(
            (order: StaffOrder) => order.id === selectedOrder.id
          ) ?? null;
        setSelectedOrder(updatedSelectedOrder);
      }
    } catch {
      setError("Something went wrong while loading orders.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAdvance(orderId: string) {
    setError("");

    try {
      const response = await fetch("/api/staff/orders/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to update order status.");
        return;
      }

      await loadOrders();
      router.refresh();
    } catch {
      setError("Something went wrong while updating status.");
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/logout", {
        method: "POST",
      });

      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF0DA] text-[#0D2E18]">
      <div className="flex min-h-screen">
        <aside className="flex w-[76px] shrink-0 flex-col justify-between bg-[#0D2E18] px-3 py-4">
          <div className="space-y-5">
            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFFFFF] text-[#0D2E18]"
            >
              <Truck size={22} />
            </button>

            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFFFFF]/14 text-[#FFF0DA]"
            >
              <LayoutGrid size={20} />
            </button>

            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-[#FFF0DA]/75"
            >
              <Plus size={22} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-[#FFF0DA]/80"
          >
            <LogOut size={20} />
          </button>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="border-b border-[#DCCFB8] bg-[#FFFFFF]">
            <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
              <div>
                <p className="font-sans text-sm uppercase tracking-[0.16em] text-[#684B35]">
                  Order Queue
                </p>
                <h1 className="font-sans text-4xl font-bold text-[#0D2E18]">
                  Active orders
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex min-w-[240px] items-center gap-3 rounded-2xl border border-[#D6C6AC] bg-[#FFF8EF] px-4 py-3">
                  <Search size={18} className="text-[#8C7A64]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search orders..."
                    className="w-full bg-transparent font-sans text-base text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                  />
                </label>

                <button
                  type="button"
                  onClick={loadOrders}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0D2E18] px-5 py-3 font-sans text-sm font-semibold text-[#FFF0DA] disabled:opacity-60"
                >
                  <RefreshCw size={16} />
                  {isLoading ? "Refreshing..." : "Refresh Orders"}
                </button>

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

          <div className="px-6 py-5">
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-[22px] border border-[#DCCFB8] bg-[#FFFFFF] p-4 shadow-[0_8px_20px_rgba(104,75,53,0.06)]">
                <p className="font-sans text-sm text-[#8C7A64]">Pending</p>
                <p className="mt-2 font-sans text-5xl font-semibold text-[#B44C1E]">
                  {summary.pending}
                </p>
              </div>

              <div className="rounded-[22px] border border-[#DCCFB8] bg-[#FFFFFF] p-4 shadow-[0_8px_20px_rgba(104,75,53,0.06)]">
                <p className="font-sans text-sm text-[#8C7A64]">Preparing</p>
                <p className="mt-2 font-sans text-5xl font-semibold text-[#B76522]">
                  {summary.preparing}
                </p>
              </div>

              <div className="rounded-[22px] border border-[#DCCFB8] bg-[#FFFFFF] p-4 shadow-[0_8px_20px_rgba(104,75,53,0.06)]">
                <p className="font-sans text-sm text-[#8C7A64]">Ready</p>
                <p className="mt-2 font-sans text-5xl font-semibold text-[#0F7A40]">
                  {summary.ready}
                </p>
              </div>

              <div className="rounded-[22px] border border-[#DCCFB8] bg-[#FFFFFF] p-4 shadow-[0_8px_20px_rgba(104,75,53,0.06)]">
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
                  className={`rounded-full px-4 py-2 font-sans text-sm font-semibold transition ${
                    orderFilter === value
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
              <div className="mt-5 rounded-[24px] border border-[#DCCFB8] bg-[#FFFFFF] p-6 shadow-[0_8px_20px_rgba(104,75,53,0.06)]">
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

                        return (
                          <article
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className="cursor-pointer rounded-[22px] border border-[#DCCFB8] bg-[#FFFFFF] p-5 shadow-[0_8px_20px_rgba(104,75,53,0.06)] transition hover:shadow-[0_12px_24px_rgba(104,75,53,0.10)]"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <p className="font-sans text-[1.9rem] font-bold leading-none text-[#0D2E18]">
                                {formatOrderCode(order.id)}
                              </p>

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
                                {order.payment_method === "cash"
                                  ? "Cash"
                                  : "GCash"}
                              </span>
                            </div>

                            <div className="mt-4 space-y-1">
                              {items.map((item) => (
                                <p
                                  key={item}
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
                                    handleAdvance(order.id);
                                  }}
                                  className={`rounded-[14px] px-4 py-3 font-sans text-base font-semibold text-white transition ${getColumnActionStyle(
                                    order.status
                                  )}`}
                                >
                                  {nextAction}
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
          </div>
        </section>
      </div>

      {selectedOrder ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-[#0D2E18]/35"
            onClick={() => setSelectedOrder(null)}
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
                onClick={() => setSelectedOrder(null)}
                className="rounded-full bg-[#FFFFFF] p-2 text-[#0D2E18]"
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
                  className={`inline-flex rounded-full px-3 py-1 font-sans text-sm font-semibold ${getStatusBadgeStyle(
                    selectedOrder.status
                  )}`}
                >
                  {formatStatus(selectedOrder.status)}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[20px] border border-[#DCCFB8] bg-[#FFFFFF] p-4">
                  <p className="font-sans text-sm text-[#8C7A64]">Placed at</p>
                  <p className="mt-2 font-sans text-lg font-semibold text-[#0D2E18]">
                    {formatDateTime(selectedOrder.ordered_at)}
                  </p>
                </div>

                <div className="rounded-[20px] border border-[#DCCFB8] bg-[#FFFFFF] p-4">
                  <p className="font-sans text-sm text-[#8C7A64]">Total</p>
                  <p className="mt-2 font-sans text-lg font-semibold text-[#684B35]">
                    {peso(selectedOrder.total_amount)}
                  </p>
                </div>
              </div>

              {selectedOrder.order_type === "delivery" ? (
                <div className="mt-5 rounded-[20px] border border-[#DCCFB8] bg-[#FFFFFF] p-4">
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

              {selectedOrder.walkin_name ? (
                <div className="mt-5 rounded-[20px] border border-[#DCCFB8] bg-[#FFFFFF] p-4">
                  <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
                    Walk-in Customer
                  </p>
                  <p className="mt-2 font-sans text-base font-semibold text-[#0D2E18]">
                    {selectedOrder.walkin_name}
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
                    className="rounded-[20px] border border-[#DCCFB8] bg-[#FFFFFF] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-sans text-lg font-semibold text-[#0D2E18]">
                          {item.menu_items?.name ?? "Menu item"} × {item.quantity}
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
                            <p>
                              Note: {item.special_instructions}
                            </p>
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
              <div className="flex items-center justify-between gap-4">
                <p className="font-sans text-lg font-semibold text-[#0D2E18]">
                  Next action
                </p>

                {getNextActionLabel(
                  selectedOrder.order_type,
                  selectedOrder.status
                ) ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleAdvance(selectedOrder.id);
                    }}
                    className={`rounded-[14px] px-5 py-3 font-sans text-base font-semibold text-white transition ${getColumnActionStyle(
                      selectedOrder.status
                    )}`}
                  >
                    {getNextActionLabel(
                      selectedOrder.order_type,
                      selectedOrder.status
                    )}
                  </button>
                ) : (
                  <span className="font-sans text-sm text-[#8C7A64]">
                    No next action
                  </span>
                )}
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </main>
  );
}

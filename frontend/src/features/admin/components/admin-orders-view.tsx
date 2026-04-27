"use client";

import { useMemo, useState } from "react";
import type { OrderStatus, StaffOrder } from "@/types/orders";

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

function formatStatus(status: OrderStatus) {
  switch (status) {
    case "out_for_delivery":
      return "Out for delivery";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function formatPaymentMethod(paymentMethod: StaffOrder["payment_method"]) {
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
    order.walkin_name?.trim() ||
    formatNameFromEmail(order.delivery_email) ||
    (order.order_type === "delivery" ? "Delivery Customer" : "Walk-in Customer")
  );
}

function formatOrderItems(order: StaffOrder) {
  return order.order_items
    .map((item) => `${item.menu_items?.name ?? "Menu item"} x ${item.quantity}`)
    .join(", ");
}

function getOrderTypeStyle(orderType: StaffOrder["order_type"]) {
  return orderType === "pickup"
    ? "border border-[#7A3FB4]/20 bg-[#FFF8EF] text-[#7A3FB4]"
    : "border border-[#B76522]/20 bg-[#FFF8EF] text-[#B76522]";
}

function getPaymentStyle(paymentMethod: StaffOrder["payment_method"]) {
  return paymentMethod === "gcash"
    ? "border border-[#684B35]/20 bg-[#FFF8EF]/70 text-[#684B35]"
    : "border border-[#0F441D]/20 bg-[#FFF8EF]/70 text-[#0F441D]";
}

function getPaymentStatusStyle(paymentStatus: StaffOrder["payment_status"]) {
  return paymentStatus === "paid"
    ? "border border-[#0F441D]/20 bg-[#FFF8EF]/70 text-[#0F441D]"
    : "border border-[#B76522]/25 bg-[#FFF8EF]/70 text-[#B76522]";
}

function getStatusStyle(status: OrderStatus) {
  switch (status) {
    case "completed":
    case "delivered":
      return "bg-[#E6F2E8] text-[#0F441D]";
    case "cancelled":
      return "bg-[#FFF1EC] text-[#C55432]";
    case "ready":
    case "out_for_delivery":
      return "bg-[#FFF0DA] text-[#684B35]";
    default:
      return "bg-[#F4EEE6] text-[#684B35]";
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

  const visibleOrders = useMemo(() => {
    return filteredOrders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      const matchesType =
        typeFilter === "all" || order.order_type === typeFilter;
      const matchesPayment =
        paymentFilter === "all" ||
        order.payment_status === paymentFilter ||
        order.payment_method === paymentFilter;

      return matchesStatus && matchesType && matchesPayment;
    });
  }, [filteredOrders, paymentFilter, statusFilter, typeFilter]);

  const statusOptions: Array<{ value: "all" | OrderStatus; label: string }> = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "preparing", label: "Preparing" },
    { value: "ready", label: "Ready" },
    { value: "out_for_delivery", label: "Out for Delivery" },
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-sans text-3xl font-bold tracking-[0.02em] text-[#0D2E18]">
            All Orders
          </h1>
          <p className="mt-1 font-sans text-sm text-[#684B35]">
            Monitor customer, payment, and fulfillment status across all orders.
          </p>
        </div>

        <span className="rounded-full bg-[#E7F4EA] px-4 py-2 font-sans text-sm font-bold text-[#0D2E18]">
          {visibleOrders.length} shown
        </span>
      </div>

      <div className="space-y-4 rounded-[18px] border border-[#DCCFB8] bg-white p-4">
        <div>
          <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
            Status
          </p>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`rounded-full border px-4 py-2 font-sans text-sm font-semibold transition ${
                  statusFilter === option.value
                    ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                    : "border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] hover:border-[#0D2E18]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
              Type
            </p>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTypeFilter(option.value)}
                  className={`rounded-full border px-4 py-2 font-sans text-sm font-semibold transition ${
                    typeFilter === option.value
                      ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                      : "border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] hover:border-[#0D2E18]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
              Payment
            </p>
            <div className="flex flex-wrap gap-2">
              {paymentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaymentFilter(option.value)}
                  className={`rounded-full border px-4 py-2 font-sans text-sm font-semibold transition ${
                    paymentFilter === option.value
                      ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                      : "border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] hover:border-[#0D2E18]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[#DCCFB8] bg-white">
        <div className="grid grid-cols-[110px_1.4fr_1fr_1.1fr_1fr_95px_90px_110px] gap-4 px-5 py-4 font-sans text-sm font-bold uppercase text-[#0D2E18]">
          <span>Order ID</span>
          <span>Customer / Items</span>
          <span>Type</span>
          <span>Payment</span>
          <span>Status</span>
          <span>Total</span>
          <span>Time</span>
          <span>Action</span>
        </div>

        <div className="divide-y divide-[#EFE3CF]">
          {visibleOrders.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-[110px_1.4fr_1fr_1.1fr_1fr_95px_90px_110px] items-start gap-4 px-5 py-4 font-sans text-sm text-[#0D2E18]"
            >
              <span className="font-bold">{formatOrderCode(order.id)}</span>
              <div>
                <p className="font-semibold">{getOrderDisplayName(order)}</p>
                <p className="mt-1 line-clamp-2 text-[#684B35]">
                  {formatOrderItems(order) || "No items"}
                </p>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase ${getOrderTypeStyle(
                  order.order_type
                )}`}
              >
                {formatOrderTypeLabel(order.order_type)}
              </span>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${getPaymentStyle(
                    order.payment_method
                  )}`}
                >
                  {formatPaymentMethod(order.payment_method)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${getPaymentStatusStyle(
                    order.payment_status
                  )}`}
                >
                  {formatPaymentStatus(order.payment_status)}
                </span>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase ${getStatusStyle(
                  order.status
                )}`}
              >
                {formatStatus(order.status)}
              </span>
              <span className="font-semibold">{peso(order.total_amount)}</span>
              <span>{formatTime(order.ordered_at)}</span>
              <button
                type="button"
                onClick={() => onOpenOrder(order)}
                className="rounded-full bg-[#E7F4EA] px-4 py-2 font-sans text-xs font-bold text-[#0D2E18]"
              >
                View
              </button>
            </div>
          ))}
          {visibleOrders.length === 0 ? (
            <EmptyState label="No orders found" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

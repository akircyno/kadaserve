"use client";

import { X } from "lucide-react";
import type { OrderStatus, StaffOrder } from "@/types/orders";

function peso(value: number) {
  return `\u20B1${Math.round(value).toLocaleString("en-PH")}`;
}

function formatOrderCode(id: string) {
  return `#KD-${id.slice(0, 4).toUpperCase()}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#DCCFB8] bg-white p-4">
      <p className="font-sans text-sm text-[#8C7A64]">{label}</p>
      <p className="mt-2 font-sans text-lg font-semibold text-[#0D2E18]">
        {value}
      </p>
    </div>
  );
}

export function AdminOrderDetailsDrawer({
  onClose,
  order,
}: {
  onClose: () => void;
  order: StaffOrder;
}) {
  const flowStatuses: OrderStatus[] =
    order.order_type === "pickup"
      ? ["pending", "preparing", "ready", "completed"]
      : ["pending", "preparing", "ready", "out_for_delivery", "delivered"];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0D2E18]/35" onClick={onClose} />

      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-[#FFF8EF] shadow-[-18px_0_40px_rgba(13,46,24,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#DCCFB8] px-6 py-5">
          <div>
            <p className="font-sans text-sm uppercase tracking-[0.16em] text-[#684B35]">
              Admin Order Details
            </p>
            <h2 className="mt-2 font-sans text-4xl font-bold text-[#0D2E18]">
              {formatOrderCode(order.id)}
            </h2>
            <p className="mt-2 font-sans text-sm font-semibold text-[#684B35]">
              {getOrderDisplayName(order)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white p-2 text-[#0D2E18]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 font-sans text-sm font-semibold ${getOrderTypeStyle(
                order.order_type
              )}`}
            >
              {formatOrderTypeLabel(order.order_type)}
            </span>
            <span
              className={`rounded-full px-3 py-1 font-sans text-sm font-semibold ${getPaymentStyle(
                order.payment_method
              )}`}
            >
              {formatPaymentMethod(order.payment_method)}
            </span>
            <span
              className={`rounded-full px-3 py-1 font-sans text-sm font-semibold ${getPaymentStatusStyle(
                order.payment_status
              )}`}
            >
              {formatPaymentStatus(order.payment_status)}
            </span>
            <span
              className={`rounded-full px-3 py-1 font-sans text-sm font-semibold ${getStatusStyle(
                order.status
              )}`}
            >
              {formatStatus(order.status)}
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoCard label="Customer" value={getOrderDisplayName(order)} />
            <InfoCard label="Placed at" value={formatDateTime(order.ordered_at)} />
            <InfoCard label="Total" value={peso(order.total_amount)} />
            <InfoCard
              label="Payment"
              value={`${formatPaymentMethod(order.payment_method)} - ${formatPaymentStatus(
                order.payment_status
              )}`}
            />
          </div>

          <div className="mt-5 rounded-[20px] border border-[#DCCFB8] bg-white p-4">
            <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
              Order Flow
            </p>
            <div className="mt-4 space-y-3">
              {flowStatuses.map((status) => {
                const activeStatus = status === order.status;

                return (
                  <div
                    key={status}
                    className="flex items-center gap-3 font-sans text-sm"
                  >
                    <span
                      className={`h-3 w-3 rounded-full ${
                        activeStatus ? "bg-[#0D2E18]" : "bg-[#DCCFB8]"
                      }`}
                    />
                    <span
                      className={
                        activeStatus
                          ? "font-bold text-[#0D2E18]"
                          : "text-[#8C7A64]"
                      }
                    >
                      {formatStatus(status)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {order.order_type === "delivery" ? (
            <div className="mt-5 rounded-[20px] border border-[#DCCFB8] bg-white p-4">
              <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
                Delivery Info
              </p>
              <div className="mt-3 space-y-2 font-sans text-sm text-[#3C332A]">
                <p>
                  <span className="font-semibold">Address:</span>{" "}
                  {order.delivery_address || "No address"}
                </p>
                <p>
                  <span className="font-semibold">Email:</span>{" "}
                  {order.delivery_email || "No email"}
                </p>
                <p>
                  <span className="font-semibold">Phone:</span>{" "}
                  {order.delivery_phone || "No phone"}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
              Order Items
            </p>

            {order.order_items.map((item) => (
              <div
                key={item.id}
                className="rounded-[20px] border border-[#DCCFB8] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-sans text-lg font-semibold text-[#0D2E18]">
                      {item.menu_items?.name ?? "Menu item"} x {item.quantity}
                    </p>
                    <div className="mt-2 space-y-1 font-sans text-sm text-[#5F5346]">
                      <p>
                        Size: {item.size} - Temp: {item.temperature}
                      </p>
                      <p>
                        Sugar: {item.sugar_level}%
                        {item.ice_level ? ` - Ice: ${item.ice_level}` : ""}
                      </p>
                      {item.addons && item.addons.length > 0 ? (
                        <p>Add-ons: {item.addons.join(", ")}</p>
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
      </aside>
    </>
  );
}

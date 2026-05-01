"use client";

import { Check, Copy, X } from "lucide-react";
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

function getStatusStyle(status: OrderStatus) {
  switch (status) {
    case "completed":
    case "delivered":
      return "border border-[#0F441D]/15 bg-[#E6F2E8] text-[#0F441D]";
    case "cancelled":
      return "border border-[#C55432]/15 bg-[#FFF1EC] text-[#C55432]";
    case "out_for_delivery":
      return "border border-[#684B35]/20 bg-[#FFF0DA] text-[#684B35]";
    case "ready":
      return "border border-[#DCCFB8] bg-[#FFF8EF] text-[#684B35]";
    default:
      return "border border-[#DCCFB8] bg-transparent text-[#684B35]";
  }
}

function InfoText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8C7A64]">
        {label}
      </p>
      <p className="mt-1 font-sans text-base font-semibold text-[#0D2E18]">
        {value}
      </p>
    </div>
  );
}

function getContactEmail(order: StaffOrder) {
  return order.customer_profile?.email || order.delivery_email || "No email";
}

function getContactPhone(order: StaffOrder) {
  return order.customer_profile?.phone || order.delivery_phone || "No phone";
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
  const activeStatusIndex = flowStatuses.indexOf(order.status);

  function handleCopyPhone() {
    const phone = getContactPhone(order);

    if (phone !== "No phone") {
      navigator.clipboard?.writeText(phone);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0D2E18]/35" onClick={onClose} />

      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-[#FFF0DA] shadow-[-18px_0_40px_rgba(13,46,24,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#DCCFB8] px-6 py-5">
          <div>
            <p className="font-sans text-sm uppercase tracking-[0.16em] text-[#684B35]">
              Admin Order Details
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-4xl font-bold text-[#0D2E18]">
                {formatOrderCode(order.id)}
              </h2>
              <span
                className={`rounded-full px-3 py-1 font-sans text-sm font-semibold ${getStatusStyle(
                  order.status
                )}`}
              >
                {formatStatus(order.status)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#FFF8EF] p-2 text-[#0D2E18]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <InfoText label="Customer" value={getOrderDisplayName(order)} />
            <InfoText label="Placed at" value={formatDateTime(order.ordered_at)} />
            <InfoText label="Total" value={peso(order.total_amount)} />
            <InfoText
              label="Payment"
              value={`${formatPaymentMethod(order.payment_method)} - ${formatPaymentStatus(
                order.payment_status
              )}`}
            />
          </div>

          <hr className="my-6 border-[#D8C8AA]/70" />

          <section>
            <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
              Order Flow
            </p>
            <div className="mt-4 space-y-3">
              {flowStatuses.map((status, index) => {
                const activeStatus = status === order.status;
                const completedStatus =
                  activeStatusIndex >= 0 && index < activeStatusIndex;
                const dotColor =
                  activeStatus && status === "out_for_delivery"
                    ? "bg-[#684B35]"
                    : activeStatus || completedStatus
                    ? "bg-[#0D2E18]"
                    : "bg-[#DCCFB8]";

                return (
                  <div
                    key={status}
                    className="flex items-center gap-3 font-sans text-sm"
                    >
                      <span
                      className={`h-3 w-3 rounded-full ${dotColor}`}
                    />
                    <span
                      className={
                        activeStatus && status === "out_for_delivery"
                          ? "font-bold text-[#684B35]"
                          : activeStatus
                          ? "font-bold text-[#0D2E18]"
                          : "text-[#8C7A64]"
                      }
                    >
                      {formatStatus(status)}
                    </span>
                    {completedStatus ? (
                      <Check size={14} className="text-[#0D2E18]" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {order.order_type === "delivery" ? (
            <>
              <hr className="my-6 border-[#D8C8AA]/70" />
              <section>
              <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
                Delivery Info
              </p>
              <div className="mt-3 space-y-3 font-sans text-sm text-[#3C332A]">
                <p>
                  <span className="font-semibold">Address:</span>{" "}
                  {order.delivery_address || "No address"}
                </p>
                <p>
                  <span className="font-semibold">Email:</span>{" "}
                  {getContactEmail(order)}
                </p>
                <div className="flex items-center gap-2">
                  <p>
                    <span className="font-semibold">Phone:</span>{" "}
                    {getContactPhone(order)}
                  </p>
                  {getContactPhone(order) !== "No phone" ? (
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="rounded-full p-1 text-[#684B35] transition hover:bg-[#FFF8EF] hover:text-[#0D2E18]"
                      aria-label="Copy phone number"
                    >
                      <Copy size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
              </section>
            </>
          ) : null}

          <hr className="my-6 border-[#D8C8AA]/70" />

          <section className="space-y-4">
            <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
              Order Items
            </p>

            {order.order_items.map((item) => (
              <div
                key={item.id}
                className="border-b border-[#D8C8AA]/70 pb-4 last:border-b-0"
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
          </section>
        </div>
      </aside>
    </>
  );
}

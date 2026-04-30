"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Edit3,
  Pencil,
  Plus,
  ShoppingCart,
  TicketPercent,
  Trash2,
} from "lucide-react";
import { useCart, type CartItem } from "@/features/customer/providers/cart-provider";

function peso(value: number) {
  return `\u20B1${Math.round(value)}`;
}

function formatAddonLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getItemTotal(item: CartItem) {
  return (item.base_price + item.addon_price) * item.quantity;
}

function getVoucherDiscount(subtotal: number, code: string) {
  const normalizedCode = code.trim().toUpperCase();

  if (normalizedCode === "KADA10") {
    return Math.round(subtotal * 0.1);
  }

  if (normalizedCode === "FIRSTSIP") {
    return Math.min(50, subtotal);
  }

  return 0;
}

function getCartUpdatePayload(item: CartItem, specialInstructions: string) {
  return {
    menu_item_id: item.menu_item_id,
    name: item.name,
    base_price: item.base_price,
    quantity: item.quantity,
    sugar_level: item.sugar_level,
    ice_level: item.ice_level,
    size: item.size,
    temperature: item.temperature,
    addons: item.addons,
    addon_price: item.addon_price,
    special_instructions: specialInstructions,
    image_url: item.image_url,
  };
}

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateItem, clearCart } = useCart();

  const [orderType, setOrderType] = useState<"pickup" | "delivery">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isRedirectingToTracking, setIsRedirectingToTracking] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setSelectedItemIds((current) => {
      const existingIds = new Set(items.map((item) => item.id));
      const retainedIds = current.filter((id) => existingIds.has(id));
      const newIds = items
        .map((item) => item.id)
        .filter((id) => !retainedIds.includes(id));

      return [...retainedIds, ...newIds];
    });
  }, [items]);

  useEffect(() => {
    if (orderType === "delivery") {
      setPaymentMethod("cash");
    }
  }, [orderType]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedItemIds.includes(item.id)),
    [items, selectedItemIds]
  );
  const subtotal = selectedItems.reduce((sum, item) => sum + getItemTotal(item), 0);
  const voucherDiscount = getVoucherDiscount(subtotal, voucherCode);
  const grandTotal = Math.max(0, subtotal - voucherDiscount);
  const pointsEarned = Math.floor(grandTotal / 20);
  const cupCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  function toggleSelectedItem(id: string) {
    setSelectedItemIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    );
  }

  function handleRemarkChange(item: CartItem, value: string) {
    updateItem(item.id, getCartUpdatePayload(item, value.slice(0, 220)));
  }

  async function handleCheckout() {
    setError("");
    setSuccessMessage("");

    if (selectedItems.length === 0) {
      setError("Select at least one item before placing your order.");
      return;
    }

    if (orderType === "delivery" && (!deliveryAddress || !deliveryEmail || !deliveryPhone)) {
      setError("Delivery address, email, and phone are required.");
      return;
    }

    setIsCheckingOut(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: selectedItems,
          orderType,
          paymentMethod,
          deliveryAddress,
          deliveryEmail,
          deliveryPhone,
          voucherCode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Checkout failed.");
        return;
      }

      const orderId = result.orderId as string;

      setSuccessMessage(
        `Order placed successfully. Order ID: ${orderId.slice(0, 8).toUpperCase()}`
      );
      setIsRedirectingToTracking(true);
      clearCart();

      setTimeout(() => {
        router.replace(`/customer/orders/${orderId}`);
        router.refresh();
      }, 900);
    } catch {
      setError("Something went wrong during checkout.");
    } finally {
      setIsCheckingOut(false);
    }
  }

  if (isRedirectingToTracking) {
    return (
      <main className="min-h-screen bg-[#FFF0DA] px-4 py-6 text-[#0D2E18]">
        <div className="mx-auto max-w-2xl">
          <section className="rounded-[28px] border border-[#D8C8A7] bg-white p-8 text-center shadow-[0_20px_60px_rgba(13,46,24,0.12)]">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Redirecting to Order Tracking
            </h1>
            <p className="mt-3 font-sans text-base text-[#684B35]">
              Your order was placed successfully. Please wait a moment.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF0DA] px-4 py-6 text-[#0D2E18]">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <Link
            href="/customer?tab=menu"
            className="inline-flex items-center gap-2 rounded-full border border-[#0D2E18]/20 bg-white/75 px-4 py-2 font-sans text-sm font-bold text-[#0D2E18] shadow-sm transition hover:bg-white"
          >
            <ArrowLeft size={16} />
            Back to Menu
          </Link>

          <Link
            href="/customer?tab=menu"
            className="inline-flex items-center gap-2 rounded-full bg-[#0D2E18] px-4 py-2 font-sans text-sm font-bold text-[#FFF0DA] shadow-[0_10px_22px_rgba(13,46,24,0.18)] transition hover:bg-[#0F441D]"
          >
            <Plus size={16} />
            Add Item
          </Link>
        </header>

        <section className="rounded-[28px] border border-[#D8C8A7] bg-white p-5 shadow-[0_18px_45px_rgba(13,46,24,0.10)] sm:p-6">
          <div className="flex flex-col gap-4 border-b border-[#EFE2C9] pb-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
                Delivery Address
              </p>
              <div className="mt-2 flex items-start gap-2">
                <textarea
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Enter full delivery address"
                  className="min-h-16 w-full min-w-0 rounded-[16px] border border-[#E3D3B7] bg-[#FFF8EF] px-4 py-3 font-sans text-sm font-semibold text-[#0D2E18] outline-none placeholder:text-[#9B8A74] md:w-[34rem]"
                />
                <Pencil className="mt-3 h-4 w-4 shrink-0 text-[#0D2E18]" />
              </div>
              <p className="mt-2 font-sans text-sm font-semibold text-[#684B35]">
                Estimated delivery time: 25-40mins
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["pickup", "delivery"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={`rounded-full border px-4 py-2 font-sans text-sm font-bold transition ${
                    orderType === type
                      ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                      : "border-[#D8C8A7] bg-[#FFF8EF] text-[#684B35]"
                  }`}
                >
                  {type === "pickup" ? "Pickup" : "Delivery"}
                </button>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="mt-6 rounded-[22px] bg-[#FFF8EF] p-6 text-center">
              <ShoppingCart className="mx-auto h-9 w-9 text-[#0D2E18]" />
              <p className="mt-3 font-sans text-xl font-bold">Your cart is empty</p>
              <p className="mt-1 font-sans text-sm text-[#684B35]">
                Add a drink from the menu to see it here.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
              <div className="space-y-4">
                {items.map((item) => {
                  const isSelected = selectedItemIds.includes(item.id);

                  return (
                    <article
                      key={item.id}
                      className={`rounded-[22px] border bg-white p-4 shadow-[0_10px_22px_rgba(13,46,24,0.08)] ${
                        isSelected ? "border-[#0D2E18]" : "border-[#E8D9BE]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectedItem(item.id)}
                            aria-label={`Select ${item.name}`}
                            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border font-sans text-xs font-bold ${
                              isSelected
                                ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                                : "border-[#BDAE92] bg-white text-transparent"
                            }`}
                          >
                            ✓
                          </button>

                          <div>
                            <h2 className="font-sans text-xl font-black text-[#0D2E18]">
                              {item.name}
                            </h2>
                            <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-sm text-[#684B35]">
                              <li>Size: {item.size}</li>
                              <li>Sugar level: {item.sugar_level}%</li>
                              <li>Ice level: {item.ice_level ?? "None"}</li>
                              <li>Temperature: {item.temperature}</li>
                              <li>Quantity: {item.quantity}</li>
                            </ul>
                            {item.addons.length > 0 ? (
                              <p className="mt-2 font-sans text-sm text-[#684B35]">
                                Add-ons: {item.addons.map(formatAddonLabel).join(", ")}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <Link
                            href={`/customer/menu/${item.menu_item_id}?cartItemId=${item.id}`}
                            className="inline-flex items-center gap-1 rounded-full bg-[#FFF0DA] px-3 py-1.5 font-sans text-xs font-bold text-[#0D2E18]"
                          >
                            <Edit3 size={13} />
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF1EC] text-[#9C543D]"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <label className="mt-4 block">
                        <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                          Special Remarks
                        </span>
                        <textarea
                          value={item.special_instructions}
                          onChange={(event) => handleRemarkChange(item, event.target.value)}
                          placeholder="Let us know if you have any special request. eg. I need sugar sachet"
                          className="mt-2 min-h-24 w-full rounded-[16px] border border-[#E3D3B7] bg-[#FFF8EF] px-4 py-3 font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                        />
                      </label>

                      <div className="mt-3 text-right font-sans text-xl font-black text-[#765531]">
                        {peso(getItemTotal(item))}
                      </div>
                    </article>
                  );
                })}
              </div>

              <aside className="h-fit space-y-4">
                <section className="rounded-[22px] border border-[#E8D9BE] bg-white p-5 shadow-[0_10px_22px_rgba(13,46,24,0.08)]">
                  <div className="flex items-center gap-2">
                    <TicketPercent className="h-5 w-5 text-[#0D2E18]" />
                    <h2 className="font-sans text-lg font-black">Rewards</h2>
                  </div>

                  <label className="mt-4 block">
                    <span className="font-sans text-sm font-bold text-[#684B35]">
                      Voucher
                    </span>
                    <input
                      value={voucherCode}
                      onChange={(event) => setVoucherCode(event.target.value)}
                      placeholder="Select or Enter Code"
                      className="mt-2 w-full rounded-[16px] border border-[#D8C8A7] bg-[#FFF0DA] px-4 py-3 font-sans text-sm font-bold text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                    />
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {["KADA10", "FIRSTSIP"].map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setVoucherCode(code)}
                        className="rounded-full border border-[#D8C8A7] px-3 py-1.5 font-sans text-xs font-bold text-[#684B35]"
                      >
                        {code}
                      </button>
                    ))}
                  </div>

                  <p className="mt-4 font-sans text-sm font-semibold text-[#2D7A40]">
                    You will earn {pointsEarned} points
                  </p>
                  <p className="mt-1 font-sans text-sm font-semibold text-[#684B35]">
                    Adds {cupCount} cup{cupCount === 1 ? "" : "s"} to your goal
                  </p>
                </section>

                <section className="rounded-[22px] border border-[#E8D9BE] bg-white p-5 shadow-[0_10px_22px_rgba(13,46,24,0.08)]">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-[#0D2E18]" />
                    <h2 className="font-sans text-lg font-black">Payment Details</h2>
                  </div>

                  <div className="mt-4 space-y-3 font-sans text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-[#684B35]">Amount</span>
                      <span className="font-bold">{peso(subtotal)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[#684B35]">Voucher Discount</span>
                      <span className="font-bold">-{peso(voucherDiscount)}</span>
                    </div>
                    <div className="border-t border-[#EFE2C9] pt-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-sans text-sm font-bold text-[#684B35]">
                          Grand Total
                        </span>
                        <span className="font-display text-3xl font-bold text-[#0D2E18]">
                          {peso(grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="font-sans text-sm font-bold text-[#684B35]">
                      Payment Method
                    </p>
                    <div className="mt-2 flex gap-2">
                      {(orderType === "pickup"
                        ? (["cash", "gcash"] as const)
                        : (["cash"] as const)
                      ).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`rounded-full border px-4 py-2 font-sans text-sm font-bold ${
                            paymentMethod === method
                              ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                              : "border-[#D8C8A7] bg-[#FFF8EF] text-[#684B35]"
                          }`}
                        >
                          {method.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {orderType === "delivery" ? (
                    <div className="mt-4 space-y-3">
                      <input
                        type="email"
                        value={deliveryEmail}
                        onChange={(event) => setDeliveryEmail(event.target.value)}
                        placeholder="Delivery email"
                        className="w-full rounded-[16px] border border-[#D8C8A7] bg-[#FFF8EF] px-4 py-3 font-sans text-sm outline-none"
                      />
                      <input
                        type="text"
                        value={deliveryPhone}
                        onChange={(event) => setDeliveryPhone(event.target.value)}
                        placeholder="Contact number"
                        className="w-full rounded-[16px] border border-[#D8C8A7] bg-[#FFF8EF] px-4 py-3 font-sans text-sm outline-none"
                      />
                    </div>
                  ) : null}

                  {error ? (
                    <p className="mt-4 rounded-[14px] bg-[#FFF1EC] px-4 py-3 font-sans text-sm font-semibold text-[#9C543D]">
                      {error}
                    </p>
                  ) : null}

                  {successMessage ? (
                    <p className="mt-4 rounded-[14px] bg-[#E7F4EA] px-4 py-3 font-sans text-sm font-semibold text-[#0F7A40]">
                      {successMessage}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={isCheckingOut || selectedItems.length === 0}
                    className="mt-5 w-full rounded-[18px] bg-[#0D2E18] px-5 py-4 font-sans text-lg font-bold text-[#FFF0DA] shadow-[0_12px_24px_rgba(13,46,24,0.22)] transition hover:bg-[#0F441D] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCheckingOut ? "Processing..." : "Place Order"}
                  </button>
                </section>
              </aside>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

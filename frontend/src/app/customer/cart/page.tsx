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
  Ticket,
  TicketPercent,
  Trash2,
  X,
} from "lucide-react";
import { useCart, type CartItem } from "@/features/customer/providers/cart-provider";
import type { StoreStatusPayload } from "@/lib/store-status";

type RewardVoucher = {
  code: string;
  title: string;
  expiresAt: string;
  value: string;
};

const rewardsWalletStorageKey = "kadaserve_rewards_wallet";

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

  if (normalizedCode === "KADA30") {
    return Math.min(30, subtotal);
  }

  if (normalizedCode === "CREAMYADDON") {
    return Math.min(15, subtotal);
  }

  return 0;
}

function readRewardWallet() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(rewardsWalletStorageKey) ?? "[]"
    ) as RewardVoucher[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDraft, setVoucherDraft] = useState("");
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [storeStatus, setStoreStatus] = useState<StoreStatusPayload | null>(null);
  const [isStoreStatusLoading, setIsStoreStatusLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [rewardWallet, setRewardWallet] = useState<RewardVoucher[]>([]);

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
    setRewardWallet(readRewardWallet());
  }, []);

  useEffect(() => {
    if (orderType === "delivery") {
      setPaymentMethod("cash");
    }
  }, [orderType]);

  useEffect(() => {
    let isMounted = true;

    async function loadStoreStatus() {
      try {
        const response = await fetch("/api/store-status");
        const result = (await response.json()) as StoreStatusPayload;

        if (isMounted && response.ok) {
          setStoreStatus(result);
        }
      } finally {
        if (isMounted) {
          setIsStoreStatusLoading(false);
        }
      }
    }

    loadStoreStatus();
    const intervalId = window.setInterval(loadStoreStatus, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedItemIds.includes(item.id)),
    [items, selectedItemIds]
  );
  const subtotal = selectedItems.reduce((sum, item) => sum + getItemTotal(item), 0);
  const voucherDiscount = getVoucherDiscount(subtotal, voucherCode);
  const grandTotal = Math.max(0, subtotal - voucherDiscount);
  const pointsEarned = Math.floor(grandTotal / 20);
  const cupCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedVoucher = rewardWallet.find(
    (voucher) => voucher.code === voucherCode.trim().toUpperCase()
  );
  const isCheckoutBlocked =
    Boolean(storeStatus) && storeStatus?.effectiveStatus !== "open";

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

  function openVoucherModal() {
    setVoucherDraft(voucherCode);
    setIsVoucherModalOpen(true);
  }

  function applyVoucher(code: string) {
    setVoucherCode(code.trim().toUpperCase());
    setVoucherDraft(code.trim().toUpperCase());
    setIsVoucherModalOpen(false);
  }

  async function handleCheckout() {
    setError("");
    setSuccessMessage("");

    if (selectedItems.length === 0) {
      setError("Select at least one item before placing your order.");
      return;
    }

    if (orderType === "delivery" && !deliveryAddress.trim()) {
      setError("Delivery address is required.");
      return;
    }

    if (isCheckoutBlocked) {
      setError(
        storeStatus?.checkoutBlockedMessage ||
          "Kada Cafe PH is not accepting orders right now."
      );
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
      clearCart();

      router.replace(`/customer?tab=orders&orderId=${orderId}`);
    } catch {
      setError("Something went wrong during checkout.");
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF0DA] px-4 pb-28 pt-5 text-[#0D2E18]">
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

        <section className="space-y-5">
          <div className="flex flex-col gap-4 border-b border-[#D8C8A7] pb-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
                Delivery Address
              </p>
              <div className="mt-2 flex items-start gap-2">
                <textarea
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Enter full delivery address"
                  className="min-h-16 w-full min-w-0 rounded-[16px] border border-[#E3D3B7] bg-white/65 px-4 py-3 font-sans text-sm font-semibold text-[#0D2E18] outline-none placeholder:text-[#9B8A74] md:w-[34rem]"
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
            <div className="py-16 text-center">
              <ShoppingCart className="mx-auto h-9 w-9 text-[#0D2E18]" />
              <p className="mt-3 font-sans text-xl font-bold">Your cart is empty</p>
              <p className="mt-1 font-sans text-sm text-[#684B35]">
                Add a drink from the menu to see it here.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
              <div className="divide-y divide-[#E8D9BE]">
                {items.map((item) => {
                  const isSelected = selectedItemIds.includes(item.id);

                  return (
                    <article
                      key={item.id}
                      className={`py-4 ${
                        isSelected ? "border-l-4 border-[#0D2E18] pl-3" : ""
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
                          className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 font-sans text-xs font-bold text-[#0D2E18]"
                          >
                            <Edit3 size={13} />
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60 text-[#9C543D]"
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
                          className="mt-2 min-h-24 w-full rounded-[16px] border border-[#E3D3B7] bg-white/65 px-4 py-3 font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
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
                <section className="border-t border-[#D8C8A7] pt-5 lg:border-t-0 lg:pt-0">
                  <div className="flex items-center gap-2">
                    <TicketPercent className="h-5 w-5 text-[#0D2E18]" />
                    <h2 className="font-sans text-lg font-black">Rewards</h2>
                  </div>

                  <div className="mt-4 rounded-[16px] border border-[#D8C8A7] bg-white/65 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                          Voucher
                        </p>
                        <p className="mt-1 truncate font-sans text-sm font-black text-[#0D2E18]">
                          {voucherCode
                            ? selectedVoucher?.title ?? voucherCode
                            : "No voucher selected"}
                        </p>
                        {voucherCode ? (
                          <p className="font-sans text-xs font-semibold text-[#684B35]">
                            Code: {voucherCode}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={openVoucherModal}
                        className="shrink-0 rounded-full bg-[#0D2E18] px-4 py-2 font-sans text-xs font-bold text-[#FFF0DA]"
                      >
                        Add Voucher
                      </button>
                    </div>
                  </div>

                  <p className="mt-4 font-sans text-sm font-semibold text-[#2D7A40]">
                    You will earn {pointsEarned} points
                  </p>
                  <p className="mt-1 font-sans text-sm font-semibold text-[#684B35]">
                    Adds {cupCount} cup{cupCount === 1 ? "" : "s"} to your goal
                  </p>
                </section>

                <section className="border-t border-[#D8C8A7] pt-5">
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

                  {storeStatus ? (
                    <div
                      className={`mt-4 rounded-[14px] px-4 py-3 font-sans text-sm font-semibold ${
                        storeStatus.effectiveStatus === "open"
                          ? "bg-[#E7F4EA] text-[#0F7A40]"
                          : "bg-[#FFF1EC] text-[#9C543D]"
                      }`}
                    >
                      {storeStatus.effectiveStatus === "open"
                        ? `Kada Cafe PH is accepting orders. Store hours: ${storeStatus.hoursLabel}.`
                        : storeStatus.checkoutBlockedMessage}
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
                    disabled={
                      isCheckingOut ||
                      isStoreStatusLoading ||
                      isCheckoutBlocked ||
                      selectedItems.length === 0
                    }
                    className="fixed inset-x-4 bottom-5 z-40 rounded-[18px] bg-[#0D2E18] px-5 py-4 font-sans text-lg font-bold text-[#FFF0DA] shadow-[0_12px_24px_rgba(13,46,24,0.22)] transition hover:bg-[#0F441D] disabled:cursor-not-allowed disabled:opacity-60 sm:static sm:mt-5 sm:w-full"
                  >
                    {isCheckingOut
                      ? "Processing..."
                      : isStoreStatusLoading
                      ? "Checking store..."
                      : isCheckoutBlocked
                      ? "Ordering Closed"
                      : "Place Order"}
                  </button>
                </section>
              </aside>
            </div>
          )}
        </section>
      </div>

      {isVoucherModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0D2E18]/45 px-3 backdrop-blur-sm md:items-center md:p-6">
          <section className="w-full max-w-md rounded-t-[28px] border border-[#D8C8A7] bg-white p-5 shadow-[0_-18px_42px_rgba(13,46,24,0.20)] md:rounded-[28px]">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#D8C8A7] md:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
                  Voucher
                </p>
                <h2 className="mt-1 font-sans text-2xl font-black text-[#0D2E18]">
                  Add a voucher
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                aria-label="Close voucher modal"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF0DA] text-[#0D2E18]"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mt-5 block">
              <span className="font-sans text-sm font-bold text-[#684B35]">
                Add a voucher code
              </span>
              <div className="mt-2 flex gap-2">
                <input
                  value={voucherDraft}
                  onChange={(event) => setVoucherDraft(event.target.value)}
                  placeholder="Enter voucher code"
                  className="min-w-0 flex-1 rounded-[16px] border border-[#D8C8A7] bg-[#FFF0DA] px-4 py-3 font-sans text-sm font-bold uppercase text-[#0D2E18] outline-none placeholder:normal-case placeholder:text-[#9B8A74]"
                />
                <button
                  type="button"
                  onClick={() => applyVoucher(voucherDraft)}
                  disabled={!voucherDraft.trim()}
                  className="rounded-[16px] bg-[#0D2E18] px-4 py-3 font-sans text-sm font-bold text-[#FFF0DA] disabled:cursor-not-allowed disabled:bg-[#D8C8A7]"
                >
                  Apply
                </button>
              </div>
            </label>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-[#EFE2C9]" />
              <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#9B8A74]">
                Or
              </span>
              <span className="h-px flex-1 bg-[#EFE2C9]" />
            </div>

            <div>
              <h3 className="font-sans text-lg font-black text-[#0D2E18]">
                Redeem Vouchers with KadaServe Points
              </h3>

              {rewardWallet.length > 0 ? (
                <div className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
                  {rewardWallet.map((voucher) => (
                    <button
                      key={voucher.code}
                      type="button"
                      onClick={() => applyVoucher(voucher.code)}
                      className={`w-full rounded-[18px] border p-4 text-left transition ${
                        voucherCode === voucher.code
                          ? "border-[#0D2E18] bg-[#FFF0DA]"
                          : "border-[#E8D9BE] bg-[#FFF8EF]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-sans text-base font-black text-[#0D2E18]">
                            {voucher.title}
                          </p>
                          <p className="mt-1 font-sans text-xs font-semibold text-[#684B35]">
                            Code: {voucher.code}
                          </p>
                          <p className="font-sans text-xs text-[#8C7A64]">
                            Expires {voucher.expiresAt}
                          </p>
                        </div>
                        <TicketPercent className="h-6 w-6 text-[#0D2E18]" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[20px] bg-[#FFF8EF] px-5 py-8 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E1E6D9] text-white">
                    <Ticket className="h-10 w-10" />
                  </div>
                  <p className="mt-4 font-sans text-lg font-black text-[#0D2E18]">
                    No Available Voucher
                  </p>
                  <p className="mt-1 font-sans text-sm leading-6 text-[#684B35]">
                    Complete missions or redeem rewards with points to unlock your first voucher.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVoucherModalOpen(false);
                      router.push("/customer?tab=rewards");
                    }}
                    className="mt-4 rounded-full bg-[#0D2E18] px-5 py-3 font-sans text-sm font-bold text-[#FFF0DA]"
                  >
                    Go to Rewards
                  </button>
                </div>
              )}
            </div>

            {voucherCode ? (
              <button
                type="button"
                onClick={() => {
                  setVoucherCode("");
                  setVoucherDraft("");
                  setIsVoucherModalOpen(false);
                }}
                className="mt-4 w-full rounded-full border border-[#D8C8A7] px-4 py-3 font-sans text-sm font-bold text-[#684B35]"
              >
                Remove selected voucher
              </button>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bike,
  CreditCard,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  ShoppingCart,
  Store,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DeliveryLocationPicker } from "@/features/customer/components/delivery-location-picker";
import { useCart, type CartItem } from "@/features/customer/providers/cart-provider";
import {
  getDistanceBasedDeliveryFee,
  hasDeliveryCoordinates,
} from "@/lib/delivery-fee";
import type { StoreStatusPayload } from "@/lib/store-status";

type CustomerAddress = {
  id: string;
  address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  is_default: boolean;
};

const isPayMongoCheckoutEnabled =
  process.env.NEXT_PUBLIC_ENABLE_PAYMONGO_CHECKOUT === "true";

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

function getCartUpdatePayload(item: CartItem, specialInstructions: string) {
  return {
    menu_item_id: item.menu_item_id,
    name: item.name,
    category: item.category,
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

function formatSweetnessLevel(value: number) {
  return value === 0 ? "No Sugar" : `${value}% Sugar`;
}

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateItem, clearCart } = useCart();
  const deliveryAddressRef = useRef<HTMLTextAreaElement | null>(null);

  const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressMessage, setAddressMessage] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [storeStatus, setStoreStatus] = useState<StoreStatusPayload | null>(null);
  const [isStoreStatusLoading, setIsStoreStatusLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isReturningToMenu, setIsReturningToMenu] = useState(false);

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

  async function loadSavedAddresses() {
    try {
      const response = await fetch("/api/customer/addresses");

      if (!response.ok) {
        return;
      }

      const result = (await response.json()) as {
        addresses?: CustomerAddress[];
      };
      const addresses = result.addresses ?? [];
      const defaultAddress =
        addresses.find((address) => address.is_default) ?? addresses[0];

      setSavedAddresses(addresses);

      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
        setDeliveryAddress((current) => current || defaultAddress.address);
        setDeliveryLat((current) => current ?? defaultAddress.delivery_lat);
        setDeliveryLng((current) => current ?? defaultAddress.delivery_lng);
      }
    } catch {
      // Checkout still works when saved addresses are unavailable.
    }
  }

  useEffect(() => {
    loadSavedAddresses();
  }, []);

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
  const deliveryFeeQuote =
    orderType === "delivery" && hasDeliveryCoordinates(deliveryLat, deliveryLng)
      ? getDistanceBasedDeliveryFee(deliveryLat as number, deliveryLng as number)
      : null;
  const deliveryFeeLabel =
    orderType === "delivery"
      ? deliveryFeeQuote?.isDeliverable && deliveryFeeQuote.fee !== null
        ? `${peso(deliveryFeeQuote.fee)} (${
            deliveryFeeQuote.distanceKm?.toFixed(1) ?? "0.0"
          } km)`
        : deliveryFeeQuote && !deliveryFeeQuote.isDeliverable
        ? `Outside ${deliveryFeeQuote.maxDeliveryDistanceKm} km range`
        : "Pin address to calculate"
      : peso(0);
  const deliveryFee =
    orderType === "delivery" && deliveryFeeQuote?.isDeliverable
      ? deliveryFeeQuote.fee ?? 0
      : 0;
  const grandTotal = Math.max(0, subtotal + deliveryFee);
  const cupCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedSavedAddress =
    savedAddresses.find((address) => address.id === selectedAddressId) ?? null;
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

  function handleQuantityChange(item: CartItem, delta: number) {
    const nextQuantity = Math.max(1, item.quantity + delta);

    updateItem(item.id, {
      ...getCartUpdatePayload(item, item.special_instructions),
      quantity: nextQuantity,
    });
  }

  function openAddressPicker() {
    setAddressMessage("");
    setIsAddressPickerOpen(true);
  }

  function useAnotherDeliveryAddress() {
    setSelectedAddressId(null);
    setDeliveryAddress("");
    setDeliveryLat(null);
    setDeliveryLng(null);
    setIsAddressPickerOpen(false);
    window.setTimeout(() => {
      deliveryAddressRef.current?.focus();
    }, 0);
  }

  function selectSavedAddress(address: CustomerAddress) {
    setSelectedAddressId(address.id);
    setDeliveryAddress(address.address);
    setDeliveryLat(address.delivery_lat);
    setDeliveryLng(address.delivery_lng);
    setIsAddressPickerOpen(false);
  }

  async function saveCurrentAddress(isDefault = false) {
    setAddressMessage("");

    if (!deliveryAddress.trim()) {
      setAddressMessage("Type or pin an address first.");
      return;
    }

    setIsSavingAddress(true);

    try {
      const response = await fetch("/api/customer/addresses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: deliveryAddress.trim(),
          deliveryLat,
          deliveryLng,
          isDefault,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setAddressMessage(result.error || "Failed to save address.");
        return;
      }

      const savedAddress = result.address as CustomerAddress;
      setSavedAddresses((current) => [
        savedAddress,
        ...current
          .filter((address) => address.id !== savedAddress.id)
          .map((address) =>
            savedAddress.is_default ? { ...address, is_default: false } : address
          ),
      ]);
      selectSavedAddress(savedAddress);
      setAddressMessage("Address saved.");
    } catch {
      setAddressMessage("Something went wrong while saving address.");
    } finally {
      setIsSavingAddress(false);
    }
  }

  async function setDefaultAddress(address: CustomerAddress) {
    setAddressMessage("");
    setIsSavingAddress(true);

    try {
      const response = await fetch("/api/customer/addresses", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: address.id,
          isDefault: true,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setAddressMessage(result.error || "Failed to set default address.");
        return;
      }

      const updatedAddress = result.address as CustomerAddress;
      setSavedAddresses((current) =>
        current.map((item) => ({
          ...item,
          is_default: item.id === updatedAddress.id,
        }))
      );
      selectSavedAddress(updatedAddress);
      setAddressMessage("Default address updated.");
    } catch {
      setAddressMessage("Something went wrong while updating address.");
    } finally {
      setIsSavingAddress(false);
    }
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

    if (orderType === "delivery" && !hasDeliveryCoordinates(deliveryLat, deliveryLng)) {
      setError("Pin your delivery location on the map to calculate the delivery fee.");
      return;
    }

    if (orderType === "delivery" && deliveryFeeQuote && !deliveryFeeQuote.isDeliverable) {
      setError(
        `Delivery is available within ${deliveryFeeQuote.maxDeliveryDistanceKm} km of the cafe.`
      );
      return;
    }

    if (isCheckoutBlocked) {
      setError(
        storeStatus?.checkoutBlockedMessage ||
          "Kada Cafe PH is not accepting orders right now."
      );
      return;
    }

    if (paymentMethod === "online" && !isPayMongoCheckoutEnabled) {
      setError("Online payment is coming soon. Please choose cash for now.");
      setPaymentMethod("cash");
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
          deliveryPhone: deliveryPhone.trim(),
          deliveryLat,
          deliveryLng,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Checkout failed.");
        return;
      }

      const orderId = result.orderId as string;
      const checkoutUrl =
        typeof result.checkoutUrl === "string" ? result.checkoutUrl : "";

      if (checkoutUrl) {
        setSuccessMessage("Redirecting to PayMongo checkout...");
        clearCart();
        window.location.assign(checkoutUrl);
        return;
      }

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

  function handleBackToMenu() {
    setIsAddressPickerOpen(false);
    setIsReturningToMenu(true);
    window.sessionStorage.setItem("kadaserve_skip_customer_splash", "true");
    router.push("/customer?tab=menu");
  }

  return (
    <main className="min-h-screen bg-[#FFF0DA] px-4 pb-28 pt-5 text-[#0D2E18]">
      {isReturningToMenu ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#FFF0DA]">
          <div
            aria-label="Loading menu"
            className="h-12 w-12 animate-spin rounded-full border-4 border-[#DCCFB8] border-t-[#0D2E18]"
          />
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBackToMenu}
            className="inline-flex items-center gap-2 rounded-full border border-[#0D2E18]/20 bg-white/75 px-4 py-2 font-sans text-sm font-bold text-[#0D2E18] shadow-sm transition hover:bg-white"
          >
            <ArrowLeft size={16} />
            Back to Menu
          </button>

          <Link
            href="/customer?tab=menu"
            className="inline-flex items-center gap-2 rounded-full bg-[#0D2E18] px-4 py-2 font-sans text-sm font-bold text-[#FFF0DA] shadow-[0_10px_22px_rgba(13,46,24,0.18)] transition hover:bg-[#0F441D]"
          >
            <Plus size={16} />
            Add Item
          </Link>
        </header>

        <section className="space-y-5">
          <div className="space-y-4 border-b border-[#D8C8A7] pb-5">
            <div className="space-y-3">
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
                  Checkout
                </p>
                <h1 className="mt-1 font-sans text-2xl font-black text-[#0D2E18]">
                  Choose how you want to receive your order
                </h1>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["pickup", "delivery"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setOrderType(method);
                      setError("");
                    }}
                    className={`flex min-h-20 items-center gap-3 rounded-[18px] border px-4 py-3 text-left font-sans transition ${
                      orderType === method
                        ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA] shadow-[0_12px_24px_rgba(13,46,24,0.14)]"
                        : "border-[#D8C8A7] bg-[#FFF8EF] text-[#684B35] hover:bg-white"
                    }`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                        orderType === method
                          ? "bg-white/12 text-[#FFF0DA]"
                          : "bg-white text-[#0D2E18]"
                      }`}
                    >
                      {method === "pickup" ? (
                        <Store className="h-5 w-5" />
                      ) : (
                        <Bike className="h-5 w-5" />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-black text-current">
                        {method === "pickup" ? "Pickup" : "Delivery"}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs font-semibold ${
                          orderType === method
                            ? "text-[#FFF0DA]/78"
                            : "text-[#8A755D]"
                        }`}
                      >
                        {method === "pickup"
                          ? "Claim your order at the cafe counter."
                          : "Pin your location and pay on delivery."}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {orderType === "delivery" ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
                    Delivery Address
                  </p>
                  {selectedSavedAddress?.is_default ? (
                    <span className="rounded-full bg-[#E9F5E7] px-2.5 py-1 font-sans text-[11px] font-bold text-[#2D7A40]">
                      Default Address
                    </span>
                  ) : selectedSavedAddress ? (
                    <span className="rounded-full bg-[#FFF8EF] px-2.5 py-1 font-sans text-[11px] font-bold text-[#684B35]">
                      Saved Address
                    </span>
                  ) : deliveryAddress.trim() ? (
                    <span className="rounded-full bg-[#FFF8EF] px-2.5 py-1 font-sans text-[11px] font-bold text-[#684B35]">
                      Another Address
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-start gap-2">
                  <textarea
                    ref={deliveryAddressRef}
                    value={deliveryAddress}
                    onChange={(event) => {
                      setDeliveryAddress(event.target.value);
                      setSelectedAddressId(null);
                    }}
                    placeholder="Enter full delivery address"
                    className="min-h-16 w-full min-w-0 rounded-[16px] border border-[#E3D3B7] bg-white/65 px-4 py-3 font-sans text-sm font-semibold text-[#0D2E18] outline-none placeholder:text-[#9B8A74] md:w-[34rem]"
                  />
                  <button
                    type="button"
                    onClick={openAddressPicker}
                    title="Choose delivery address"
                    aria-label="Choose delivery address"
                    className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D8C8A7] bg-[#FFF8EF] text-[#0D2E18] transition hover:bg-white"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                {!isAddressPickerOpen ? (
                  <DeliveryLocationPicker
                    lat={deliveryLat}
                    lng={deliveryLng}
                    onChange={(location) => {
                      setDeliveryLat(location.lat);
                      setDeliveryLng(location.lng);
                      setSelectedAddressId(null);

                      if (location.address) {
                        setDeliveryAddress(location.address);
                      }
                    }}
                  />
                ) : null}
                <label className="mt-3 block">
                  <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                    Phone Number <span className="normal-case tracking-normal text-[#8C7A64]">(optional)</span>
                  </span>
                  <div className="mt-2 flex items-center rounded-[16px] border border-[#E3D3B7] bg-white/65 px-4 py-3 transition focus-within:border-[#0D2E18] focus-within:ring-2 focus-within:ring-[#0D2E18]/10">
                    <Phone className="mr-3 h-4 w-4 shrink-0 text-[#8C7A64]" />
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={deliveryPhone}
                      onChange={(event) => setDeliveryPhone(event.target.value)}
                      placeholder="Optional contact number"
                      className="min-w-0 flex-1 bg-transparent font-sans text-sm font-semibold text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                    />
                  </div>
                </label>
                <p className="mt-2 font-sans text-sm font-semibold text-[#684B35]">
                  Estimated delivery time: 25-40mins
                </p>
              </div>
            ) : (
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
                  Pickup
                </p>
                <h1 className="mt-1 font-sans text-2xl font-black text-[#0D2E18]">
                  Claim at the counter
                </h1>
              </div>
            )}
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
                      {(() => {
                        const isPastry = item.category === "pastries";

                        return (
                          <>
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
                            {isPastry ? (
                              <p className="mt-2 font-sans text-sm text-[#684B35]">
                                Quantity: {item.quantity}
                              </p>
                            ) : (
                              <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-sm text-[#684B35]">
                                <li>Size: {item.size}</li>
                                <li>Sweetness: {formatSweetnessLevel(item.sugar_level)}</li>
                                <li>Ice level: {item.ice_level ?? "None"}</li>
                                <li>Temperature: {item.temperature}</li>
                                <li>Quantity: {item.quantity}</li>
                              </ul>
                            )}
                            {item.addons.length > 0 ? (
                              <p className="mt-2 font-sans text-sm text-[#684B35]">
                                Add-ons: {item.addons.map(formatAddonLabel).join(", ")}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
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

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center rounded-full border border-[#D8C8A7] bg-white/70 p-1">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF8EF] text-[#0D2E18]"
                            aria-label={`Decrease ${item.name}`}
                          >
                            -
                          </button>
                          <span className="min-w-10 text-center font-sans text-sm font-black text-[#0D2E18]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF8EF] text-[#0D2E18]"
                            aria-label={`Increase ${item.name}`}
                          >
                            +
                          </button>
                        </div>

                        <span className="rounded-full bg-[#FFF8EF] px-4 py-2 font-sans text-base font-black text-[#765531]">
                          {peso(getItemTotal(item))}
                        </span>
                      </div>

                      {!isPastry ? (
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
                      ) : null}

                          </>
                        );
                      })()}
                    </article>
                  );
                })}
              </div>

              <aside className="h-fit space-y-4">
                <section className="rounded-[24px] border border-[#D8C8A7] bg-[#FFF8EF] p-5 shadow-[0_14px_30px_rgba(13,46,24,0.08)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0D2E18] text-[#FFF0DA]">
                        <ReceiptText className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
                          Summary
                        </p>
                        <h2 className="font-sans text-lg font-black text-[#0D2E18]">
                          Payment Details
                        </h2>
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 font-sans text-xs font-bold text-[#684B35]">
                      {cupCount} item{cupCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3 font-sans text-sm">
                    <div className="flex justify-between gap-4 rounded-[14px] bg-white/70 px-4 py-3">
                      <span className="text-[#684B35]">Amount</span>
                      <span className="font-black text-[#0D2E18]">{peso(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-[14px] bg-white/70 px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-[#684B35]">
                        <MapPin className="h-4 w-4" />
                        Delivery Fee
                      </span>
                      <span className="text-right font-black text-[#0D2E18]">
                        {deliveryFeeLabel}
                      </span>
                    </div>
                    <div className="border-t border-[#D8C8A7] pt-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-sans text-sm font-bold text-[#684B35]">
                          Grand Total
                        </span>
                        <span className="font-sans text-3xl font-black tabular-nums text-[#0D2E18]">
                          {peso(grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="font-sans text-sm font-bold text-[#684B35]">
                      Payment Method
                    </p>
                    <div className="mt-2 grid gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        className={`flex items-center gap-3 rounded-[16px] border px-4 py-3 text-left font-sans transition ${
                          paymentMethod === "cash"
                            ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                            : "border-[#D8C8A7] bg-white text-[#684B35] hover:border-[#0D2E18]/40"
                        }`}
                      >
                        <CreditCard className="h-5 w-5 shrink-0" />
                        <span>
                          <span className="block text-sm font-black">
                            {orderType === "delivery"
                              ? "Cash on Delivery"
                              : "Pay at Cafe"}
                          </span>
                          <span className="mt-0.5 block text-xs font-semibold opacity-75">
                            Settle payment when the order is received.
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isPayMongoCheckoutEnabled) {
                            setPaymentMethod("online");
                            return;
                          }

                          setPaymentMethod("cash");
                          setError(
                            "Online payment is coming soon. Please choose cash for now."
                          );
                        }}
                        disabled={!isPayMongoCheckoutEnabled}
                        title={
                          isPayMongoCheckoutEnabled
                            ? "Pay with GCash, Maya, or card"
                            : "Online payment is coming soon"
                        }
                        className={`flex items-center gap-3 rounded-[16px] border px-4 py-3 text-left font-sans transition ${
                          paymentMethod === "online"
                            ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                            : "border-[#D8C8A7] bg-white text-[#684B35] hover:border-[#0D2E18]/40"
                        } disabled:cursor-not-allowed disabled:opacity-55`}
                      >
                        <WalletCards className="h-5 w-5 shrink-0" />
                        <span>
                          <span className="block text-sm font-black">
                            Online Payment
                          </span>
                          <span className="mt-0.5 block text-xs font-semibold opacity-75">
                            GCash, Maya, or card through PayMongo.
                          </span>
                        </span>
                      </button>
                    </div>
                    {paymentMethod === "online" ? (
                      <p className="mt-2 font-sans text-xs font-semibold leading-5 text-[#8A755D]">
                        You will pay through PayMongo using GCash, Maya, or card.
                        Your order stays pending until payment is confirmed.
                      </p>
                    ) : !isPayMongoCheckoutEnabled ? (
                      <p className="mt-2 font-sans text-xs font-semibold leading-5 text-[#8A755D]">
                        Online payment is ready in code and will be enabled after
                        the PayMongo account is approved.
                      </p>
                    ) : null}
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
                    {isCheckingOut || isStoreStatusLoading ? (
                      <LoadingSpinner
                        className="mr-2 h-5 w-5 align-[-0.2em]"
                        label={isCheckingOut ? "Processing order" : "Checking store"}
                      />
                    ) : null}
                    {isCheckingOut
                      ? paymentMethod === "online"
                        ? "Creating Payment..."
                        : "Processing..."
                      : isStoreStatusLoading
                      ? "Checking store..."
                      : isCheckoutBlocked
                      ? "Ordering Closed"
                      : paymentMethod === "online"
                      ? "Pay Online"
                      : "Place Order"}
                  </button>
                </section>
              </aside>
            </div>
          )}
        </section>
      </div>

      {isAddressPickerOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0D2E18]/45 px-3 backdrop-blur-sm md:items-center md:p-6">
          <section className="w-full max-w-lg rounded-t-[28px] border border-[#D8C8A7] bg-white p-5 shadow-[0_-18px_42px_rgba(13,46,24,0.20)] md:rounded-[28px]">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#D8C8A7] md:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
                  Delivery Address
                </p>
                <h2 className="mt-1 font-sans text-2xl font-black text-[#0D2E18]">
                  Choose address
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddressPickerOpen(false)}
                aria-label="Close address picker"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF0DA] text-[#0D2E18]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 max-h-[46vh] space-y-3 overflow-y-auto pr-1">
              {savedAddresses.length > 0 ? (
                savedAddresses.map((address) => (
                  <article
                    key={address.id}
                    className={`rounded-[18px] border p-4 ${
                      selectedAddressId === address.id
                        ? "border-[#0D2E18] bg-[#FFF0DA]"
                        : "border-[#E8D9BE] bg-[#FFF8EF]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {address.is_default ? (
                            <span className="rounded-full bg-[#E9F5E7] px-2.5 py-1 font-sans text-[11px] font-bold text-[#2D7A40]">
                              Default
                            </span>
                          ) : null}
                          {selectedAddressId === address.id ? (
                            <span className="rounded-full bg-white px-2.5 py-1 font-sans text-[11px] font-bold text-[#684B35]">
                              Selected
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 font-sans text-sm font-semibold leading-6 text-[#0D2E18]">
                          {address.address}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => selectSavedAddress(address)}
                        className="rounded-full bg-[#0D2E18] px-4 py-2 font-sans text-xs font-bold text-[#FFF0DA]"
                      >
                        Use this address
                      </button>
                      {!address.is_default ? (
                        <button
                          type="button"
                          onClick={() => setDefaultAddress(address)}
                          disabled={isSavingAddress}
                          className="rounded-full border border-[#D8C8A7] bg-white px-4 py-2 font-sans text-xs font-bold text-[#684B35] disabled:cursor-wait disabled:opacity-60"
                        >
                          Set default address
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[18px] border border-dashed border-[#D8C8A7] bg-[#FFF8EF] px-4 py-8 text-center">
                  <p className="font-sans text-sm font-bold text-[#0D2E18]">
                    No saved addresses yet.
                  </p>
                  <p className="mt-1 font-sans text-xs text-[#684B35]">
                    Type an address or use the map pin, then save it here.
                  </p>
                </div>
              )}
            </div>

            {addressMessage ? (
              <p className="mt-4 rounded-[14px] bg-[#FFF0DA] px-4 py-3 font-sans text-sm font-semibold text-[#684B35]">
                {addressMessage}
              </p>
            ) : null}

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => saveCurrentAddress(false)}
                disabled={isSavingAddress || !deliveryAddress.trim()}
                className="rounded-[16px] border border-[#D8C8A7] bg-[#FFF8EF] px-4 py-3 font-sans text-sm font-bold text-[#0D2E18] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save current
              </button>
              <button
                type="button"
                onClick={() => saveCurrentAddress(true)}
                disabled={isSavingAddress || !deliveryAddress.trim()}
                className="rounded-[16px] bg-[#0D2E18] px-4 py-3 font-sans text-sm font-bold text-[#FFF0DA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save as default
              </button>
              <button
                type="button"
                onClick={useAnotherDeliveryAddress}
                className="rounded-[16px] border border-[#D8C8A7] px-4 py-3 font-sans text-sm font-bold text-[#684B35]"
              >
                Use another
              </button>
            </div>
          </section>
        </div>
      ) : null}

    </main>
  );
}

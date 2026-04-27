"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/features/customer/providers/cart-provider";

function peso(value: number) {
  return `₱${Math.round(value)}`;
}

function formatAddonLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, clearCart } = useCart();

  const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash");

    useEffect(() => {
    if (orderType === "delivery") {
      setPaymentMethod("cash");
    }
  }, [orderType]);

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isRedirectingToTracking, setIsRedirectingToTracking] = useState(false);

  
    useEffect(() => {
    setSelectedItemIds(items.map((item) => item.id));
  }, [items]);

    function toggleSelectedItem(id: string) {
    setSelectedItemIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    );
  }

  const selectedItems = items.filter((item) => selectedItemIds.includes(item.id));


  const total = selectedItems.reduce(
    (sum, item) => sum + (item.base_price + item.addon_price) * item.quantity,
    0
  );

  async function handleCheckout() {
    setError("");
    setSuccessMessage("");
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
      <main className="min-h-screen bg-[#F8EBCF] px-4 py-6 text-[#123E26]">
        <div className="mx-auto max-w-2xl">
          <section className="rounded-[32px] border border-[#D8C8A7] bg-[#FAECD3] p-8 text-center shadow-[0_20px_60px_rgba(11,46,24,0.16)]">
            <h1 className="text-3xl font-black tracking-tight">
              Redirecting to Order Tracking
            </h1>
            <p className="mt-3 text-base text-[#5D694F]">
              Your order was placed successfully. Please wait a moment.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8EBCF] px-4 py-6 text-[#123E26]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link
            href="/customer"
            className="inline-flex items-center gap-2 rounded-full bg-[#0B3F22] px-4 py-2 text-sm font-semibold text-[#FFF0D8]"
          >
            <ArrowLeft size={16} />
            Back to Menu
          </Link>

          {items.length > 0 ? (
            <button
              type="button"
              onClick={clearCart}
              className="rounded-full border border-[#0B3F22] px-4 py-2 text-sm font-semibold text-[#0B3F22]"
            >
              Clear Cart
            </button>
          ) : null}
        </div>

        <section className="rounded-[32px] border border-[#D8C8A7] bg-[#FAECD3] p-6 shadow-[0_20px_60px_rgba(11,46,24,0.16)]">
          <div className="flex items-center gap-3">
            <ShoppingCart className="text-[#0B3F22]" />
            <h1 className="text-4xl font-black tracking-tight">My Cart</h1>
          </div>

          {items.length === 0 ? (
            <div className="mt-6 rounded-[24px] bg-white/80 p-6">
              <p className="text-xl font-bold">Your cart is empty</p>
              <p className="mt-2 text-[#5D694F]">
                Add a drink from the menu to see it here.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 space-y-4">
                                {items.map((item) => {
                  const isSelected = selectedItemIds.includes(item.id);

                  return (
                    <article
                      key={item.id}
                      className={`rounded-[24px] p-5 shadow-[0_8px_20px_rgba(0,0,0,0.08)] ${
                        isSelected
                          ? "border-2 border-[#123E26] bg-white/95"
                          : "border border-[#E6D8BD] bg-white/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectedItem(item.id)}
                            className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                              isSelected
                                ? "border-[#123E26] bg-[#123E26] text-white"
                                : "border-[#A9997C] bg-white text-transparent"
                            }`}
                          >
                            ✓
                          </button>

                          <div>
                            <h2 className="text-2xl font-bold">{item.name}</h2>
                            <p className="mt-1 text-sm text-[#6F634E]">
                              Qty {item.quantity} • {item.size} • {item.temperature}
                            </p>
                            <p className="mt-1 text-sm text-[#6F634E]">
                              Sugar {item.sugar_level}%
                              {item.ice_level ? ` • Ice ${item.ice_level}` : ""}
                            </p>

                            {item.addons.length > 0 ? (
                              <p className="mt-1 text-sm text-[#6F634E]">
                                Add-ons:{" "}
                                {item.addons.map(formatAddonLabel).join(", ")}
                              </p>
                            ) : null}

                            {item.special_instructions ? (
                              <p className="mt-1 text-sm text-[#6F634E]">
                                Note: {item.special_instructions}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-3">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FBE9E2] text-[#9C543D]"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 text-right text-2xl font-black text-[#765531]">
                        {peso((item.base_price + item.addon_price) * item.quantity)}
                      </div>
                    </article>
                  );
                })}``
              </div>

              <div className="mt-6 rounded-[24px] bg-white/80 p-5 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
                <h2 className="text-xl font-bold">Order Details</h2>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-[#5D694F]">Order Type</p>
                  <div className="mt-2 flex gap-3">
                    {(["pickup", "delivery"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setOrderType(type)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                          orderType === type
                            ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                            : "border-[#708061] bg-transparent text-[#123E26]"
                        }`}
                      >
                        {type === "pickup" ? "Pickup" : "Delivery"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-[#5D694F]">Payment Method</p>

                  <div className="mt-2 flex gap-3">
                    {(orderType === "pickup"
                      ? (["cash", "gcash"] as const)
                      : (["cash"] as const)
                    ).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                          paymentMethod === method
                            ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                            : "border-[#708061] bg-transparent text-[#123E26]"
                        }`}
                      >
                        {method.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>


                {orderType === "delivery" ? (
                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#5D694F]">
                        Delivery Address
                      </label>
                      <textarea
                        value={deliveryAddress}
                        onChange={(event) => setDeliveryAddress(event.target.value)}
                        className="min-h-24 w-full rounded-[18px] border border-[#D8C8A7] bg-white px-4 py-3 outline-none"
                        placeholder="Enter full delivery address"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#5D694F]">
                        Email
                      </label>
                      <input
                        type="email"
                        value={deliveryEmail}
                        onChange={(event) => setDeliveryEmail(event.target.value)}
                        className="w-full rounded-[18px] border border-[#D8C8A7] bg-white px-4 py-3 outline-none"
                        placeholder="Enter delivery email"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#5D694F]">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={deliveryPhone}
                        onChange={(event) => setDeliveryPhone(event.target.value)}
                        className="w-full rounded-[18px] border border-[#D8C8A7] bg-white px-4 py-3 outline-none"
                        placeholder="Enter contact number"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 rounded-[24px] bg-[#0B3F22] p-5 text-[#FFF0D8]">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-3xl font-black">{peso(total)}</span>
                </div>

                {error ? (
                  <p className="mt-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}

                {successMessage ? (
                  <p className="mt-4 rounded-xl bg-green-100 px-4 py-3 text-sm text-green-700">
                    {successMessage}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="mt-4 w-full rounded-[18px] bg-[#FFF0D8] px-5 py-4 text-lg font-bold text-[#0B3F22] disabled:opacity-60"
                >
                  {isCheckingOut ? "Processing..." : "Proceed to Checkout"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

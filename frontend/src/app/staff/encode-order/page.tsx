"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, Trash2 } from "lucide-react";

type Category =
  | "all"
  | "non-coffee"
  | "pastries"
  | "latte-series"
  | "premium-blends"
  | "best-deals";

type OrderType = "pickup" | "delivery";
type Size = "regular" | "large";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: Exclude<Category, "all">;
  imageUrl: string | null;
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  category: Exclude<Category, "all">;
  size: Size;
  quantity: number;
};

const categoryButtons: Array<{ key: Category; label: string }> = [
  { key: "all", label: "ALL" },
  { key: "non-coffee", label: "NON-COFFEE" },
  { key: "pastries", label: "PASTRIES" },
  { key: "latte-series", label: "LATTE SERIES" },
  { key: "premium-blends", label: "PREMIUM BLENDS" },
  { key: "best-deals", label: "BEST DEALS" },
];

function formatPrice(value: number) {
  return Math.round(value);
}

function itemUsesSize(category: CartItem["category"] | MenuItem["category"]) {
  return !["pastries", "best-deals"].includes(category);
}

export default function StaffEncodeOrderPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [orderType, setOrderType] = useState<OrderType>("pickup");
  const [selectedSizes, setSelectedSizes] = useState<Record<string, Size>>({});
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number>
  >({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesCategory =
        activeCategory === "all" || item.category === activeCategory;

      const matchesSearch =
        !keyword || item.name.toLowerCase().includes(keyword);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, menuItems, search]);

  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  useEffect(() => {
    loadMenuItems();
  }, []);

  async function loadMenuItems() {
    setIsLoadingMenu(true);
    setError("");

    try {
      const response = await fetch("/api/staff/menu", {
        method: "GET",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to load menu items.");
        return;
      }

      setMenuItems(result.menuItems ?? []);
    } catch {
      setError("Something went wrong while loading menu items.");
    } finally {
      setIsLoadingMenu(false);
    }
  }

  function getSelectedSize(itemId: string) {
    return selectedSizes[itemId] ?? "regular";
  }

  function getSelectedQuantity(itemId: string) {
    return selectedQuantities[itemId] ?? 0;
  }

  function setItemSize(itemId: string, size: Size) {
    setSelectedSizes((prev) => ({
      ...prev,
      [itemId]: size,
    }));
  }

  function changeItemQuantity(itemId: string, delta: number) {
    setSelectedQuantities((prev) => {
      const current = prev[itemId] ?? 0;
      const next = Math.max(0, current + delta);

      return {
        ...prev,
        [itemId]: next,
      };
    });
  }

  function addToCart(item: MenuItem) {
    const quantity = getSelectedQuantity(item.id);
    const size = itemUsesSize(item.category) ? getSelectedSize(item.id) : "regular";

    if (quantity <= 0) return;

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (cartItem) => cartItem.id === item.id && cartItem.size === size
      );

      if (existingIndex >= 0) {
        const next = [...prev];

        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
        };

        return next;
      }

      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          category: item.category,
          size,
          quantity,
        },
      ];
    });

    setSelectedQuantities((prev) => ({
      ...prev,
      [item.id]: 0,
    }));
  }

  function changeCartQuantity(index: number, delta: number) {
    setCart((prev) => {
      const next = [...prev];
      const updatedQuantity = next[index].quantity + delta;

      if (updatedQuantity <= 0) {
        next.splice(index, 1);
        return next;
      }

      next[index] = {
        ...next[index],
        quantity: updatedQuantity,
      };

      return next;
    });
  }

  function removeCartItem(index: number) {
    setCart((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSubmitOrderQueue() {
    if (cart.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/staff/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderType,
          items: cart,
          totalAmount: total,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to submit order.");
        return;
      }

      setCart([]);
      setSelectedQuantities({});
      setSelectedSizes({});
      setOrderType("pickup");
      setSuccessMessage(
        `Order ${result.orderId.slice(0, 8).toUpperCase()} added to queue.`
      );
    } catch {
      setError("Something went wrong while submitting the order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF0DA]">
      <div className="border-b border-[#D8C6A8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
          <label className="flex w-full max-w-md items-center gap-3 rounded-[12px] border border-[#BFD0B8] bg-[#F7FBF5] px-4 py-2">
            <Search size={18} className="text-[#6F7F69]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#8D9C87]"
            />
          </label>

          <button
            type="button"
            onClick={loadMenuItems}
            disabled={isLoadingMenu}
            className="inline-flex items-center gap-2 rounded-[12px] border border-[#BFD0B8] bg-[#F7FBF5] px-4 py-2 font-sans text-sm font-semibold text-[#0D2E18] disabled:opacity-60"
          >
            <RefreshCw size={16} />
            {isLoadingMenu ? "Loading..." : "Refresh Menu"}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-[#D9D9D9]" />
            <div className="font-sans">
              <p className="text-sm font-semibold text-[#3C332A]">
                Chrizelda P. Norial
              </p>
              <p className="text-[11px] text-[#8C7A64]">
                chrizeldanorial@gmail.com
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="grid min-h-[calc(100vh-73px)] grid-cols-[1fr_340px]">
        <div className="px-6 py-6">
          <div className="mb-6 flex flex-wrap gap-3">
            {categoryButtons.map((button) => (
              <button
                key={button.key}
                type="button"
                onClick={() => setActiveCategory(button.key)}
                className={`rounded-full border px-6 py-2 font-sans text-sm font-semibold transition ${
                  activeCategory === button.key
                    ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                    : "border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35]"
                }`}
              >
                {button.label}
              </button>
            ))}
          </div>

          {isLoadingMenu ? (
            <div className="rounded-[18px] border border-[#D8C6A8] bg-white p-6 font-sans text-sm text-[#8C7A64]">
              Loading menu items...
            </div>
          ) : null}

          {!isLoadingMenu && filteredItems.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[#D8C6A8] bg-[#FFF8EF] p-6 text-center font-sans text-sm text-[#8C7A64]">
              No menu items found.
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const selectedSize = getSelectedSize(item.id);
              const selectedQuantity = getSelectedQuantity(item.id);
              const showSize = itemUsesSize(item.category);

              return (
                <article
                  key={item.id}
                  className="rounded-[18px] border border-[#D8C6A8] bg-white p-3 shadow-[0_4px_12px_rgba(104,75,53,0.06)]"
                >
                  <div className="flex gap-3">
                    <div className="flex h-[96px] w-[96px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#E7F4EA]">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-full bg-[#D9D9D9]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-xl font-bold leading-tight text-[#684B35]">
                        {item.name}
                      </p>
                      <p className="mt-1 font-sans text-lg font-semibold text-[#684B35]">
                        {"\u20B1"} {formatPrice(item.price)}
                      </p>

                      {showSize ? (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setItemSize(item.id, "regular")}
                            className={`rounded-full border px-4 py-1 font-sans text-[10px] font-semibold ${
                              selectedSize === "regular"
                                ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                                : "border-[#9FA89C] bg-white text-[#3C332A]"
                            }`}
                          >
                            Regular
                          </button>

                          <button
                            type="button"
                            onClick={() => setItemSize(item.id, "large")}
                            className={`rounded-full border px-4 py-1 font-sans text-[10px] font-semibold ${
                              selectedSize === "large"
                                ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                                : "border-[#9FA89C] bg-white text-[#3C332A]"
                            }`}
                          >
                            Large
                          </button>
                        </div>
                      ) : null}

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => changeItemQuantity(item.id, -1)}
                          className="flex h-6 w-8 items-center justify-center rounded-full border border-[#9FA89C] bg-white font-sans text-sm font-semibold text-[#0D2E18]"
                        >
                          -
                        </button>

                        <span className="min-w-[20px] text-center font-sans text-sm font-semibold text-[#3C332A]">
                          {selectedQuantity}
                        </span>

                        <button
                          type="button"
                          onClick={() => changeItemQuantity(item.id, 1)}
                          className="flex h-6 w-8 items-center justify-center rounded-full border border-[#9FA89C] bg-white font-sans text-sm font-semibold text-[#0D2E18]"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="mt-3 w-full rounded-full border border-[#0D2E18] bg-[#F7FBF5] px-4 py-2 font-sans text-sm font-semibold text-[#0D2E18]"
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="border-l border-[#D8C6A8] bg-white px-4 py-4">
          <h2 className="font-sans text-2xl font-bold text-[#684B35]">Cart</h2>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setOrderType("pickup")}
              className={`rounded-[10px] border px-4 py-2 font-sans text-sm font-semibold ${
                orderType === "pickup"
                  ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                  : "border-[#0D2E18] bg-white text-[#0D2E18]"
              }`}
            >
              Walk-in Pickup
            </button>

            <button
              type="button"
              onClick={() => setOrderType("delivery")}
              className={`rounded-[10px] border px-4 py-2 font-sans text-sm font-semibold ${
                orderType === "delivery"
                  ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                  : "border-[#0D2E18] bg-white text-[#0D2E18]"
              }`}
            >
              Delivery
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-[12px] bg-[#FFF1EC] px-4 py-3 font-sans text-sm text-[#9C543D]">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-4 rounded-[12px] bg-[#E7F4EA] px-4 py-3 font-sans text-sm text-[#1E7A3D]">
              {successMessage}
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            {cart.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#D8C6A8] bg-[#FFF7E9] px-4 py-6 text-center font-sans text-sm text-[#8C7A64]">
                No items in cart yet
              </div>
            ) : null}

            {cart.map((item, index) => (
              <div
                key={`${item.id}-${item.size}-${index}`}
                className="rounded-[16px] border border-[#E6D7C0] bg-[#FFF8EF] p-3"
              >
                <div className="flex gap-3">
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[12px] bg-[#E7F4EA]">
                    <div className="h-8 w-8 rounded-full bg-[#D9D9D9]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-sans text-lg font-bold text-[#684B35]">
                          {item.name}
                        </p>
                        <p className="font-sans text-sm text-[#8C7A64]">
                          {itemUsesSize(item.category)
                            ? `${item.size === "regular" ? "Regular" : "Large"} x ${
                                item.quantity
                              }`
                            : `Qty x ${item.quantity}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeCartItem(index)}
                        className="rounded-full p-1.5 text-[#C55432] transition hover:bg-[#FFF1EC]"
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="font-sans text-xl font-semibold text-[#684B35]">
                        {"\u20B1"}
                        {formatPrice(item.price * item.quantity)}
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => changeCartQuantity(index, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#9FA89C] bg-white font-sans text-xs font-semibold text-[#0D2E18]"
                        >
                          -
                        </button>

                        <span className="min-w-[20px] text-center font-sans text-sm font-semibold text-[#3C332A]">
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() => changeCartQuantity(index, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#9FA89C] bg-white font-sans text-xs font-semibold text-[#0D2E18]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-[#E6D7C0] pt-4">
            <div className="flex items-center justify-between">
              <p className="font-sans text-2xl font-bold text-[#3C332A]">
                Total
              </p>
              <p className="font-sans text-3xl font-bold text-[#0D2E18]">
                {"\u20B1"}
                {formatPrice(total)}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmitOrderQueue}
              disabled={cart.length === 0 || isSubmitting}
              className="mt-4 w-full rounded-[12px] border border-[#0D2E18] bg-[#F7FBF5] px-4 py-3 font-sans text-base font-semibold text-[#0D2E18] disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Order Queue"}
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

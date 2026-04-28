"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  CupSoda,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
  X,
  LogOut,
  Minus,
  Plus,
} from "lucide-react";
import { useCart } from "@/features/customer/providers/cart-provider";
import type { CustomerMenuItem } from "@/types/menu";
import type { CustomerOrder } from "@/types/orders";
import type { FeedbackItem } from "@/types/feedback";

type Section = "menu" | "orders" | "recommendations" | "feedback";
type Filter =
  | "all"
  | "non-coffee"
  | "pastries"
  | "latte-series"
  | "premium-blends"
  | "best-deals";

type CustomerDashboardProps = {
  menuItems: CustomerMenuItem[];
  orders: CustomerOrder[];
  feedbackItems: FeedbackItem[];
  initialSection?: Section;
};


const sections: Array<{
  id: Section;
  label: string;
  icon: typeof CupSoda;
}> = [
  { id: "menu", label: "Menu", icon: CupSoda },
  { id: "orders", label: "My Orders", icon: ClipboardList },
  { id: "recommendations", label: "Recommendations", icon: Sparkles },
  { id: "feedback", label: "Feedback", icon: Star },
];

const menuFilters: Array<{
  value: Filter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "non-coffee", label: "Non-Coffee" },
  { value: "pastries", label: "Pastries" },
  { value: "latte-series", label: "Latte Series" },
  { value: "premium-blends", label: "Premium Blends" },
  { value: "best-deals", label: "Best Deals" },
];

const localMenuImages: Record<string, string> = {
  "brown sugar choco latte":
    "/images/menu/Latte-Series/Brown Sugar Choco Latte.png",
  "brown sugar latte": "/images/menu/Latte-Series/Brown Sugar Latte.png",
  "french vanilla latte": "/images/menu/Latte-Series/French Vanilla Latte.png",
  matcha: "/images/menu/Latte-Series/Matcha.JPG",
  "matcha latte": "/images/menu/Latte-Series/Matcha.JPG",
  "spanish latte": "/images/menu/Latte-Series/Spanish Latte.png",
  "choco milk": "/images/menu/Non-Coffee/Choco Milk Drink.png",
  "choco milk drink": "/images/menu/Non-Coffee/Choco Milk Drink.png",
  "strawberry latte": "/images/menu/Non-Coffee/Strawberry Latte.JPG",
  macchiato: "/images/menu/Premium-Blends/Caramel Machiato.png",
  machiato: "/images/menu/Premium-Blends/Caramel Machiato.png",
  "caramel macchiato": "/images/menu/Premium-Blends/Caramel Machiato.png",
  "caramel machiato": "/images/menu/Premium-Blends/Caramel Machiato.png",
  mocha: "/images/menu/Premium-Blends/Mocha.png",
  "strawberry matcha": "/images/menu/Premium-Blends/Strawberry Matcha.JPG",
};

const sugarLevels = [
  { label: "0%", value: 0 },
  { label: "25%", value: 25 },
  { label: "50%", value: 50 },
  { label: "75%", value: 75 },
  { label: "100%", value: 100 },
];

const iceLevels = [
  { label: "No Ice", value: "no_ice" },
  { label: "Less", value: "less" },
  { label: "Regular", value: "regular" },
  { label: "Extra", value: "extra" },
];

const sizes = [
  { label: "Small", value: "small", price: 0 },
  { label: "Medium", value: "medium", price: 0 },
  { label: "Large", value: "large", price: 20 },
];

const temperatures = [
  { label: "Hot", value: "hot" },
  { label: "Iced", value: "iced" },
];

const addons = [
  { label: "Extra Sugar", value: "extra_sugar", price: 10 },
  { label: "Extra Coffee", value: "extra_coffee", price: 20 },
  { label: "Extra Milk", value: "extra_milk", price: 15 },
  { label: "Vanilla Syrup", value: "vanilla_syrup", price: 15 },
  { label: "Caramel Syrup", value: "caramel_syrup", price: 15 },
  { label: "Hazelnut Syrup", value: "hazelnut_syrup", price: 15 },
  { label: "Chocolate Syrup", value: "chocolate_syrup", price: 15 },
];

function formatPrice(value: number) {
  return `₱${Math.round(value)}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatOrderType(orderType: CustomerOrder["order_type"]) {
  return orderType === "pickup" ? "Pickup" : "Delivery";
}

function formatOrderItemSummary(itemNames: string[]) {
  if (itemNames.length === 0) return "Order items";
  if (itemNames.length === 1) return itemNames[0];
  return `${itemNames[0]} + ${itemNames.length - 1} more`;
}

function getFeedbackEmoji(itemName: string) {
  const text = itemName.toLowerCase();

  if (text.includes("matcha")) return "🍵";
  if (text.includes("strawberry")) return "🍓";
  if (text.includes("mocha") || text.includes("chocolate")) return "🍫";
  if (text.includes("tea")) return "🧋";
  return "☕";
}

function formatOrderCode(id: string) {
  return id.startsWith("#") ? id : `#${id.slice(0, 8).toUpperCase()}`;
}

function formatStatus(status: CustomerOrder["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready";
    case "out_for_delivery":
      return "Delivering";
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

function getEmoji(item: CustomerMenuItem) {
  const text = `${item.name} ${item.category}`.toLowerCase();

  if (text.includes("matcha")) return "🍵";
  if (text.includes("strawberry")) return "🍓";
  if (text.includes("mocha") || text.includes("chocolate")) return "🍫";
  if (text.includes("tea")) return "🧋";
  return "☕";
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/_/g, "-")
    .replace(/\s+/g, " ");
}

function getMenuImage(item: CustomerMenuItem) {
  if (item.image_url) {
    return item.image_url;
  }

  return localMenuImages[normalizeText(item.name)] ?? null;
}

function getFilter(category: string): Filter {
  const normalizedCategory = normalizeText(category);

  if (
    normalizedCategory === "all-coffee" ||
    normalizedCategory === "hot-coffee" ||
    normalizedCategory === "iced-coffee" ||
    normalizedCategory === "coffee" ||
    normalizedCategory === "non-coffee" ||
    normalizedCategory === "milk-tea" ||
    normalizedCategory === "frappe"
  ) {
    return "non-coffee";
  }

  if (normalizedCategory === "pastries" || normalizedCategory === "food") {
    return "pastries";
  }

  if (normalizedCategory === "latte-series") {
    return "latte-series";
  }

  if (normalizedCategory === "premium-blends") {
    return "premium-blends";
  }

  if (normalizedCategory === "best-deals" || normalizedCategory === "others") {
    return "best-deals";
  }

  return "all";
}

function getMenuDedupeKey(item: CustomerMenuItem) {
  return [
    item.name.trim().toLowerCase(),
    item.category.trim().toLowerCase(),
    Math.round(item.base_price),
  ].join("|");
}

function dedupeMenuItems(items: CustomerMenuItem[]) {
  const uniqueItems = new Map<string, CustomerMenuItem>();

  items.forEach((item) => {
    const key = getMenuDedupeKey(item);
    const existingItem = uniqueItems.get(key);

    if (!existingItem || (!existingItem.is_available && item.is_available)) {
      uniqueItems.set(key, item);
    }
  });

  return Array.from(uniqueItems.values());
}

export function CustomerDashboard({
  menuItems,
  orders,
  feedbackItems,
  initialSection = "menu",
}: CustomerDashboardProps) {

  const router = useRouter();
  const { addItem, cartCount } = useCart();
  const [activeSection, setActiveSection] = useState<Section>(initialSection);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedMenuItem, setSelectedMenuItem] =
    useState<CustomerMenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sugarLevel, setSugarLevel] = useState(50);
  const [iceLevel, setIceLevel] = useState("regular");
  const [size, setSize] = useState("medium");
  const [temperature, setTemperature] = useState("iced");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [customizeMessage, setCustomizeMessage] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [selectedFeedbackItemId, setSelectedFeedbackItemId] = useState("");
  const [tasteRating, setTasteRating] = useState(5);
  const [strengthRating, setStrengthRating] = useState(5);
  const [overallRating, setOverallRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const selectedFeedbackItem =
    feedbackItems.find((item) => item.order_item_id === selectedFeedbackItemId) ??
    feedbackItems[0];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  async function handleSubmitFeedback() {
    if (!selectedFeedbackItem) return;

    setIsSubmittingFeedback(true);
    setFeedbackMessage("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: selectedFeedbackItem.order_id,
          order_item_id: selectedFeedbackItem.order_item_id,
          menu_item_id: selectedFeedbackItem.menu_item_id,
          taste_rating: tasteRating,
          strength_rating: strengthRating,
          overall_rating: overallRating,
          comment: feedbackComment,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setFeedbackMessage(result.error || "Failed to submit feedback.");
        return;
      }

      setFeedbackMessage("Feedback submitted successfully.");
      setTimeout(() => {
        window.location.href = "/customer?tab=feedback";
      }, 700);
    } catch {
      setFeedbackMessage("Something went wrong while submitting feedback.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  useEffect(() => {
    if (!selectedFeedbackItemId && feedbackItems.length > 0) {
      setSelectedFeedbackItemId(feedbackItems[0].order_item_id);
    }
  }, [feedbackItems, selectedFeedbackItemId]);


  const uniqueMenuItems = useMemo(() => dedupeMenuItems(menuItems), [menuItems]);

  const filteredMenu = useMemo(() => {
    return uniqueMenuItems.filter((item) => {
      const matchesQuery =
        !debouncedQuery ||
        item.name.toLowerCase().includes(debouncedQuery) ||
        (item.description ?? "").toLowerCase().includes(debouncedQuery);

      const matchesFilter =
        filter === "all" || getFilter(item.category) === filter;

      return matchesQuery && matchesFilter;
    });
  }, [debouncedQuery, filter, uniqueMenuItems]);

  const selectedSize = sizes.find((item) => item.value === size);
  const selectedAddonRows = addons.filter((item) =>
    selectedAddons.includes(item.value)
  );
  const addonTotal = selectedAddonRows.reduce(
    (sum, item) => sum + item.price,
    0
  );
  const sizeCharge = selectedSize?.price ?? 0;
  const customizeTotal = selectedMenuItem
    ? (selectedMenuItem.base_price + addonTotal + sizeCharge) * quantity
    : 0;

  useEffect(() => {
    const customizeId = new URLSearchParams(window.location.search).get(
      "customize"
    );

    if (!customizeId || selectedMenuItem) {
      return;
    }

    const menuItem = uniqueMenuItems.find((item) => item.id === customizeId);

    if (menuItem?.is_available) {
      resetCustomization(menuItem);
      setSelectedMenuItem(menuItem);
    }
  }, [selectedMenuItem, uniqueMenuItems]);

  function resetCustomization(item: CustomerMenuItem) {
    setQuantity(1);
    setSugarLevel(50);
    setIceLevel(item.has_ice_level === false ? "no_ice" : "regular");
    setSize(item.has_size_option === false ? "medium" : "medium");
    setTemperature(item.has_temp_option === false ? "iced" : "iced");
    setSelectedAddons([]);
    setSpecialInstructions("");
    setCustomizeMessage("");
  }

  function openCustomizeModal(item: CustomerMenuItem) {
    if (!item.is_available) {
      return;
    }

    resetCustomization(item);
    setSelectedMenuItem(item);

    const url = new URL(window.location.href);
    url.searchParams.set("customize", item.id);
    window.history.pushState(null, "", url);
  }

  function closeCustomizeModal() {
    setSelectedMenuItem(null);
    setCustomizeMessage("");

    const url = new URL(window.location.href);
    url.searchParams.delete("customize");
    window.history.replaceState(null, "", url);
  }

  function toggleAddon(value: string) {
    setSelectedAddons((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function handleAddCustomizedItem() {
    if (!selectedMenuItem || quantity < 1) {
      return;
    }

    addItem({
      menu_item_id: selectedMenuItem.id,
      name: selectedMenuItem.name,
      base_price: selectedMenuItem.base_price,
      quantity,
      sugar_level: selectedMenuItem.has_sugar_level === false ? 100 : sugarLevel,
      ice_level: selectedMenuItem.has_ice_level === false ? null : iceLevel,
      size,
      temperature,
      addons: selectedAddons,
      addon_price: addonTotal + sizeCharge,
      special_instructions: specialInstructions.trim(),
      image_url: getMenuImage(selectedMenuItem),
    });

    navigator.vibrate?.(18);
    setCustomizeMessage("Added to cart.");

    window.setTimeout(() => {
      closeCustomizeModal();
    }, 550);
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

  function handleSectionClick(section: Section) {
    setActiveSection(section);
    setIsSidebarOpen(false);
  }

  return (
    <main className="min-h-screen bg-[#F8EBCF] text-[#123E26]">
      <div className="flex min-h-screen">
        <aside className="flex w-[72px] shrink-0 flex-col items-center justify-between rounded-r-[24px] bg-[#083C1F] px-2 py-4 text-white sm:w-[82px]">
          <div className="flex w-full flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0F4A27]"
            >
              <span className="space-y-1">
                <span className="block h-0.5 w-4 rounded bg-current" />
                <span className="block h-0.5 w-6 rounded bg-current" />
                <span className="block h-0.5 w-3 rounded bg-current" />
              </span>
            </button>

            {sections.map(({ id, icon: Icon, label }) => {
              const isActive = activeSection === id;

              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => setActiveSection(id)}
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                    isActive
                      ? "bg-[#FFF0D8] text-[#0B3F22]"
                      : "text-[#F7EED8] hover:bg-[#0F4A27]"
                  }`}
                >
                  <Icon size={21} />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="pb-1 text-3xl text-[#F7EED8]"
          >
            ←
          </button>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-[#D7C7A9] bg-[#F8F7F4] px-4 py-3 sm:px-5">
            <div className="flex w-full max-w-[310px] items-center gap-2 rounded-full border border-[#A7B08D] bg-[#F5EFDF] px-4 py-2">
              <Search size={15} className="text-[#5E6857]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#6E7768]"
              />
            </div>

            <div className="h-10 w-10 rounded-full bg-[#D9D9D9]" />
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-5 pb-28 sm:px-5">
            {activeSection === "menu" && (
              <div>
                <h1 className="text-3xl font-black tracking-tight text-[#123E26] sm:text-4xl">
                  Menu
                </h1>
                <p className="mt-1 text-xs text-[#6F634E] sm:text-sm">
                  Browse our menu and order directly for pickup or delivery.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  {menuFilters.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setFilter(item.value)}
                      className={`rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] sm:text-xs ${
                        filter === item.value
                          ? "border-[#123E26] bg-[#123E26] text-[#FFF1D8]"
                          : "border-[#57654B] bg-transparent text-[#2E3D2B]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredMenu.map((item) => {
                    const menuImage = getMenuImage(item);

                    return (
                    <article
                      key={item.id}
                      className="rounded-[24px] border border-[#DDD0B7] bg-white/90 p-3 shadow-[0_8px_20px_rgba(0,0,0,0.08)] transition hover:shadow-[0_12px_24px_rgba(0,0,0,0.10)]"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[#E7F1E6] text-3xl">
                          {menuImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={menuImage}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getEmoji(item)
                          )}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex justify-end">
                            <span
                              className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${
                                item.is_available
                                  ? "bg-[#E9F5E7] text-[#2D7A40]"
                                  : "bg-[#FBE9E2] text-[#9C543D]"
                              }`}
                            >
                              {item.is_available ? "Available" : "Unavailable"}
                            </span>
                          </div>

                          <h2 className="mt-3 line-clamp-2 text-xl font-black leading-tight text-[#123E26]">
                            {item.name}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#7D7767]">
                            {item.description ?? "Freshly prepared drink"}
                          </p>

                          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                            <p className="text-2xl font-black text-[#765531]">
                              {formatPrice(item.base_price)}
                            </p>

                            {item.is_available ? (
                              <button
                                type="button"
                                onClick={() => openCustomizeModal(item)}
                                aria-label={`Add ${item.name} to cart`}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#123E26] text-white transition hover:bg-[#0D2E18]"
                              >
                                <ShoppingCart size={17} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                aria-label={`${item.name} is unavailable`}
                                className="flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-[#D8C8A7] text-[#8A755D]"
                              >
                                <ShoppingCart size={17} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSection === "orders" && (
              <div className="space-y-4">
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  My Orders
                </h1>
                <p className="text-sm text-[#6F634E]">
                  Your latest orders from the system.
                </p>

                {orders.length === 0 ? (
                  <div className="rounded-[24px] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
                    <p className="text-xl font-bold text-[#123E26]">
                      No orders yet
                    </p>
                    <p className="mt-2 text-[#5D694F]">
                      Once you place an order, it will appear here.
                    </p>
                  </div>
                ) : (
                  orders.map((order) => {
                    const itemNames = order.order_items
                      .map((item) => item.menu_items?.name)
                      .filter(Boolean);

                    return (
                      <Link
                        key={order.id}
                        href={`/customer/orders/${order.id}`}
                        className="block rounded-[24px] bg-white p-5 shadow-[0_8px_20px_rgba(0,0,0,0.08)] transition hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-2xl font-black text-[#123E26]">
                              {formatOrderCode(order.id)}
                            </p>
                            <p className="mt-1 text-2xl font-bold text-[#1F1711]">
                              {formatOrderItemSummary(itemNames)}
                            </p>
                            <p className="mt-2 text-sm text-[#7D7767]">
                              Placed at {formatTime(order.ordered_at)}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-4 py-2 text-sm font-semibold sm:text-base ${
                              order.status === "cancelled"
                                ? "bg-[#FBE9E2] text-[#9C543D]"
                                : order.status === "completed" ||
                                  order.status === "delivered"
                                ? "bg-[#E8F4E4] text-[#2D7A40]"
                                : "bg-[#F5EAD7] text-[#8C5C2A]"
                            }`}
                          >
                            {formatStatus(order.status)}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#EEE2C8] pt-4">
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#8A755D]">
                              {formatOrderType(order.order_type)}
                            </p>
                            <p className="mt-1 text-xs text-[#9A8A73]">
                              Tap to track order
                            </p>
                          </div>

                          <p className="text-2xl font-black text-[#9D6D48]">
                            {formatPrice(order.total_amount)}
                          </p>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            )}

            {activeSection === "recommendations" && (
              <div className="space-y-4">
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Recommendations
                </h1>
                <p className="text-sm text-[#6F634E]">
                  This section can later use your `customer_preferences` table.
                </p>

                <div className="rounded-[22px] border border-[#6A7552] bg-[linear-gradient(180deg,#F7F0CF_0%,#0F5A2D_100%)] p-4 text-[#FFF7E8] shadow-[0_12px_24px_rgba(15,49,27,0.22)]">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#1F452C]">
                    Today&apos;s Picks for You
                  </p>
                  <p className="mt-2 text-sm">
                    Once customer behavior data exists, we can show real personalized items here.
                  </p>
                </div>
              </div>
            )}

            {activeSection === "feedback" && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                    Feedback
                  </h1>
                  <p className="mt-1 text-sm text-[#6F634E]">
                    Share feedback for delivered or completed orders.
                  </p>
                </div>

                {feedbackItems.length === 0 ? (
                  <div className="rounded-[24px] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
                    <p className="text-2xl font-bold text-[#123E26]">
                      No feedback pending
                    </p>
                    <p className="mt-2 text-[#5D694F]">
                      Once you complete an order that has not been reviewed yet,
                      it will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[28px] bg-white p-5 shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E9F1E6] text-4xl shadow-[0_8px_18px_rgba(12,58,30,0.10)]">
                        {selectedFeedbackItem
                          ? getFeedbackEmoji(selectedFeedbackItem.item_name)
                          : "☕"}
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7D7767]">
                          How was your order?
                        </p>
                        <h2 className="mt-1 text-3xl font-bold text-[#123E26]">
                          {selectedFeedbackItem?.item_name ?? "Select an item"}
                        </h2>
                        <p className="mt-1 text-sm text-[#5D694F]">
                          Your feedback helps improve the customer experience.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <label className="mb-2 block text-sm font-semibold text-[#5D694F]">
                        Select Order Item
                      </label>
                      <select
                        value={selectedFeedbackItemId}
                        onChange={(event) =>
                          setSelectedFeedbackItemId(event.target.value)
                        }
                        className="w-full rounded-[18px] border border-[#D8C8A7] bg-[#FFFCF7] px-4 py-3 outline-none"
                      >
                        {feedbackItems.map((item) => (
                          <option
                            key={item.order_item_id}
                            value={item.order_item_id}
                          >
                            {item.item_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-6 space-y-6">
                      {(
                        [
                          ["Taste Quality", tasteRating, setTasteRating],
                          ["Drink Strength", strengthRating, setStrengthRating],
                          ["Overall Experience", overallRating, setOverallRating],
                        ] as const
                      ).map(([label, value, setValue]) => (
                        <div
                          key={label}
                          className="rounded-[20px] bg-[#FFF8EE] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-lg font-bold text-[#123E26]">
                              {label}
                            </p>
                            <span className="text-sm font-semibold text-[#8A755D]">
                              {value}/5
                            </span>
                          </div>

                          <div className="mt-3 flex gap-2">
                            {[1, 2, 3, 4, 5].map((score) => (
                              <button
                                key={score}
                                type="button"
                                onClick={() => setValue(score)}
                                className={`text-4xl transition ${
                                  score <= value
                                    ? "text-[#123E26]"
                                    : "text-[#D8C8A7]"
                                }`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-[#5D694F]">
                          Comment
                        </label>
                        <textarea
                          value={feedbackComment}
                          onChange={(event) =>
                            setFeedbackComment(event.target.value)
                          }
                          placeholder="Tell us about your order"
                          className="min-h-28 w-full rounded-[18px] border border-[#D8C8A7] bg-[#FFFCF7] px-4 py-3 outline-none placeholder:text-[#A49175]"
                        />
                      </div>

                      {feedbackMessage ? (
                        <p
                          className={`rounded-xl px-4 py-3 text-sm font-medium ${
                            feedbackMessage.toLowerCase().includes("success")
                              ? "bg-[#EEF8EC] text-[#2D7A40]"
                              : "bg-[#FFF1EC] text-[#9C543D]"
                          }`}
                        >
                          {feedbackMessage}
                        </p>
                      ) : null}

                      <button
                        type="button"
                        onClick={handleSubmitFeedback}
                        disabled={isSubmittingFeedback || !selectedFeedbackItem}
                        className="w-full rounded-[18px] bg-[#123E26] px-5 py-4 text-lg font-bold text-white disabled:opacity-60"
                      >
                        {isSubmittingFeedback
                          ? "Submitting..."
                          : "Submit Feedback"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedMenuItem ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0D2E18]/45 px-3 pb-0 pt-10 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-t-[30px] border border-[#E5D6BB] bg-[#FFF8EF] shadow-[0_-18px_40px_rgba(13,46,24,0.18)] sm:rounded-[30px]">
            <div className="flex items-start justify-between gap-4 border-b border-[#E8D9BE] px-5 py-4 sm:px-6">
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8A755D]">
                  Customize Item
                </p>
                <h2 className="mt-1 font-display text-3xl font-semibold leading-tight text-[#123E26] sm:text-4xl">
                  {selectedMenuItem.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeCustomizeModal}
                aria-label="Close customization"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3E6D1] text-[#123E26] transition hover:bg-[#E8D9BE]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-5.5rem)] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-[24px] bg-[#E7F1E6] text-6xl sm:w-52">
                      {getMenuImage(selectedMenuItem) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getMenuImage(selectedMenuItem) ?? ""}
                          alt={selectedMenuItem.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getEmoji(selectedMenuItem)
                      )}
                    </div>

                    <div className="flex-1">
                      <span className="inline-flex rounded-full bg-white/80 px-3 py-1 font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#2D7A40] shadow-sm">
                        Available
                      </span>
                      <p className="mt-3 font-sans text-sm leading-6 text-[#6F634E]">
                        {selectedMenuItem.description ??
                          "Freshly prepared for pickup or delivery."}
                      </p>
                      <p className="mt-4 font-sans text-3xl font-black text-[#765531]">
                        {formatPrice(selectedMenuItem.base_price)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-5">
                    {selectedMenuItem.has_temp_option !== false ? (
                      <div>
                        <h3 className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#123E26]">
                          Temperature
                        </h3>
                        <div className="mt-3 grid rounded-full border border-[#D8C8A7] bg-white p-1 sm:max-w-xs sm:grid-cols-2">
                          {temperatures.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setTemperature(item.value)}
                              className={`rounded-full px-4 py-2.5 font-sans text-sm font-bold transition ${
                                temperature === item.value
                                  ? "bg-[#123E26] text-[#FFF0D8]"
                                  : "text-[#684B35] hover:bg-[#F5EAD7]"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedMenuItem.has_sugar_level !== false ? (
                      <div>
                        <h3 className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#123E26]">
                          Sugar Level
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {sugarLevels.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setSugarLevel(item.value)}
                              className={`rounded-full border px-4 py-2 font-sans text-sm font-bold transition ${
                                sugarLevel === item.value
                                  ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                                  : "border-[#D8C8A7] bg-white text-[#684B35]"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedMenuItem.has_ice_level !== false ? (
                      <div>
                        <h3 className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#123E26]">
                          Ice Level
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {iceLevels.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setIceLevel(item.value)}
                              className={`rounded-full border px-4 py-2 font-sans text-sm font-bold transition ${
                                iceLevel === item.value
                                  ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                                  : "border-[#D8C8A7] bg-white text-[#684B35]"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedMenuItem.has_size_option !== false ? (
                      <div>
                        <h3 className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#123E26]">
                          Size
                        </h3>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          {sizes.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setSize(item.value)}
                              className={`rounded-[18px] border p-4 text-left font-sans transition ${
                                size === item.value
                                  ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                                  : "border-[#D8C8A7] bg-white text-[#684B35]"
                              }`}
                            >
                              <p className="font-black">{item.label}</p>
                              <p className="mt-1 text-xs">
                                {item.price > 0
                                  ? `+${formatPrice(item.price)}`
                                  : "No extra charge"}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <aside className="rounded-[24px] border border-[#E1D0B2] bg-white/72 p-5">
                  <h3 className="font-sans text-xl font-black text-[#123E26]">
                    Order Builder
                  </h3>

                  <div className="mt-5">
                    <p className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                      Quantity
                    </p>
                    <div className="mt-2 inline-flex items-center rounded-full border border-[#D8C8A7] bg-[#FFF8EF] p-1">
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity((current) => Math.max(1, current - 1))
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#123E26]"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="min-w-12 text-center font-sans text-lg font-black">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((current) => current + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#123E26]"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                      Add-ons
                    </p>
                    <div className="mt-3 grid gap-2">
                      {addons.map((item) => {
                        const selected = selectedAddons.includes(item.value);

                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => toggleAddon(item.value)}
                            className={`flex items-center justify-between rounded-[16px] border px-4 py-3 font-sans text-sm font-bold transition ${
                              selected
                                ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                                : "border-[#D8C8A7] bg-white text-[#684B35]"
                            }`}
                          >
                            <span>{item.label}</span>
                            <span>+{formatPrice(item.price)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                      Special Instructions
                    </label>
                    <textarea
                      value={specialInstructions}
                      onChange={(event) =>
                        setSpecialInstructions(event.target.value)
                      }
                      placeholder="Add a note for staff"
                      className="mt-2 min-h-24 w-full rounded-[18px] border border-[#D8C8A7] bg-[#FFF8EF] px-4 py-3 font-sans text-sm outline-none placeholder:text-[#A49175]"
                    />
                  </div>

                  {customizeMessage ? (
                    <p className="mt-4 rounded-xl bg-[#E7F4EA] px-4 py-3 font-sans text-sm font-bold text-[#0F7A40]">
                      {customizeMessage}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleAddCustomizedItem}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#123E26] px-5 py-4 font-sans text-base font-black text-white shadow-lg shadow-[#123E26]/20 transition hover:-translate-y-0.5 hover:bg-[#0D2E18]"
                  >
                    <ShoppingCart size={18} />
                    Add to Cart — {formatPrice(customizeTotal)}
                  </button>
                </aside>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ${
          isSidebarOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[80vw] max-w-[310px] flex-col rounded-r-[24px] bg-[#083C1F] text-white shadow-[12px_0_30px_rgba(0,0,0,0.16)] transition-transform duration-300 ease-out sm:w-[290px] ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 pb-5 pt-8">
          <h2 className="font-display text-[2.15rem] font-semibold leading-none tracking-[-0.04em] text-[#FFF0D8]">
            KadaServe
          </h2>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close customer menu"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF0D8]/10 text-[#FFF0D8] transition hover:bg-[#FFF0D8]/18"
          >
            <X size={22} />
          </button>
        </div>

        <div className="mx-5 rounded-[22px] border border-[#FFF0D8]/14 bg-[#0F4A27] p-4 shadow-[0_12px_26px_rgba(0,0,0,0.12)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0D8] font-sans text-lg font-black text-[#083C1F]">
              KC
            </div>
            <div className="min-w-0">
              <p className="truncate font-sans text-base font-bold text-[#FFF0D8]">
                KadaServe Customer
              </p>
              <button
                type="button"
                onClick={() => handleSectionClick("recommendations")}
                className="mt-0.5 font-sans text-xs font-semibold text-[#DCCFB8] underline-offset-4 hover:underline"
              >
                View Profile
              </button>
            </div>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-2 px-4">
          {sections.map(({ id, icon: Icon, label }) => {
            const isActive = activeSection === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSectionClick(id)}
                className={`flex w-full items-center gap-3 rounded-[18px] px-4 py-3.5 text-left font-sans text-base font-semibold transition ${
                  isActive
                    ? "bg-[#FFF0D8] text-[#123E26] shadow-[0_10px_18px_rgba(0,0,0,0.12)]"
                    : "text-[#FFF0D8]/88 hover:bg-[#FFF0D8]/10 hover:text-[#FFF0D8]"
                }`}
              >
                <Icon size={21} className="shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-5 pb-7 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex min-h-12 w-full items-center gap-3 rounded-[18px] px-4 py-3 font-sans text-base font-semibold text-[#FFF0D8]/88 transition hover:bg-[#FFF0D8]/10 hover:text-[#FFF0D8] disabled:opacity-60"
          >
            <LogOut size={20} className="shrink-0" />
            <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
          </button>
        </div>
      </aside>

      <Link
        href="/customer/cart"
        className="fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[#123E26] text-white shadow-[0_12px_24px_rgba(11,46,24,0.28)] sm:bottom-6 sm:right-6"
      >
        <ShoppingCart size={24} />
        {cartCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FFF0D8] px-1 text-[10px] font-bold text-[#123E26]">
            {cartCount}
          </span>
        ) : null}
      </Link>
    </main>
  );
}

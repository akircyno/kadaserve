"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
} from "lucide-react";
import { useCart } from "./cart-provider";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  base_price: number;
  image_url: string | null;
  is_available: boolean;
};

type Order = {
  id: string;
  order_type: "pickup" | "delivery";
  status:
    | "pending"
    | "preparing"
    | "ready"
    | "out_for_delivery"
    | "delivered"
    | "completed"
    | "cancelled";
  total_amount: number;
  ordered_at: string;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    menu_items: {
      name: string;
    } | null;
  }[];
};

type Section = "menu" | "orders" | "recommendations" | "feedback";
type Filter = "all" | "coffee" | "non-coffee";

type CustomerDashboardProps = {
  menuItems: MenuItem[];
  orders: Order[];
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

function formatPrice(value: number) {
  return `₱${Math.round(value)}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatOrderCode(id: string) {
  return id.startsWith("#") ? id : `#${id.slice(0, 8).toUpperCase()}`;
}

function formatStatus(status: Order["status"]) {
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

function getEmoji(item: MenuItem) {
  const text = `${item.name} ${item.category}`.toLowerCase();

  if (text.includes("matcha")) return "🍵";
  if (text.includes("strawberry")) return "🍓";
  if (text.includes("mocha") || text.includes("chocolate")) return "🍫";
  if (text.includes("tea")) return "🧋";
  return "☕";
}

function getFilter(category: string): Filter {
  if (category.includes("coffee")) return "coffee";
  if (category === "non_coffee" || category === "milk_tea" || category === "frappe") {
    return "non-coffee";
  }
  return "all";
}

export function CustomerDashboard({
  menuItems,
  orders,
  initialSection = "menu",
}: CustomerDashboardProps) {
  const router = useRouter();
  const { cartCount } = useCart();
  const [activeSection, setActiveSection] = useState<Section>(initialSection);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const filteredMenu = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesQuery =
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        (item.description ?? "").toLowerCase().includes(query.toLowerCase());

      const matchesFilter =
        filter === "all" || getFilter(item.category) === filter;

      return matchesQuery && matchesFilter;
    });
  }, [filter, menuItems, query]);

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
                  Browse items — tell staff your order verbally
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  {(["all", "coffee", "non-coffee"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFilter(item)}
                      className={`rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] sm:text-xs ${
                        filter === item
                          ? "border-[#123E26] bg-[#123E26] text-[#FFF1D8]"
                          : "border-[#57654B] bg-transparent text-[#2E3D2B]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                  {filteredMenu.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-[22px] border border-[#DDD0B7] bg-white/90 p-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:p-3"
                    >
                      <div className="flex h-24 items-center justify-center rounded-[16px] bg-[#E7F1E6] text-3xl sm:h-28 sm:text-4xl">
                        {getEmoji(item)}
                      </div>

                      <div className="mt-3">
                        <div className="flex flex-col gap-2">
                          <div>
                            <h2 className="line-clamp-2 text-lg font-bold leading-tight sm:text-2xl sm:leading-none">
                              {item.name}
                            </h2>
                            <p className="mt-1 line-clamp-2 text-[10px] text-[#7D7767] sm:text-xs">
                              {item.description ?? "Freshly prepared drink"}
                            </p>
                          </div>

                          <div className="flex justify-end">
                            <span
                              className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] sm:text-[10px] ${
                                item.is_available
                                  ? "bg-[#E9F5E7] text-[#2D7A40]"
                                  : "bg-[#FBE9E2] text-[#9C543D]"
                              }`}
                            >
                              {item.is_available ? "Available" : "Unavailable"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-2xl font-black text-[#765531] sm:text-3xl">
                            {formatPrice(item.base_price)}
                          </p>

                          <Link
                            href={`/customer/menu/${item.id}`}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#123E26] text-white sm:h-11 sm:w-11"
                          >
                            <ShoppingCart size={17} />
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
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
                            <p className="text-2xl font-black">
                              {formatOrderCode(order.id)}
                            </p>
                            <p className="text-2xl font-bold">
                              {itemNames.length > 0
                                ? itemNames.join(", ")
                                : "Order items"}
                            </p>
                          </div>

                          <span className="rounded-full bg-[#E7F1E6] px-4 py-2 text-lg font-semibold text-[#2B6540] sm:text-xl">
                            {formatStatus(order.status)}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-lg font-bold text-[#765531] sm:text-2xl">
                          <span>{order.order_type.toUpperCase()}</span>
                          <span>{formatTime(order.ordered_at)}</span>
                          <span className="text-[#123E26]">
                            {formatPrice(order.total_amount)}
                          </span>
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
              <div className="space-y-4">
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Feedback
                </h1>
                <p className="text-sm text-[#6F634E]">
                  This will connect cleanly to your `feedback` table next.
                </p>

                <div className="rounded-[24px] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
                  <p className="text-2xl font-bold">How was your order?</p>
                  <p className="mt-2 text-[#5D694F]">
                    We can build the star-rating form here in the next step.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {isSidebarOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setIsSidebarOpen(false)}
          />
          <aside className="fixed left-0 top-0 z-50 flex h-full w-[230px] flex-col bg-[#083C1F] text-white shadow-[12px_0_30px_rgba(0,0,0,0.16)]">
            <div className="flex items-center justify-between px-5 py-5">
              <h2 className="font-display text-4xl font-semibold text-[#FFF0D8]">
                KadaServe
              </h2>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="text-white"
              >
                <X size={28} />
              </button>
            </div>

            <div className="mt-4 flex-1">
              {sections.map(({ id, icon: Icon, label }) => {
                const isActive = activeSection === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSectionClick(id)}
                    className={`flex w-full items-center gap-3 px-6 py-4 text-left text-[18px] font-semibold transition ${
                      isActive
                        ? "bg-[#FFF0D8] text-[#123E26]"
                        : "text-white hover:bg-[#0F4A27]"
                    }`}
                  >
                    <Icon size={24} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="px-6 py-6">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-3 text-[18px] font-semibold text-white disabled:opacity-60"
              >
                <LogOut size={22} />
                <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
              </button>
            </div>
          </aside>
        </>
      ) : null}

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

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Menu as MenuIcon,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  InventoryView,
  getInventoryStatus,
} from "@/features/admin/components/admin-inventory-view";
import {
  CustomerPreferenceView,
  ItemRankingView,
  SatisfactionView,
} from "@/features/admin/components/admin-insights-views";
import { MenuView } from "@/features/admin/components/admin-menu-view";
import { AdminOrderDetailsDrawer } from "@/features/admin/components/admin-order-details-drawer";
import { DashboardView } from "@/features/admin/components/admin-overview-view";
import { OrdersView } from "@/features/admin/components/admin-orders-view";
import {
  PeakHoursView,
  TimeSeriesView,
} from "@/features/admin/components/admin-time-analytics-views";
import { adminTabs, type AdminTab } from "@/features/admin/data/admin-tabs";
import { inventoryItems } from "@/features/admin/data/inventory-items";
import type { AdminMenuItem } from "@/types/menu";
import type { StaffOrder } from "@/types/orders";

const weekDays = ["MON", "TUES", "WED", "THURS", "FRI", "SAT", "SUN"];
const hourLabels = ["7AM", "8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM", "6PM", "7PM", "8PM"];

function formatOrderCode(id: string) {
  return `#KD-${id.slice(0, 4).toUpperCase()}`;
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

function normalizeWeekday(value: string) {
  const day = new Date(value)
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();

  if (day === "TUE") return "TUES";
  if (day === "THU") return "THURS";

  return day;
}

function parseHourLabel(label: string) {
  const hourNumber = Number(label.replace(/\D/g, ""));
  const isPm = label.includes("P") && hourNumber !== 12;

  return isPm ? hourNumber + 12 : hourNumber;
}

export function AdminDashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [menuItems, setMenuItems] = useState<AdminMenuItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);
  const [search, setSearch] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const nonCancelledOrders = useMemo(
    () => orders.filter((order) => order.status !== "cancelled"),
    [orders]
  );

  const paidOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.payment_status === "paid" && order.status !== "cancelled"
      ),
    [orders]
  );

  const grossIncomeSales = useMemo(
    () => paidOrders.reduce((sum, order) => sum + order.total_amount, 0),
    [paidOrders]
  );

  const averageOrderValue = paidOrders.length
    ? grossIncomeSales / paidOrders.length
    : 0;

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return orders;

    return orders.filter((order) => {
      const haystack = [
        formatOrderCode(order.id),
        getOrderDisplayName(order),
        formatOrderItems(order),
        order.order_type,
        order.payment_method ?? "",
        order.payment_status ?? "",
        order.status,
        order.delivery_email ?? "",
        order.delivery_phone ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [orders, search]);

  const itemRanking = useMemo(() => {
    const ranking = new Map<
      string,
      { item: string; orders: number; revenue: number; rating: number }
    >();

    for (const order of nonCancelledOrders) {
      for (const item of order.order_items) {
        const itemName = item.menu_items?.name ?? "Menu item";
        const current =
          ranking.get(itemName) ??
          {
            item: itemName,
            orders: 0,
            revenue: 0,
            rating: 4.2,
          };

        current.orders += item.quantity;
        if (order.payment_status === "paid") {
          current.revenue += item.unit_price * item.quantity;
        }
        current.rating = Math.min(4.8, 3.8 + current.orders / 20);
        ranking.set(itemName, current);
      }
    }

    return Array.from(ranking.values()).sort(
      (first, second) => second.orders - first.orders
    );
  }, [nonCancelledOrders]);

  const weekdayCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const day of weekDays) counts.set(day, 0);

    for (const order of nonCancelledOrders) {
      const normalizedDay = normalizeWeekday(order.ordered_at);

      if (counts.has(normalizedDay)) {
        counts.set(normalizedDay, (counts.get(normalizedDay) ?? 0) + 1);
      }
    }

    return weekDays.map((day) => ({
      day,
      orders: counts.get(day) ?? 0,
    }));
  }, [nonCancelledOrders]);

  const hourlyCounts = useMemo(() => {
    return hourLabels.map((label) => {
      const hour = parseHourLabel(label.replace("AM", "A").replace("PM", "P"));
      const ordersInHour = nonCancelledOrders.filter(
        (order) => new Date(order.ordered_at).getHours() === hour
      ).length;

      return {
        label,
        orders: ordersInHour,
      };
    });
  }, [nonCancelledOrders]);

  const maxHourlyOrders = Math.max(1, ...hourlyCounts.map((item) => item.orders));
  const maxWeekdayOrders = Math.max(1, ...weekdayCounts.map((item) => item.orders));
  const maxItemOrders = Math.max(1, ...itemRanking.map((item) => item.orders));
  const averageRating = itemRanking.length
    ? itemRanking.reduce((sum, item) => sum + item.rating, 0) / itemRanking.length
    : 0;
  const inventorySummary = {
    total: inventoryItems.length,
    normal: inventoryItems.filter((item) => getInventoryStatus(item) === "Good Stock").length,
    low: inventoryItems.filter((item) => getInventoryStatus(item) === "Low Stock").length,
    critical: inventoryItems.filter((item) => getInventoryStatus(item) === "Critical").length,
  };

  useEffect(() => {
    loadAdminData({ showLoading: true });
  }, []);

  useEffect(() => {
    const shouldAutoSync =
      activeTab === "dashboard" ||
      activeTab === "orders" ||
      activeTab === "time-series" ||
      activeTab === "peak-hours" ||
      activeTab === "item-ranking" ||
      activeTab === "satisfaction" ||
      activeTab === "customer-pref";

    if (!shouldAutoSync) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadAdminData({ showLoading: false });
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [activeTab]);

  async function loadAdminData({
    showLoading = true,
  }: {
    showLoading?: boolean;
  } = {}) {
    if (showLoading) {
      setIsLoading(true);
    }

    if (showLoading) {
      setError("");
    }

    try {
      const [ordersResponse, menuResponse] = await Promise.all([
        fetch("/api/staff/orders/list", { method: "GET" }),
        fetch("/api/admin/menu", { method: "GET" }),
      ]);

      const ordersResult = await ordersResponse.json();
      const menuResult = await menuResponse.json();

      if (!ordersResponse.ok) {
        setError(ordersResult.error || "Failed to load admin orders.");
        return;
      }

      if (!menuResponse.ok) {
        setError(menuResult.error || "Failed to load menu items.");
        return;
      }

      setOrders(ordersResult.orders ?? []);
      setMenuItems(menuResult.menuItems ?? []);
      setLastSyncedAt(new Date());
    } catch {
      setError("Something went wrong while loading admin data.");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
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

  return (
    <main className="min-h-screen bg-[#FFF0DA] text-[#0D2E18]">
      <div
        className={`grid min-h-screen transition-all duration-300 ${isSidebarOpen
          ? "grid-cols-[190px_minmax(0,1fr)]"
          : "grid-cols-[76px_minmax(0,1fr)]"
          }`}
      >
        <aside className="sticky top-0 flex h-screen flex-col overflow-hidden rounded-r-[26px] bg-[#0D2E18] text-[#FFF0DA]">
          <div
            className={`flex items-center gap-3 pt-9 ${isSidebarOpen ? "justify-between px-7" : "justify-center px-3"
              }`}
          >
            <p
              className={`font-display font-semibold leading-none tracking-[-0.04em] transition-all ${isSidebarOpen ? "text-[2rem]" : "text-[1.35rem]"
                }`}
            >
              {isSidebarOpen ? "KadaServe" : "KS"}
            </p>

            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Open sidebar"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF0DA]/10 text-[#FFF0DA] transition hover:bg-[#FFF0DA]/18"
            >
              {isSidebarOpen ? <X size={17} /> : <MenuIcon size={18} />}
            </button>
          </div>

          <nav
            className={`mt-24 space-y-1 ${isSidebarOpen ? "pl-4 pr-0" : "px-3"
              }`}
          >
            {adminTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  title={tab.label}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left font-sans text-sm font-semibold leading-tight transition ${isActive
                    ? isSidebarOpen
                      ? "relative -mr-5 rounded-l-[14px] rounded-r-none bg-[#FFF0DA] text-[#0D2E18] after:absolute after:bottom-0 after:right-[-20px] after:top-0 after:w-5 after:bg-[#FFF0DA]"
                      : "justify-center rounded-[16px] bg-[#FFF0DA] text-[#0D2E18]"
                    : "rounded-[14px] text-[#FFF0DA]/88 hover:bg-[#FFF0DA]/10 hover:text-[#FFF0DA]"
                    }`}
                >
                  <Icon size={18} className="shrink-0" />
                  {isSidebarOpen ? (
                    tab.label
                  ) : (
                    <span className="sr-only">{tab.label}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className={`mt-auto pb-7 ${isSidebarOpen ? "px-4" : "px-3"}`}>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Logout"
              className={`flex w-full items-center gap-3 rounded-[14px] px-4 py-3 font-sans text-sm font-semibold text-[#FFF0DA]/88 transition hover:bg-[#FFF0DA]/10 hover:text-[#FFF0DA] disabled:opacity-60 ${isSidebarOpen ? "" : "justify-center"
                }`}
            >
              <LogOut size={17} className="shrink-0" />
              {isSidebarOpen ? (isLoggingOut ? "Logging out..." : "Logout") : null}
            </button>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="border-b border-[#DCCFB8] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-4">
              <label className="flex w-full max-w-[520px] items-center gap-3 rounded-full border border-[#BFD0B8] bg-[#F7FBF5] px-5 py-3">
                <Search size={18} className="text-[#6F7F69]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search orders, customers, payments..."
                  className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#8D9C87]"
                />
              </label>

              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => loadAdminData({ showLoading: true })}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-[#BFD0B8] bg-[#F7FBF5] px-5 py-3 font-sans text-sm font-semibold text-[#0D2E18] transition hover:bg-[#EDF6EA] disabled:opacity-60"
                  >
                    <RefreshCw size={16} />
                    {isLoading ? "Syncing..." : "Sync latest"}
                  </button>

                  <p className="font-sans text-[11px] text-[#8C7A64]">
                    Auto-syncs every 20s
                    {lastSyncedAt
                      ? ` - Last ${lastSyncedAt.toLocaleTimeString("en-PH", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-[#D9D9D9]" />
                  <div className="font-sans">
                    <p className="text-sm font-semibold text-[#684B35]">
                      Chrizelda P. Norial
                    </p>
                    <p className="text-[11px] text-[#8C7A64]">
                      chrizeldanorial@gmail.com
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="px-7 py-6">
            {error ? (
              <div className="mb-5 rounded-[18px] bg-[#FFF1EC] px-5 py-4 font-sans text-sm text-[#9C543D]">
                {error}
              </div>
            ) : null}

            {activeTab === "dashboard" ? (
              <DashboardView
                averageOrderValue={averageOrderValue}
                hourlyCounts={hourlyCounts}
                itemRanking={itemRanking}
                maxHourlyOrders={maxHourlyOrders}
                maxItemOrders={maxItemOrders}
                maxWeekdayOrders={maxWeekdayOrders}
                nonCancelledOrders={nonCancelledOrders}
                grossIncomeSales={grossIncomeSales}
                averageRating={averageRating}
                weekdayCounts={weekdayCounts}
              />
            ) : null}

            {activeTab === "orders" ? (
              <OrdersView
                filteredOrders={filteredOrders}
                onOpenOrder={setSelectedOrder}
              />
            ) : null}

            {activeTab === "time-series" ? (
              <TimeSeriesView
                hourlyCounts={hourlyCounts}
                maxHourlyOrders={maxHourlyOrders}
              />
            ) : null}

            {activeTab === "peak-hours" ? <PeakHoursView orders={orders} /> : null}

            {activeTab === "item-ranking" ? (
              <ItemRankingView
                itemRanking={itemRanking}
                maxItemOrders={maxItemOrders}
              />
            ) : null}

            {activeTab === "satisfaction" ? (
              <SatisfactionView itemRanking={itemRanking} />
            ) : null}

            {activeTab === "customer-pref" ? (
              <CustomerPreferenceView orders={orders} />
            ) : null}

            {activeTab === "menu" ? (
              <MenuView menuItems={menuItems} setMenuItems={setMenuItems} />
            ) : null}

            {activeTab === "inventory" ? (
              <InventoryView
                inventoryItems={inventoryItems}
                inventorySummary={inventorySummary}
              />
            ) : null}
          </div>
        </section>
      </div>

      {selectedOrder ? (
        <AdminOrderDetailsDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      ) : null}
    </main>
  );
}



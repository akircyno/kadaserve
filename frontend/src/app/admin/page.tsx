"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Coffee,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  RefreshCw,
  Search,
  Star,
  Target,
  Timer,
  TrendingUp,
  X,
} from "lucide-react";

type AdminTab =
  | "dashboard"
  | "orders"
  | "time-series"
  | "peak-hours"
  | "item-ranking"
  | "satisfaction"
  | "customer-pref"
  | "menu"
  | "inventory";

type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

type StaffOrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  sugar_level: number;
  ice_level: string | null;
  size: string;
  temperature: string;
  addons: string[] | null;
  special_instructions: string | null;
  menu_items: {
    name: string;
  } | null;
};

type StaffOrder = {
  id: string;
  order_type: "pickup" | "delivery";
  status: OrderStatus;
  payment_method: "cash" | "gcash" | null;
  payment_status: "unpaid" | "paid" | null;
  total_amount: number;
  ordered_at: string;
  walkin_name: string | null;
  delivery_address: string | null;
  delivery_email: string | null;
  delivery_phone: string | null;
  order_items: StaffOrderItem[];
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string | null;
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type MenuFormState = {
  id: string | null;
  name: string;
  category: string;
  price: string;
  imageUrl: string;
  isAvailable: boolean;
};

const emptyMenuForm: MenuFormState = {
  id: null,
  name: "",
  category: "non-coffee",
  price: "",
  imageUrl: "",
  isAvailable: true,
};

const adminMenuCategories = [
  { value: "non-coffee", label: "Non-Coffee" },
  { value: "pastries", label: "Pastries" },
  { value: "latte-series", label: "Latte Series" },
  { value: "premium-blends", label: "Premium Blends" },
  { value: "best-deals", label: "Best Deals" },
];


type InventoryItem = {
  name: string;
  unit: string;
  onHand: number;
  minNeed: number;
  maxCap: number;
  supplier: string;
};

const tabs: Array<{
  key: AdminTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "orders", label: "All Orders", icon: ClipboardList },
    { key: "time-series", label: "Time Series", icon: BarChart3 },
    { key: "peak-hours", label: "Peak Hours", icon: Timer },
    { key: "item-ranking", label: "Item Ranking", icon: TrendingUp },
    { key: "satisfaction", label: "Satisfaction", icon: Star },
    { key: "customer-pref", label: "Customer Pref", icon: Target },
    { key: "menu", label: "Menu", icon: Coffee },
    { key: "inventory", label: "Inventory", icon: Boxes },
  ];

const weekDays = ["MON", "TUES", "WED", "THURS", "FRI", "SAT", "SUN"];
const hourLabels = ["7AM", "8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM", "6PM", "7PM", "8PM"];
const peakHourLabels = ["6A", "7A", "8A", "9A", "10A", "11A", "12P", "1P", "2P", "3P"];

const inventoryItems: InventoryItem[] = [
  { name: "Fresh Milk", unit: "liter", onHand: 20, minNeed: 10, maxCap: 40, supplier: "Local dairy supply" },
  { name: "Oat Milk", unit: "liter", onHand: 8, minNeed: 6, maxCap: 20, supplier: "Supplier" },
  { name: "Condensed Milk", unit: "cans", onHand: 12, minNeed: 8, maxCap: 24, supplier: "Supplier" },
  { name: "Coffee Beans", unit: "kg", onHand: 15, minNeed: 8, maxCap: 30, supplier: "Supplier" },
  { name: "Espresso Capsules", unit: "pcs", onHand: 2, minNeed: 10, maxCap: 50, supplier: "Supplier" },
  { name: "Matcha Powder", unit: "kg", onHand: 4, minNeed: 4, maxCap: 10, supplier: "Supplier" },
  { name: "Sugar Syrup", unit: "bottle", onHand: 10, minNeed: 6, maxCap: 20, supplier: "Supplier" },
];

function peso(value: number) {
  return `\u20B1${Math.round(value).toLocaleString("en-PH")}`;
}

function formatOrderCode(id: string) {
  return `#KD-${id.slice(0, 4).toUpperCase()}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
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

function formatCategory(category: string) {
  if (category === "non-coffee") return "Non-Coffee";
  if (category === "latte-series") return "Latte Series";
  if (category === "premium-blends") return "Premium Blends";
  if (category === "best-deals") return "Best Deals";

  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function getInventoryStatus(item: InventoryItem) {
  if (item.onHand <= item.minNeed / 2) return "Critical";
  if (item.onHand <= item.minNeed) return "Low Stock";
  return "Good Stock";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

function countOrdersForSlot(orders: StaffOrder[], day: string, hourLabel: string) {
  const hour = parseHourLabel(hourLabel);

  return orders.filter((order) => {
    const orderedAt = new Date(order.ordered_at);

    return normalizeWeekday(order.ordered_at) === day && orderedAt.getHours() === hour;
  }).length;
}

function getHeatmapColor(count: number, max: number) {
  if (count === 0) return "#F7FBF5";

  const ratio = count / max;

  if (ratio >= 0.8) return "#684B35";
  if (ratio >= 0.6) return "#8C5F3C";
  if (ratio >= 0.4) return "#A77B5D";
  if (ratio >= 0.2) return "#D0AC91";

  return "#FFF0DA";
}

function getDetectedPeakWindows(orders: StaffOrder[]) {
  return weekDays
    .map((day) => {
      const slots = peakHourLabels.map((hour) => ({
        hour,
        orders: countOrdersForSlot(orders, day, hour),
      }));
      const peakSlot = slots.reduce(
        (best, current) => (current.orders > best.orders ? current : best),
        slots[0] ?? { hour: "N/A", orders: 0 }
      );

      return {
        day,
        orders: peakSlot.orders,
        window: peakSlot.hour === "N/A" ? "No data" : `${peakSlot.hour} peak`,
      };
    })
    .filter((window) => window.orders > 0)
    .sort((first, second) => second.orders - first.orders)
    .slice(0, 5);
}

export default function AdminPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
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
            {tabs.map((tab) => {
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
        <>
          <div
            className="fixed inset-0 z-40 bg-[#0D2E18]/35"
            onClick={() => setSelectedOrder(null)}
          />

          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-[#FFF8EF] shadow-[-18px_0_40px_rgba(13,46,24,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#DCCFB8] px-6 py-5">
              <div>
                <p className="font-sans text-sm uppercase tracking-[0.16em] text-[#684B35]">
                  Admin Order Details
                </p>
                <h2 className="mt-2 font-sans text-4xl font-bold text-[#0D2E18]">
                  {formatOrderCode(selectedOrder.id)}
                </h2>
                <p className="mt-2 font-sans text-sm font-semibold text-[#684B35]">
                  {getOrderDisplayName(selectedOrder)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full bg-white p-2 text-[#0D2E18]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 font-sans text-sm font-semibold ${getOrderTypeStyle(
                    selectedOrder.order_type
                  )}`}
                >
                  {formatOrderTypeLabel(selectedOrder.order_type)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-sans text-sm font-semibold ${getPaymentStyle(
                    selectedOrder.payment_method
                  )}`}
                >
                  {formatPaymentMethod(selectedOrder.payment_method)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-sans text-sm font-semibold ${getPaymentStatusStyle(
                    selectedOrder.payment_status
                  )}`}
                >
                  {formatPaymentStatus(selectedOrder.payment_status)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-sans text-sm font-semibold ${getStatusStyle(
                    selectedOrder.status
                  )}`}
                >
                  {formatStatus(selectedOrder.status)}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <InfoCard label="Customer" value={getOrderDisplayName(selectedOrder)} />
                <InfoCard label="Placed at" value={formatDateTime(selectedOrder.ordered_at)} />
                <InfoCard label="Total" value={peso(selectedOrder.total_amount)} />
                <InfoCard
                  label="Payment"
                  value={`${formatPaymentMethod(
                    selectedOrder.payment_method
                  )} - ${formatPaymentStatus(selectedOrder.payment_status)}`}
                />
              </div>

              <div className="mt-5 rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
                  Order Flow
                </p>
                <div className="mt-4 space-y-3">
                  {(
                    selectedOrder.order_type === "pickup"
                      ? ["pending", "preparing", "ready", "completed"]
                      : [
                          "pending",
                          "preparing",
                          "ready",
                          "out_for_delivery",
                          "delivered",
                        ]
                  ).map((status) => {
                    const activeStatus = status === selectedOrder.status;

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
                          {formatStatus(status as OrderStatus)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedOrder.order_type === "delivery" ? (
                <div className="mt-5 rounded-[20px] border border-[#DCCFB8] bg-white p-4">
                  <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
                    Delivery Info
                  </p>
                  <div className="mt-3 space-y-2 font-sans text-sm text-[#3C332A]">
                    <p>
                      <span className="font-semibold">Address:</span>{" "}
                      {selectedOrder.delivery_address || "No address"}
                    </p>
                    <p>
                      <span className="font-semibold">Email:</span>{" "}
                      {selectedOrder.delivery_email || "No email"}
                    </p>
                    <p>
                      <span className="font-semibold">Phone:</span>{" "}
                      {selectedOrder.delivery_phone || "No phone"}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                <p className="font-sans text-sm uppercase tracking-[0.08em] text-[#684B35]">
                  Order Items
                </p>

                {selectedOrder.order_items.map((item) => (
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
      ) : null}
    </main>
  );
}

function DashboardView({
  averageRating,
  averageOrderValue,
  grossIncomeSales,
  hourlyCounts,
  itemRanking,
  maxHourlyOrders,
  maxItemOrders,
  maxWeekdayOrders,
  nonCancelledOrders,
  weekdayCounts,
}: {
  averageRating: number;
  averageOrderValue: number;
  grossIncomeSales: number;
  hourlyCounts: Array<{ label: string; orders: number }>;
  itemRanking: Array<{ item: string; orders: number; revenue: number; rating: number }>;
  maxHourlyOrders: number;
  maxItemOrders: number;
  maxWeekdayOrders: number;
  nonCancelledOrders: StaffOrder[];
  weekdayCounts: Array<{ day: string; orders: number }>;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-4">
        <MetricCard label="Total Orders" value={nonCancelledOrders.length.toString()} />
        <MetricCard label="Gross Income Sales" value={peso(grossIncomeSales)} />
        <MetricCard label="Avg Order Value" value={peso(averageOrderValue)} />
        <MetricCard
          label="Average Rating"
          value={averageRating ? averageRating.toFixed(1) : "N/A"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Orders - Week">
          <div className="flex h-[190px] items-end gap-5">
            {weekdayCounts.map((item) => (
              <div key={item.day} className="flex flex-1 flex-col items-center gap-3">
                <p className="font-sans text-sm font-semibold text-[#0D2E18]">
                  {item.orders}
                </p>
                <div
                  className="w-full max-w-[54px] rounded-t-[10px] bg-[#0D2E18]"
                  style={{
                    height: `${Math.max(18, (item.orders / maxWeekdayOrders) * 120)}px`,
                  }}
                />
                <p className="font-sans text-sm text-[#0D2E18]">{item.day}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Peak Hours">
          <Heatmap compact orders={nonCancelledOrders} />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Top Items" rightLabel="ORDERS">
          <div className="mt-4 space-y-4">
            {(itemRanking.length ? itemRanking : []).slice(0, 5).map((item, index) => (
              <RankingRow
                key={item.item}
                index={index + 1}
                label={item.item}
                value={item.orders}
                max={maxItemOrders}
              />
            ))}
            {itemRanking.length === 0 ? <EmptyState label="No order data yet" /> : null}
          </div>
        </Panel>

        <Panel title="Satisfaction" rightLabel="AVG / 5">
          <div className="mt-4 space-y-4">
            {(itemRanking.length ? itemRanking : []).slice(0, 5).map((item) => (
              <RatingRow key={item.item} item={item.item} rating={item.rating} />
            ))}
            {itemRanking.length === 0 ? <EmptyState label="No rating data yet" /> : null}
          </div>
        </Panel>
      </div>

      <Panel title="Hourly Order Volume">
        <div className="mt-8 flex items-end gap-4 overflow-x-auto pb-2">
          {hourlyCounts.map((item) => (
            <div key={item.label} className="flex min-w-[62px] flex-col items-center gap-2">
              <p className="font-sans text-sm text-[#0D2E18]">{item.orders}</p>
              <div
                className="w-12 rounded-full bg-[#0D2E18]"
                style={{
                  height: `${Math.max(10, (item.orders / maxHourlyOrders) * 44)}px`,
                }}
              />
              <p className="font-sans text-sm text-[#0D2E18]">{item.label}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function OrdersView({
  filteredOrders,
  onOpenOrder,
}: {
  filteredOrders: StaffOrder[];
  onOpenOrder: (order: StaffOrder) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | StaffOrder["order_type"]>(
    "all"
  );
  const [paymentFilter, setPaymentFilter] = useState<
    "all" | "paid" | "unpaid" | "cash" | "gcash"
  >("all");

  const visibleOrders = useMemo(() => {
    return filteredOrders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      const matchesType =
        typeFilter === "all" || order.order_type === typeFilter;
      const matchesPayment =
        paymentFilter === "all" ||
        order.payment_status === paymentFilter ||
        order.payment_method === paymentFilter;

      return matchesStatus && matchesType && matchesPayment;
    });
  }, [filteredOrders, paymentFilter, statusFilter, typeFilter]);

  const statusOptions: Array<{ value: "all" | OrderStatus; label: string }> = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "preparing", label: "Preparing" },
    { value: "ready", label: "Ready" },
    { value: "out_for_delivery", label: "Out for Delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const typeOptions: Array<{
    value: "all" | StaffOrder["order_type"];
    label: string;
  }> = [
    { value: "all", label: "All Types" },
    { value: "pickup", label: "Pickup" },
    { value: "delivery", label: "Delivery" },
  ];

  const paymentOptions: Array<{
    value: "all" | "paid" | "unpaid" | "cash" | "gcash";
    label: string;
  }> = [
    { value: "all", label: "All Payments" },
    { value: "paid", label: "Paid" },
    { value: "unpaid", label: "Unpaid" },
    { value: "cash", label: "Cash" },
    { value: "gcash", label: "GCash" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-sans text-3xl font-bold tracking-[0.02em] text-[#0D2E18]">
            All Orders
          </h1>
          <p className="mt-1 font-sans text-sm text-[#684B35]">
            Monitor customer, payment, and fulfillment status across all orders.
          </p>
        </div>

        <span className="rounded-full bg-[#E7F4EA] px-4 py-2 font-sans text-sm font-bold text-[#0D2E18]">
          {visibleOrders.length} shown
        </span>
      </div>

      <div className="space-y-4 rounded-[18px] border border-[#DCCFB8] bg-white p-4">
        <div>
          <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
            Status
          </p>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`rounded-full border px-4 py-2 font-sans text-sm font-semibold transition ${
                  statusFilter === option.value
                    ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                    : "border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] hover:border-[#0D2E18]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
              Type
            </p>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTypeFilter(option.value)}
                  className={`rounded-full border px-4 py-2 font-sans text-sm font-semibold transition ${
                    typeFilter === option.value
                      ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                      : "border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] hover:border-[#0D2E18]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
              Payment
            </p>
            <div className="flex flex-wrap gap-2">
              {paymentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaymentFilter(option.value)}
                  className={`rounded-full border px-4 py-2 font-sans text-sm font-semibold transition ${
                    paymentFilter === option.value
                      ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                      : "border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] hover:border-[#0D2E18]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[#DCCFB8] bg-white">
        <div className="grid grid-cols-[110px_1.4fr_1fr_1.1fr_1fr_95px_90px_110px] gap-4 px-5 py-4 font-sans text-sm font-bold uppercase text-[#0D2E18]">
          <span>Order ID</span>
          <span>Customer / Items</span>
          <span>Type</span>
          <span>Payment</span>
          <span>Status</span>
          <span>Total</span>
          <span>Time</span>
          <span>Action</span>
        </div>

        <div className="divide-y divide-[#EFE3CF]">
          {visibleOrders.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-[110px_1.4fr_1fr_1.1fr_1fr_95px_90px_110px] items-start gap-4 px-5 py-4 font-sans text-sm text-[#0D2E18]"
            >
              <span className="font-bold">{formatOrderCode(order.id)}</span>
              <div>
                <p className="font-semibold">{getOrderDisplayName(order)}</p>
                <p className="mt-1 line-clamp-2 text-[#684B35]">
                  {formatOrderItems(order) || "No items"}
                </p>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase ${getOrderTypeStyle(
                  order.order_type
                )}`}
              >
                {formatOrderTypeLabel(order.order_type)}
              </span>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${getPaymentStyle(
                    order.payment_method
                  )}`}
                >
                  {formatPaymentMethod(order.payment_method)}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${getPaymentStatusStyle(
                    order.payment_status
                  )}`}
                >
                  {formatPaymentStatus(order.payment_status)}
                </span>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase ${getStatusStyle(
                  order.status
                )}`}
              >
                {formatStatus(order.status)}
              </span>
              <span className="font-semibold">{peso(order.total_amount)}</span>
              <span>{formatTime(order.ordered_at)}</span>
              <button
                type="button"
                onClick={() => onOpenOrder(order)}
                className="rounded-full bg-[#E7F4EA] px-4 py-2 font-sans text-xs font-bold text-[#0D2E18]"
              >
                View
              </button>
            </div>
          ))}
          {visibleOrders.length === 0 ? (
            <EmptyState label="No orders found" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TimeSeriesView({
  hourlyCounts,
  maxHourlyOrders,
}: {
  hourlyCounts: Array<{ label: string; orders: number }>;
  maxHourlyOrders: number;
}) {
  const peak = hourlyCounts.reduce(
    (best, current) => (current.orders > best.orders ? current : best),
    hourlyCounts[0] ?? { label: "N/A", orders: 0 }
  );
  const total = hourlyCounts.reduce((sum, item) => sum + item.orders, 0);
  const avg = hourlyCounts.length ? Math.round(total / hourlyCounts.length) : 0;

  return (
    <div className="space-y-5">
      <h1 className="font-sans text-3xl font-bold uppercase tracking-[0.06em]">
        Time Series Analytics
      </h1>
      <Panel title="Hourly Order Volume">
        <div className="mt-36 flex items-end gap-4 overflow-x-auto pb-2">
          {hourlyCounts.map((item) => (
            <div key={item.label} className="flex min-w-[62px] flex-col items-center gap-2">
              <p className="font-sans text-sm text-[#0D2E18]">{item.orders}</p>
              <div
                className="w-12 rounded-full bg-[#0D2E18]"
                style={{
                  height: `${Math.max(10, (item.orders / maxHourlyOrders) * 60)}px`,
                }}
              />
              <p className="font-sans text-sm text-[#0D2E18]">{item.label}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Statistics">
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <MiniStat label="Peak" value={`${peak.orders} orders`} />
            <MiniStat label="Low" value={`${Math.min(...hourlyCounts.map((item) => item.orders))} orders`} />
            <MiniStat label="Avg" value={`${avg} orders`} />
            <MiniStat label="Total" value={`${total} orders`} />
          </div>
        </Panel>
        <Panel title="Data Table">
          <div className="mt-4 grid grid-cols-3 gap-4 px-4 font-sans text-sm font-bold text-[#684B35]">
            <span>Period</span>
            <span>Orders</span>
            <span>Trend</span>
          </div>
          <div className="mt-3 space-y-3 px-4 pb-4">
            {hourlyCounts.slice(0, 8).map((item, index, list) => {
              const previous = list[index - 1]?.orders ?? item.orders;
              return (
                <div key={item.label} className="grid grid-cols-3 gap-4 font-sans text-sm">
                  <span>{item.label}</span>
                  <span>{item.orders}</span>
                  <span>{item.orders >= previous ? "Up" : "Down"}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function PeakHoursView({ orders }: { orders: StaffOrder[] }) {
  const detectedPeakWindows = getDetectedPeakWindows(orders);

  return (
    <div className="space-y-5">
      <h1 className="font-sans text-3xl font-bold">Peak Hours</h1>
      <Panel title="Hourly Order Volume">
        <Heatmap orders={orders} />
      </Panel>
      <Panel title="Detected Peak Windows">
        <div className="grid gap-5 p-4 md:grid-cols-5">
          {detectedPeakWindows.map((peak) => (
            <div key={peak.day} className="rounded-[14px] bg-[#F7FBF5] p-4 font-sans text-sm">
              <p className="font-bold">{peak.day === "TUES" ? "Tuesday" : peak.day}</p>
              <p className="mt-2 font-bold text-[#0D2E18]">
                {peak.window}
              </p>
              <p className="mt-2 text-[#684B35]">
                {peak.orders} orders
              </p>
            </div>
          ))}
          {detectedPeakWindows.length === 0 ? (
            <div className="md:col-span-5">
              <EmptyState label="Waiting for order data" />
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function ItemRankingView({
  itemRanking,
  maxItemOrders,
}: {
  itemRanking: Array<{ item: string; orders: number; revenue: number; rating: number }>;
  maxItemOrders: number;
}) {
  return (
    <div className="space-y-5">
      <h1 className="font-sans text-3xl font-bold tracking-[0.08em]">
        Item Ranking
      </h1>
      <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-8">
        <div className="grid grid-cols-[50px_2fr_1fr_1fr_1fr_1.2fr] gap-5 font-sans text-base font-bold uppercase">
          <span>#</span>
          <span>Item</span>
          <span>Orders</span>
          <span>Revenue</span>
          <span>Rating</span>
          <span>Order Bar</span>
        </div>
        <div className="mt-6 space-y-5">
          {itemRanking.slice(0, 8).map((item, index) => (
            <div
              key={item.item}
              className="grid grid-cols-[50px_2fr_1fr_1fr_1fr_1.2fr] items-center gap-5 font-sans text-base"
            >
              <span>{index + 1}</span>
              <span className="font-bold">{item.item}</span>
              <span>{item.orders}</span>
              <span>{peso(item.revenue)}</span>
              <span>Rating {item.rating.toFixed(1)}</span>
              <ProgressBar value={item.orders} max={maxItemOrders} />
            </div>
          ))}
          {itemRanking.length === 0 ? <EmptyState label="No ranked items yet" /> : null}
        </div>
      </div>
    </div>
  );
}

function SatisfactionView({
  itemRanking,
}: {
  itemRanking: Array<{ item: string; orders: number; revenue: number; rating: number }>;
}) {
  return (
    <div className="space-y-5">
      <h1 className="font-sans text-3xl font-bold tracking-[0.08em]">
        Satisfaction Analytics
      </h1>
      <p className="font-sans text-sm text-[#684B35]">
        Ratings are estimated from order activity until the feedback reporting endpoint is connected.
      </p>
      {itemRanking.length === 0 ? <EmptyState label="No feedback data yet" /> : null}
      {itemRanking.slice(0, 4).map((item) => (
        <Panel key={item.item} title={item.item} rightLabel="AVG RATINGS">
          <div className="mt-4 space-y-4 px-8 pb-4">
            {["Taste", "Strength", "Overall"].map((label, index) => (
              <div key={label} className="grid grid-cols-[100px_1fr_70px] items-center gap-5">
                <span className="font-sans text-lg font-bold">{label}</span>
                <ProgressBar value={item.rating - index * 0.1} max={5} />
                <span className="font-sans text-sm">
                  Rating {Math.max(0, item.rating - index * 0.1).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function CustomerPreferenceView({ orders }: { orders: StaffOrder[] }) {
  const profiles = Array.from(
    orders.reduce((map, order) => {
      const name = getOrderDisplayName(order);
      const current = map.get(name) ?? {
        name,
        visits: 0,
        total: 0,
        items: new Map<string, number>(),
      };

      current.visits += 1;
      current.total += order.total_amount;

      for (const item of order.order_items) {
        const itemName = item.menu_items?.name ?? "Menu item";
        current.items.set(itemName, (current.items.get(itemName) ?? 0) + item.quantity);
      }

      map.set(name, current);
      return map;
    }, new Map<string, { name: string; visits: number; total: number; items: Map<string, number> }>())
  ).map(([, value]) => {
    const topItems = Array.from(value.items.entries())
      .sort((first, second) => second[1] - first[1])
      .slice(0, 2)
      .map(([name]) => name);

    return {
      ...value,
      topItems,
      score: Math.min(0.99, 0.5 + value.visits / 20 + value.total / 10000),
    };
  }).sort((first, second) => second.score - first.score);

  return (
    <div className="space-y-5">
      <h1 className="font-sans text-3xl font-bold">Customer Preference Scoring</h1>
      <Panel title="Score Distribution">
        <div className="mt-20 grid grid-cols-6 gap-8 px-4 pb-5">
          {["0.0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-0.9", "0.9-1.0"].map((label, index) => (
            <div key={label} className="text-center">
              <p className="font-sans text-sm">{Math.max(1, profiles.length - index)}</p>
              <div className="mt-1 h-2 rounded-full bg-[#0D2E18]" />
              <p className="mt-2 font-sans text-sm">{label}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Customer Profiles + Top-N Recommendations" rightLabel="RANKED BY SCORE">
        <div className="mt-6 space-y-6 px-7 pb-5">
          {profiles.slice(0, 5).map((profile, index) => (
            <div key={profile.name} className="grid grid-cols-[40px_72px_1fr_100px] items-center gap-4">
              <span className="font-sans text-[#8C7A64]">{index + 1}</span>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0D2E18] font-sans text-xl font-bold text-[#FFF0DA]">
                {getInitials(profile.name)}
              </div>
              <div>
                <p className="font-sans text-lg font-semibold">{profile.name}</p>
                <p className="font-sans text-sm text-[#684B35]">
                  Most ordered: {profile.topItems[0] ?? "No item"} - {profile.visits} visits
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.topItems.map((item) => (
                    <span key={item} className="rounded-full border border-[#D6C6AC] px-3 py-1 font-sans text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="font-sans text-xl font-bold">{profile.score.toFixed(2)}</p>
                <p className="font-sans text-xs text-[#684B35]">PREF SCORE</p>
              </div>
            </div>
          ))}
          {profiles.length === 0 ? <EmptyState label="No customer order data yet" /> : null}
        </div>
      </Panel>
    </div>
  );
}

function MenuView({
  menuItems,
  setMenuItems,
}: {
  menuItems: MenuItem[];
  setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
}) {
  const [form, setForm] = useState<MenuFormState>(emptyMenuForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [menuMessage, setMenuMessage] = useState("");
  const [menuError, setMenuError] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategoryFilter, setMenuCategoryFilter] = useState("all");

  const filteredMenuItems = useMemo(() => {
    const keyword = menuSearch.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesCategory =
        menuCategoryFilter === "all" || item.category === menuCategoryFilter;
      const matchesSearch =
        !keyword ||
        item.name.toLowerCase().includes(keyword) ||
        formatCategory(item.category).toLowerCase().includes(keyword);

      return matchesCategory && matchesSearch;
    });
  }, [menuCategoryFilter, menuItems, menuSearch]);

  const menuFilterOptions = [
    { value: "all", label: "All", count: menuItems.length },
    ...adminMenuCategories.map((category) => ({
      ...category,
      count: menuItems.filter((item) => item.category === category.value)
        .length,
    })),
  ];

  function openCreateForm() {
    setForm(emptyMenuForm);
    setMenuMessage("");
    setMenuError("");
    setIsFormOpen(true);
  }

  function openEditForm(item: MenuItem) {
    setForm({
      id: item.id,
      name: item.name,
      category: item.category,
      price: String(item.price),
      imageUrl: item.imageUrl ?? "",
      isAvailable: item.isAvailable,
    });
    setMenuMessage("");
    setMenuError("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setForm(emptyMenuForm);
  }

  function validateSquareImage(file: File) {
    return new Promise<void>((resolve, reject) => {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

      if (!allowedTypes.includes(file.type)) {
        reject(new Error("Only JPG, PNG, and WEBP images are allowed."));
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        reject(new Error("Image must be 2MB or smaller."));
        return;
      }

      const imageUrl = URL.createObjectURL(file);
      const image = new window.Image();

      image.onload = () => {
        URL.revokeObjectURL(imageUrl);

        if (image.naturalWidth !== image.naturalHeight) {
          reject(new Error("Please upload a square 1:1 image."));
          return;
        }

        if (image.naturalWidth < 600) {
          reject(new Error("Image must be at least 600x600px."));
          return;
        }

        resolve();
      };

      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error("Could not read the selected image."));
      };

      image.src = imageUrl;
    });
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsUploadingImage(true);
    setMenuMessage("");
    setMenuError("");

    try {
      await validateSquareImage(file);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/menu/upload-image", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setMenuError(result.error || "Failed to upload menu image.");
        return;
      }

      setForm((current) => ({
        ...current,
        imageUrl: result.imageUrl,
      }));

      setMenuMessage("Image uploaded. Save the menu item to apply it.");
    } catch (error) {
      setMenuError(
        error instanceof Error
          ? error.message
          : "Something went wrong while uploading the image."
      );
    } finally {
      setIsUploadingImage(false);
      event.target.value = "";
    }
  }

  function removeUploadedImage() {
    setForm((current) => ({
      ...current,
      imageUrl: "",
    }));
  }

  function syncMenuItem(savedItem: MenuItem) {
    setMenuItems((current) => {
      const itemExists = current.some((item) => item.id === savedItem.id);
      const nextItems = itemExists
        ? current.map((item) => (item.id === savedItem.id ? savedItem : item))
        : [savedItem, ...current];

      return nextItems.sort((first, second) =>
        first.name.localeCompare(second.name)
      );
    });
  }


  async function saveMenuItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMenuMessage("");
    setMenuError("");

    try {
      const response = await fetch("/api/admin/menu", {
        method: form.id ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: form.id ?? undefined,
          name: form.name,
          category: form.category,
          price: Number(form.price),
          imageUrl: form.imageUrl,
          isAvailable: form.isAvailable,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMenuError(result.error || "Failed to save menu item.");
        return;
      }

      if (result.menuItem) {
        syncMenuItem(result.menuItem);
      }

      setMenuMessage(form.id ? "Menu item updated." : "Menu item added.");
      closeForm();
    } catch {
      setMenuError("Something went wrong while saving the menu item.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleAvailability(item: MenuItem) {
    setMenuMessage("");
    setMenuError("");

    try {
      const response = await fetch("/api/admin/menu", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: item.id,
          isAvailable: !item.isAvailable,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMenuError(result.error || "Failed to update availability.");
        return;
      }

      if (result.menuItem) {
        syncMenuItem(result.menuItem);
      }

      setMenuMessage("Availability updated.");
    } catch {
      setMenuError("Something went wrong while updating availability.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-sans text-3xl font-bold">Menu Management</h1>
          <p className="mt-1 font-sans text-sm text-[#684B35]">
            Add, edit, and hide menu items from staff/customer ordering.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-[14px] bg-[#0D2E18] px-8 py-3 font-sans text-base font-bold text-[#FFF0DA]"
        >
          + Add New
        </button>
      </div>

      {menuError ? (
        <div className="rounded-[16px] bg-[#FFF1EC] px-5 py-4 font-sans text-sm text-[#9C543D]">
          {menuError}
        </div>
      ) : null}

      {menuMessage ? (
        <div className="rounded-[16px] bg-[#E7F4EA] px-5 py-4 font-sans text-sm text-[#0F441D]">
          {menuMessage}
        </div>
      ) : null}

      <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <label className="flex w-full items-center gap-3 rounded-full border border-[#BFD0B8] bg-[#F7FBF5] px-5 py-3 xl:max-w-[420px]">
            <Search size={17} className="text-[#6F7F69]" />
            <input
              value={menuSearch}
              onChange={(event) => setMenuSearch(event.target.value)}
              placeholder="Search menu items..."
              className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#8D9C87]"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {menuFilterOptions.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => setMenuCategoryFilter(category.value)}
                className={`rounded-full border px-4 py-2 font-sans text-sm font-semibold transition ${
                  menuCategoryFilter === category.value
                    ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                    : "border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] hover:border-[#0D2E18]"
                }`}
              >
                {category.label}
                <span className="ml-2 opacity-70">{category.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[#DCCFB8] bg-white">
        <div className="grid grid-cols-[1.5fr_1fr_0.7fr_0.9fr_1fr] gap-6 px-6 py-4 font-sans text-sm font-bold uppercase text-[#0D2E18]">
          <span>Item</span>
          <span>Category</span>
          <span>Price</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        <div className="divide-y divide-[#EFE3CF]">
          {filteredMenuItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1.5fr_1fr_0.7fr_0.9fr_1fr] items-center gap-6 px-6 py-4 font-sans text-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-[#E7F4EA]">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-[#D9D9D9]" />
                  )}
                </div>
                <p className="font-semibold text-[#0D2E18]">{item.name}</p>
              </div>

              <span>{formatCategory(item.category)}</span>
              <span>{peso(item.price)}</span>

              <span
                className={`w-fit rounded-full px-4 py-1 font-semibold ${item.isAvailable
                  ? "bg-[#E6F2E8] text-[#0F441D]"
                  : "bg-[#FFF1EC] text-[#9C543D]"
                  }`}
              >
                {item.isAvailable ? "Available" : "Not Available"}
              </span>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEditForm(item)}
                  className="rounded-full bg-[#F4EEE6] px-5 py-2 font-semibold text-[#0D2E18]"
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => toggleAvailability(item)}
                  className="rounded-full border border-[#D6C6AC] px-5 py-2 font-semibold text-[#684B35]"
                >
                  {item.isAvailable ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          ))}

          {filteredMenuItems.length === 0 ? (
            <EmptyState label="No matching menu items" />
          ) : null}
        </div>
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D2E18]/35 px-4 py-6">
          <button
            type="button"
            aria-label="Close menu form"
            className="absolute inset-0 cursor-default"
            onClick={closeForm}
          />

          <form
            onSubmit={saveMenuItem}
            className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[26px] border border-[#DCCFB8] bg-white p-6 shadow-[0_24px_70px_rgba(13,46,24,0.24)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-sm uppercase tracking-[0.16em] text-[#684B35]">
                  Menu item
                </p>
                <h2 className="mt-1 font-sans text-3xl font-bold text-[#0D2E18]">
                  {form.id ? "Edit Menu Item" : "Add Menu Item"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-full border border-[#D6C6AC] px-4 py-2 font-sans text-sm font-semibold text-[#684B35] transition hover:bg-[#FFF8EF]"
              >
                Cancel
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <label className="font-sans text-sm font-semibold text-[#684B35]">
                Item name
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-[14px] border border-[#D6C6AC] bg-[#FFF8EF] px-4 py-3 text-[#0D2E18] outline-none"
                  required
                />
              </label>

              <label className="font-sans text-sm font-semibold text-[#684B35]">
                Price
                <input
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-[14px] border border-[#D6C6AC] bg-[#FFF8EF] px-4 py-3 text-[#0D2E18] outline-none"
                  required
                />
              </label>

              <label className="font-sans text-sm font-semibold text-[#684B35]">
                Category
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-[14px] border border-[#D6C6AC] bg-[#FFF8EF] px-4 py-3 text-[#0D2E18] outline-none"
                >
                  {adminMenuCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 self-end rounded-[14px] border border-[#D6C6AC] bg-[#FFF8EF] px-4 py-3 font-sans text-sm font-semibold text-[#684B35]">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isAvailable: event.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                Available for ordering
              </label>

              <div className="lg:col-span-2">
                <p className="font-sans text-sm font-semibold text-[#684B35]">
                  Menu image
                </p>

                <div className="mt-2 flex flex-col gap-4 rounded-[18px] border border-[#D6C6AC] bg-[#FFF8EF] p-4 sm:flex-row sm:items-center">
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[#E7F4EA]">
                    {form.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.imageUrl}
                        alt="Menu preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-[#D9D9D9]" />
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      disabled={isUploadingImage}
                      className="w-full rounded-[14px] border border-[#D6C6AC] bg-white px-4 py-3 font-sans text-sm text-[#0D2E18] file:mr-4 file:rounded-full file:border-0 file:bg-[#0D2E18] file:px-4 file:py-2 file:font-sans file:text-sm file:font-semibold file:text-[#FFF0DA]"
                    />

                    <p className="mt-2 font-sans text-xs text-[#8C7A64]">
                      Upload a square 1:1 image. Minimum 600x600px. JPG, PNG,
                      or WEBP only.
                    </p>

                    {isUploadingImage ? (
                      <p className="mt-2 font-sans text-sm font-semibold text-[#0F441D]">
                        Uploading image...
                      </p>
                    ) : null}

                    {form.imageUrl ? (
                      <button
                        type="button"
                        onClick={removeUploadedImage}
                        className="mt-3 rounded-full border border-[#C55432] px-4 py-2 font-sans text-sm font-semibold text-[#C55432] transition hover:bg-[#FFF1EC]"
                      >
                        Remove image
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-[#EFE3CF] pt-5">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-[14px] border border-[#D6C6AC] px-6 py-3 font-sans text-sm font-bold text-[#684B35] transition hover:bg-[#FFF8EF]"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || isUploadingImage}
                className="rounded-[14px] bg-[#0D2E18] px-8 py-3 font-sans text-sm font-bold text-[#FFF0DA] disabled:opacity-60"
              >
                {isSaving
                  ? "Saving..."
                  : form.id
                  ? "Save Changes"
                  : "Add Menu Item"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}


function InventoryView({
  inventoryItems,
  inventorySummary,
}: {
  inventoryItems: InventoryItem[];
  inventorySummary: { total: number; normal: number; low: number; critical: number };
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-4">
        <MetricCard label="Total Items" value={inventorySummary.total.toString()} />
        <MetricCard label="Normal" value={inventorySummary.normal.toString()} />
        <MetricCard label="Low Stock" value={inventorySummary.low.toString()} />
        <MetricCard label="Critical" value={inventorySummary.critical.toString()} />
      </div>

      <Panel title="Inventory Monitoring">
        <div className="grid grid-cols-[50px_1.4fr_0.8fr_1fr_1fr_1fr_1fr_1fr_0.7fr] gap-4 px-6 py-4 font-sans text-sm font-bold uppercase">
          <span>#</span>
          <span>Ingredient</span>
          <span>Unit</span>
          <span>Onhand</span>
          <span>Min. Need</span>
          <span>Max. Cap</span>
          <span>Status</span>
          <span>Supplier</span>
          <span>Action</span>
        </div>
        <div className="space-y-4 px-6 pb-6">
          {inventoryItems.map((item, index) => (
            <div
              key={item.name}
              className="grid grid-cols-[50px_1.4fr_0.8fr_1fr_1fr_1fr_1fr_1fr_0.7fr] gap-4 font-sans text-sm"
            >
              <span>{index + 1}</span>
              <span className="font-semibold">{item.name}</span>
              <span>{item.unit}</span>
              <span>{item.onHand}</span>
              <span>{item.minNeed}</span>
              <span>{item.maxCap}</span>
              <span>{getInventoryStatus(item)}</span>
              <span>{item.supplier}</span>
              <button className="rounded-full border border-[#D6C6AC] px-3 py-1">
                Notes
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Panel({
  children,
  rightLabel,
  title,
}: {
  children: React.ReactNode;
  rightLabel?: string;
  title: string;
}) {
  return (
    <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans text-lg font-bold text-[#0D2E18]">{title}</h2>
        {rightLabel ? (
          <p className="font-sans text-sm uppercase text-[#0D2E18]">{rightLabel}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-5">
      <p className="font-sans text-sm font-bold uppercase text-[#0D2E18]">
        {label}
      </p>
      <p className="mt-7 font-sans text-4xl font-bold text-[#0D2E18]">{value}</p>
    </div>
  );
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-[#F7FBF5] p-5 text-center">
      <p className="font-sans text-sm text-[#684B35]">{label}</p>
      <p className="mt-2 font-sans text-lg font-bold">{value}</p>
    </div>
  );
}

function ProgressBar({ max, value }: { max: number; value: number }) {
  const width = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="h-3 overflow-hidden rounded-full border border-[#D6C6AC] bg-[#FFF8EF]">
      <div
        className="h-full rounded-full bg-[#684B35]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function RankingRow({
  index,
  label,
  max,
  value,
}: {
  index: number;
  label: string;
  max: number;
  value: number;
}) {
  return (
    <div className="grid grid-cols-[36px_1fr_70px_130px] items-center gap-4 font-sans text-sm">
      <span>{index}</span>
      <span>{label}</span>
      <span>{value}</span>
      <ProgressBar max={max} value={value} />
    </div>
  );
}

function RatingRow({ item, rating }: { item: string; rating: number }) {
  return (
    <div className="grid grid-cols-[120px_1fr_50px] items-center gap-4 font-sans text-sm">
      <span>{item}</span>
      <ProgressBar max={5} value={rating} />
      <span>{rating.toFixed(1)}</span>
    </div>
  );
}

function Heatmap({
  compact = false,
  orders,
}: {
  compact?: boolean;
  orders: StaffOrder[];
}) {
  const days = compact ? weekDays.slice(0, 5) : weekDays;
  const hours = compact ? peakHourLabels.slice(2, 7) : peakHourLabels;
  const maxOrders = Math.max(
    1,
    ...days.flatMap((day) =>
      hours.map((hour) => countOrdersForSlot(orders, day, hour))
    )
  );

  return (
    <div className="mt-4 space-y-3">
      {days.map((day, dayIndex) => (
        <div key={day} className="grid grid-cols-[48px_1fr] items-center gap-3">
          <span className="font-sans text-sm">{day}</span>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
            {hours.map((hour) => {
              const count = countOrdersForSlot(orders, day, hour);

              return (
                <div
                  key={`${day}-${hour}-${dayIndex}`}
                  aria-label={`${day} ${hour}: ${count} orders`}
                  className="h-6 rounded-[6px]"
                  style={{ backgroundColor: getHeatmapColor(count, maxOrders) }}
                  title={`${day} ${hour}: ${count} orders`}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="ml-[60px] grid gap-3" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
        {hours.map((hour) => (
          <span key={hour} className="text-center font-sans text-sm text-[#8C7A64]">
            {hour}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-8 text-center font-sans text-sm text-[#8C7A64]">
      {label}
    </div>
  );
}

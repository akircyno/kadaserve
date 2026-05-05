"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  LogOut,
  Menu as MenuIcon,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  InventoryView,
  type InventoryItem,
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
  type PeakHourWindow,
} from "@/features/admin/components/admin-time-analytics-views";
import { adminTabs, type AdminTab } from "@/features/admin/data/admin-tabs";
import { inventoryItems as initialInventoryItems } from "@/features/admin/data/inventory-items";
import type {
  StoreOverrideStatus,
  StoreStatusPayload,
} from "@/lib/store-status";
import type { AdminMenuItem } from "@/types/menu";
import type { StaffOrder } from "@/types/orders";

const weekDays = ["MON", "TUES", "WED", "THURS", "FRI", "SAT", "SUN"];
const hourNumbers = Array.from({ length: 24 }, (_, hour) => hour);

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

function formatHourNumber(hour: number) {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const displayHour = normalizedHour % 12 || 12;
  const suffix = normalizedHour < 12 ? "AM" : "PM";

  return `${displayHour}${suffix}`;
}

function formatAnalyticsDateLabel(value: string | null) {
  if (!value) {
    return "Latest analytics day";
  }

  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

function formatWeeklyRangeLabel(weekStartDate: string, weekEndDate: string) {
  const start = new Date(`${weekStartDate}T00:00:00+08:00`).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Manila",
    }
  );
  const end = new Date(`${weekEndDate}T00:00:00+08:00`).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Manila",
    }
  );

  return `${start} - ${end}`;
}

function getManilaHour(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  return Number(parts.find((part) => part.type === "hour")?.value ?? 0);
}

function peso(value: number) {
  return `\u20B1${Math.round(value).toLocaleString("en-PH")}`;
}

function formatFeedbackDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type AdminSearchSuggestion = {
  category: string;
  label: string;
  query: string;
  targetId?: string;
  targetTab?: AdminTab;
};

type AdminFeedbackRow = {
  id: string;
  customer_id: string | null;
  menu_item_id: string | null;
  overall_rating: number;
  taste_rating: number;
  strength_rating: number;
  comment: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
  menu_items: { name: string | null; category: string | null } | null;
};

type AdminRewardPoolItem = {
  id: string;
  name: string;
  description: string;
  type: "delivery_fee" | "voucher_discount" | "addon_reward";
  pointsCost: number;
  value: number;
  isActive: boolean;
  redeemedCount: number;
  usedCount: number;
  activeUnusedCount: number;
};

type AdminRewardsPayload = {
  rewardPool: AdminRewardPoolItem[];
  summary: {
    totalRedeemed: number;
    totalUsed: number;
    activeUnused: number;
    freeDeliveryRedeemed: number;
    freeDeliveryUsed: number;
  };
};

type AdminAnalyticsDailyRow = {
  id: string;
  order_date: string;
  day_of_week: string;
  order_count: number;
  total_revenue: number;
  avg_order_value: number;
  avg_rating: number;
};

type AdminAnalyticsHourlyRow = {
  id: string;
  order_date: string;
  day_of_week: string;
  hour_of_day: number;
  hour_label: string;
  order_count: number;
  total_revenue: number;
  avg_order_value: number;
  avg_rating: number;
  updated_at: string;
};

type AdminAnalyticsWeeklyRow = {
  id: string;
  week_start_date: string;
  week_end_date: string;
  order_count: number;
  total_revenue: number;
  avg_order_value: number;
  updated_at: string;
};

type AdminAnalyticsItemRow = {
  id: string;
  item_id: string;
  item_name: string;
  order_count: number;
  quantity_sold: number;
  total_revenue: number;
  avg_rating: number;
  sales_rank: number;
  updated_at: string;
};

type AdminInventoryPayload = {
  inventoryItems?: InventoryItem[];
  item?: InventoryItem;
  error?: string;
};

function normalizeSuggestion(value: string) {
  return value.trim().replaceAll("_", " ");
}

function normalizeAnalyticsWeekday(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith("mon")) return "MON";
  if (normalized.startsWith("tue")) return "TUES";
  if (normalized.startsWith("wed")) return "WED";
  if (normalized.startsWith("thu")) return "THURS";
  if (normalized.startsWith("fri")) return "FRI";
  if (normalized.startsWith("sat")) return "SAT";
  if (normalized.startsWith("sun")) return "SUN";

  return value.slice(0, 4).toUpperCase();
}

function RewardsManagementView({
  orders,
  adminRewards,
}: {
  orders: StaffOrder[];
  adminRewards: AdminRewardsPayload | null;
}) {
  const completedOrders = orders.filter((order) =>
    ["completed", "delivered"].includes(order.status)
  );
  const rewardPool = adminRewards?.rewardPool ?? [];
  const freeDeliveryReward = rewardPool.find((item) => item.type === "delivery_fee");

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
            Completed Orders
          </p>
          <p className="mt-3 font-sans text-3xl font-black text-[#0D2E18]">
            {completedOrders.length}
          </p>
        </div>
        <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
            Free Delivery Redeemed
          </p>
          <p className="mt-3 font-sans text-3xl font-black text-[#0D2E18]">
            {adminRewards?.summary.freeDeliveryRedeemed ?? 0}
          </p>
        </div>
        <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
            Reward Pool
          </p>
          <p className="mt-3 font-sans text-3xl font-black text-[#0D2E18]">
            {rewardPool.filter((item) => item.isActive).length}
          </p>
        </div>
      </div>

      <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
        <h2 className="font-sans text-xl font-bold text-[#0D2E18]">
          Customer Reward Items
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rewardPool.map((item) => (
            <article
              key={item.id}
              className="rounded-[16px] border border-[#EFE3CF] bg-[#FFF8EF] p-4"
            >
              <p className="font-sans text-lg font-black text-[#0D2E18]">
                {item.name.replace(" Voucher", "")}
              </p>
              <p className="mt-1 font-sans text-sm font-semibold text-[#684B35]">
                Reward type: {normalizeSuggestion(item.type)}
              </p>
              <p className="mt-2 font-sans text-sm text-[#684B35]">
                {item.pointsCost} pts - {peso(item.value)} value
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#DCCFB8] pt-3 font-sans text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#8C7A64]">
                    Redeemed
                  </p>
                  <p className="font-black text-[#0D2E18]">{item.redeemedCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#8C7A64]">
                    Used
                  </p>
                  <p className="font-black text-[#0D2E18]">{item.usedCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#8C7A64]">
                    Active
                  </p>
                  <p className="font-black text-[#0D2E18]">
                    {item.activeUnusedCount}
                  </p>
                </div>
              </div>
            </article>
          ))}
          {rewardPool.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] p-5 font-sans text-sm text-[#8C7A64]">
              No reward records yet. Run backend/seed/rewards.sql in Supabase.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
        <h2 className="font-sans text-xl font-bold text-[#0D2E18]">
          Free Delivery Summary
        </h2>
        <div className="mt-4 grid gap-3 font-sans text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
              Total Redeemed
            </p>
            <p className="mt-1 text-2xl font-black text-[#0D2E18]">
              {freeDeliveryReward?.redeemedCount ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
              Total Used
            </p>
            <p className="mt-1 text-2xl font-black text-[#0D2E18]">
              {freeDeliveryReward?.usedCount ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
              Active Unused
            </p>
            <p className="mt-1 text-2xl font-black text-[#0D2E18]">
              {freeDeliveryReward?.activeUnusedCount ?? 0}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeedbackManagementView({
  feedbackRows,
}: {
  feedbackRows: AdminFeedbackRow[];
}) {
  const average =
    feedbackRows.length > 0
      ? feedbackRows.reduce((sum, row) => sum + Number(row.overall_rating), 0) /
        feedbackRows.length
      : 0;
  const byItem = new Map<string, { count: number; total: number }>();

  feedbackRows.forEach((row) => {
    const itemName = row.menu_items?.name || "Menu item";
    const current = byItem.get(itemName) ?? { count: 0, total: 0 };
    byItem.set(itemName, {
      count: current.count + 1,
      total: current.total + Number(row.overall_rating),
    });
  });

  const itemSummaries = Array.from(byItem.entries())
    .map(([item, value]) => ({
      item,
      count: value.count,
      average: value.total / value.count,
    }))
    .sort((first, second) => second.count - first.count);
  const sortedFeedbackRows = [...feedbackRows].sort(
    (first, second) =>
      new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
            Responses
          </p>
          <p className="mt-3 font-sans text-3xl font-black text-[#0D2E18]">
            {feedbackRows.length}
          </p>
        </div>
        <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
            Overall Avg
          </p>
          <p className="mt-3 font-sans text-3xl font-black text-[#0D2E18]">
            {average ? average.toFixed(1) : "N/A"}
          </p>
        </div>
        <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
            Rated Items
          </p>
          <p className="mt-3 font-sans text-3xl font-black text-[#0D2E18]">
            {itemSummaries.length}
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
          <h2 className="font-sans text-xl font-bold text-[#0D2E18]">
            Item Averages
          </h2>
          <div className="mt-4 space-y-3">
            {itemSummaries.map((item) => (
              <div
                key={item.item}
                className="grid grid-cols-[1fr_64px_64px] gap-3 rounded-[14px] bg-[#FFF8EF] px-3 py-2 font-sans text-sm"
              >
                <span className="font-bold text-[#0D2E18]">{item.item}</span>
                <span>{item.count}</span>
                <span>{item.average.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-sans text-xl font-bold text-[#0D2E18]">
              All Responses
            </h2>
            <span className="rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-1 font-sans text-xs font-bold text-[#684B35]">
              {sortedFeedbackRows.length} shown
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {sortedFeedbackRows.map((row) => (
              <article
                key={row.id}
                className="rounded-[14px] border border-[#EFE3CF] bg-[#FFF8EF] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-sans text-sm font-bold text-[#0D2E18]">
                      {row.menu_items?.name || "Menu item"}
                    </p>
                    <p className="mt-1 font-sans text-xs font-semibold text-[#8C7A64]">
                      {row.profiles?.full_name ||
                        row.profiles?.email ||
                        "Customer"}{" "}
                      - {formatFeedbackDateTime(row.created_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#E7F4EA] px-3 py-1 font-sans text-xs font-bold text-[#0D2E18]">
                    {Number(row.overall_rating).toFixed(1)} / 5
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 font-sans text-xs font-bold text-[#684B35]">
                  <span className="rounded-full bg-white px-2.5 py-1">
                    Taste {Number(row.taste_rating).toFixed(1)}
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1">
                    Strength {Number(row.strength_rating).toFixed(1)}
                  </span>
                </div>
                {row.comment ? (
                  <p className="mt-2 font-sans text-sm text-[#684B35]">
                    {row.comment}
                  </p>
                ) : null}
              </article>
            ))}
            {sortedFeedbackRows.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-6 text-center font-sans text-sm text-[#8C7A64]">
                No customer feedback yet
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [menuItems, setMenuItems] = useState<AdminMenuItem[]>([]);
  const [inventoryItems, setInventoryItems] =
    useState<InventoryItem[]>(initialInventoryItems);
  const [analyticsDaily, setAnalyticsDaily] = useState<AdminAnalyticsDailyRow[]>([]);
  const [analyticsHourly, setAnalyticsHourly] = useState<AdminAnalyticsHourlyRow[]>(
    []
  );
  const [analyticsWeekly, setAnalyticsWeekly] = useState<AdminAnalyticsWeeklyRow[]>(
    []
  );
  const [analyticsItems, setAnalyticsItems] = useState<AdminAnalyticsItemRow[]>([]);
  const [peakHourWindows, setPeakHourWindows] = useState<PeakHourWindow[]>([]);
  const [isInventorySaving, setIsInventorySaving] = useState(false);
  const [inventoryMessage, setInventoryMessage] = useState("");
  const [feedbackRows, setFeedbackRows] = useState<AdminFeedbackRow[]>([]);
  const [adminRewards, setAdminRewards] = useState<AdminRewardsPayload | null>(
    null
  );
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [storeStatus, setStoreStatus] = useState<StoreStatusPayload | null>(null);
  const [storeOverrideStatus, setStoreOverrideStatus] =
    useState<StoreOverrideStatus>("auto");
  const [isStoreStatusUpdating, setIsStoreStatusUpdating] = useState(false);
  const [storeStatusError, setStoreStatusError] = useState("");

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
  const analyticsDailySummary = useMemo(() => {
    if (analyticsDaily.length === 0) {
      return null;
    }

    const totalOrders = analyticsDaily.reduce(
      (sum, row) => sum + Number(row.order_count ?? 0),
      0
    );
    const totalRevenue = analyticsDaily.reduce(
      (sum, row) => sum + Number(row.total_revenue ?? 0),
      0
    );
    const weightedRating = analyticsDaily.reduce(
      (sum, row) => sum + Number(row.avg_rating ?? 0) * Number(row.order_count ?? 0),
      0
    );
    const weekdayCounts = weekDays.map((day) => ({
      day,
      orders: analyticsDaily
        .filter((row) => normalizeAnalyticsWeekday(row.day_of_week) === day)
        .reduce((sum, row) => sum + Number(row.order_count ?? 0), 0),
    }));

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
      averageRating: totalOrders ? weightedRating / totalOrders : 0,
      weekdayCounts,
    };
  }, [analyticsDaily]);
  const syncMeta = isLoading
    ? "Syncing..."
    : `Auto-sync 15s${
        lastSyncedAt
          ? ` - Last ${lastSyncedAt.toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
            })}`
          : ""
      }`;
  const activeHeaderTitle =
    activeTab === "dashboard"
      ? "Dashboard Overview"
      : activeTab === "customer-pref"
      ? "Customer Preference"
      : activeTab === "menu"
      ? "Menu Management"
      : activeTab === "inventory"
      ? "Inventory"
      : adminTabs.find((tab) => tab.key === activeTab)?.label ?? "Admin";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    function syncSidebarState() {
      setIsSidebarOpen(mediaQuery.matches);
    }

    syncSidebarState();
    mediaQuery.addEventListener("change", syncSidebarState);

    return () => mediaQuery.removeEventListener("change", syncSidebarState);
  }, []);

  const filteredOrders = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

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
        order.reward_code ? "Free Delivery Reward Applied" : "",
        order.delivery_fee?.toString() ?? "",
        order.total_amount.toString(),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [debouncedSearch, orders]);
  const scopedMenuItems = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    if (activeTab !== "menu" || !keyword) {
      return menuItems;
    }

    return menuItems.filter((item) =>
      [
        item.name,
        item.category,
        item.price.toString(),
        item.isAvailable ? "available" : "not available",
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [activeTab, debouncedSearch, menuItems]);
  const scopedInventoryItems = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    if (activeTab !== "inventory" || !keyword) {
      return inventoryItems;
    }

    return inventoryItems.filter((item) =>
      [
        item.name,
        item.unit,
        item.supplier,
        getInventoryStatus(item),
        item.onHand.toString(),
        item.minNeed.toString(),
        item.maxCap.toString(),
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [activeTab, debouncedSearch, inventoryItems]);

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
  const analyticsItemRanking = useMemo(
    () =>
      [...analyticsItems]
        .sort(
          (first, second) =>
            Number(first.sales_rank ?? 0) - Number(second.sales_rank ?? 0) ||
            Number(second.total_revenue ?? 0) - Number(first.total_revenue ?? 0)
        )
        .map((row) => ({
          item: row.item_name,
          orders: Number(row.quantity_sold ?? 0),
          revenue: Number(row.total_revenue ?? 0),
          rating: Number(row.avg_rating ?? 0),
        })),
    [analyticsItems]
  );
  const displayItemRanking =
    analyticsItemRanking.length > 0 ? analyticsItemRanking : itemRanking;
  const scopedItemRanking = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    if (
      !keyword ||
      !["item-ranking", "satisfaction", "dashboard"].includes(activeTab)
    ) {
      return displayItemRanking;
    }

    return displayItemRanking.filter((item) =>
      [
        item.item,
        item.orders.toString(),
        item.revenue.toString(),
        item.rating.toFixed(1),
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [activeTab, debouncedSearch, displayItemRanking]);
  const scopedFeedbackRows = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    if (activeTab !== "satisfaction" || !keyword) {
      return feedbackRows;
    }

    return feedbackRows.filter((row) =>
      [
        row.menu_items?.name,
        row.menu_items?.category,
        row.profiles?.full_name,
        row.profiles?.email,
        row.comment,
        row.overall_rating?.toString(),
        row.taste_rating?.toString(),
        row.strength_rating?.toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [activeTab, debouncedSearch, feedbackRows]);
  const scopedCustomerPreferenceOrders = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    if (activeTab !== "customer-pref" || !keyword) {
      return orders;
    }

    return orders.filter((order) =>
      [
        getOrderDisplayName(order),
        formatOrderItems(order),
        order.order_type,
        order.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [activeTab, debouncedSearch, orders]);

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

  const analyticsHourlyCounts = useMemo(() => {
    if (analyticsHourly.length === 0) {
      return null;
    }

    const rowsByHour = new Map(
      analyticsHourly.map((row) => [Number(row.hour_of_day), row])
    );

    return hourNumbers.map((hour) => {
      const row = rowsByHour.get(hour);

      return {
        label: row?.hour_label ?? formatHourNumber(hour),
        orders: Number(row?.order_count ?? 0),
      };
    });
  }, [analyticsHourly]);
  const analyticsHourlyDateLabel = formatAnalyticsDateLabel(
    analyticsHourly[0]?.order_date ?? null
  );
  const weeklyTrendCounts = useMemo(() => {
    if (analyticsWeekly.length === 0) {
      return [];
    }

    return [...analyticsWeekly]
      .sort(
        (left, right) =>
          new Date(`${left.week_start_date}T00:00:00+08:00`).getTime() -
          new Date(`${right.week_start_date}T00:00:00+08:00`).getTime()
      )
      .slice(-8)
      .map((row) => ({
        label: formatWeeklyRangeLabel(row.week_start_date, row.week_end_date),
        orders: Number(row.order_count ?? 0),
      }));
  }, [analyticsWeekly]);
  const weeklyTrendLabel = analyticsWeekly[0]
    ? formatWeeklyRangeLabel(
        analyticsWeekly[0].week_start_date,
        analyticsWeekly[0].week_end_date
      )
    : "Weekly Trend";
  const hourlyCounts = useMemo(() => {
    if (analyticsHourlyCounts) {
      return analyticsHourlyCounts;
    }

    return hourNumbers.map((hour) => {
      const ordersInHour = nonCancelledOrders.filter(
        (order) => getManilaHour(order.ordered_at) === hour
      ).length;

      return {
        label: formatHourNumber(hour),
        orders: ordersInHour,
      };
    });
  }, [analyticsHourlyCounts, nonCancelledOrders]);
  const scopedHourlyCounts = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    if (activeTab !== "time-series" || !keyword) {
      return hourlyCounts;
    }

    return hourlyCounts.filter((item) =>
      [item.label, `${item.orders} orders`]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [activeTab, debouncedSearch, hourlyCounts]);
  const scopedPeakHourWindows = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    if (activeTab !== "peak-hours" || !keyword) {
      return peakHourWindows;
    }

    return peakHourWindows.filter((window) =>
      [
        String(window.day_of_week),
        formatHourNumber(Number(window.hour_start)),
        `${window.avg_order_count} avg orders`,
        window.intensity,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [activeTab, debouncedSearch, peakHourWindows]);

  const maxHourlyOrders = Math.max(1, ...hourlyCounts.map((item) => item.orders));
  const maxScopedHourlyOrders = Math.max(
    1,
    ...scopedHourlyCounts.map((item) => item.orders)
  );
  const maxWeekdayOrders = Math.max(1, ...weekdayCounts.map((item) => item.orders));
  const maxItemOrders = Math.max(1, ...displayItemRanking.map((item) => item.orders));
  const maxScopedItemOrders = Math.max(
    1,
    ...scopedItemRanking.map((item) => item.orders)
  );
  const averageRating = feedbackRows.length
    ? feedbackRows.reduce((sum, row) => sum + Number(row.overall_rating), 0) /
      feedbackRows.length
    : 0;
  const dashboardMetrics = analyticsDailySummary ?? {
    totalOrders: nonCancelledOrders.length,
    totalRevenue: grossIncomeSales,
    averageOrderValue,
    averageRating,
    weekdayCounts,
  };
  const searchSuggestions = useMemo<AdminSearchSuggestion[]>(() => {
    const suggestions: AdminSearchSuggestion[] = [];
    const seen = new Set<string>();
    const addSuggestion = (suggestion: AdminSearchSuggestion) => {
      const key = `${suggestion.category}:${suggestion.label}`;

      if (seen.has(key) || !suggestion.label.trim()) {
        return;
      }

      seen.add(key);
      suggestions.push(suggestion);
    };

    if (activeTab === "dashboard") {
      [
        ["Total Orders", "admin-total-orders"],
        ["Gross Sales", "admin-gross-sales"],
        ["Avg Order Value", "admin-avg-order-value"],
        ["Average Rating", "admin-average-rating"],
        ["Orders - Week", "admin-orders-week"],
        ["Peak Hours", "admin-peak-hours"],
        ["Weekly Trend", "admin-weekly-trend"],
        ["Top Items", "admin-top-items"],
        ["Satisfaction", "admin-satisfaction"],
        ["Hourly Order Volume", "admin-hourly-order-volume"],
      ].forEach(([label, targetId]) =>
        addSuggestion({
          category: "Dashboard",
          label,
          query: label,
          targetId,
        })
      );
      displayItemRanking.slice(0, 8).forEach((item) =>
        addSuggestion({
          category: "Top Items",
          label: item.item,
          query: item.item,
          targetId: "admin-top-items",
        })
      );
      orders.slice(0, 8).forEach((order) => {
        const name = getOrderDisplayName(order);
        addSuggestion({
          category: "Deep Dive",
          label: `View Order History for ${name}`,
          query: name,
          targetTab: "orders",
        });
      });
    } else if (activeTab === "orders") {
      for (const order of orders.slice(0, 18)) {
        addSuggestion({
          category: "Orders",
          label: formatOrderCode(order.id),
          query: formatOrderCode(order.id),
        });
        addSuggestion({
          category: "Customers",
          label: getOrderDisplayName(order),
          query: getOrderDisplayName(order),
        });
        addSuggestion({
          category: "Fulfillment",
          label: normalizeSuggestion(order.order_type),
          query: order.order_type,
        });
        if (order.delivery_phone) {
          addSuggestion({
            category: "Phone",
            label: order.delivery_phone,
            query: order.delivery_phone,
          });
        }
        if (order.payment_method) {
          addSuggestion({
            category: "Payment",
            label: normalizeSuggestion(order.payment_method),
            query: order.payment_method,
          });
        }
        if (order.payment_status) {
          addSuggestion({
            category: "Payment",
            label: normalizeSuggestion(order.payment_status),
            query: order.payment_status,
          });
        }
        addSuggestion({
          category: "Status",
          label: normalizeSuggestion(order.status),
          query: order.status,
        });
        addSuggestion({
          category: "Prices",
          label: peso(order.total_amount),
          query: order.total_amount.toString(),
        });
      }
    } else if (activeTab === "menu") {
      menuItems.slice(0, 14).forEach((item) => {
        addSuggestion({ category: "Menu Items", label: item.name, query: item.name });
        addSuggestion({
          category: "Categories",
          label: normalizeSuggestion(item.category),
          query: item.category,
        });
      });
    } else if (activeTab === "inventory") {
      inventoryItems.slice(0, 14).forEach((item) => {
        addSuggestion({ category: "Inventory", label: item.name, query: item.name });
        addSuggestion({
          category: "Stock Status",
          label: getInventoryStatus(item),
          query: getInventoryStatus(item),
        });
      });
    } else if (activeTab === "item-ranking" || activeTab === "satisfaction") {
      displayItemRanking.slice(0, 12).forEach((item) =>
        addSuggestion({ category: "Items", label: item.item, query: item.item })
      );
    } else if (activeTab === "peak-hours" || activeTab === "time-series") {
      ["Peak Hours", "Hourly Order Volume", "12AM", "6AM", "12PM", "6PM"].forEach(
        (item) => addSuggestion({ category: "Time Metrics", label: item, query: item })
      );
    } else if (activeTab === "customer-pref") {
      orders.slice(0, 14).forEach((order) => {
        addSuggestion({
          category: "Customers",
          label: getOrderDisplayName(order),
          query: getOrderDisplayName(order),
        });
        formatOrderItems(order)
          .split(",")
          .map((item) => item.trim())
          .forEach((item) =>
            addSuggestion({ category: "Top Badges", label: item, query: item })
          );
      });
    }

    const keyword = search.trim().toLowerCase();
    const numericOnly = /^\d+$/.test(keyword);

    return suggestions
      .filter((item) => !keyword || item.label.toLowerCase().includes(keyword))
      .sort((first, second) => {
        if (!numericOnly) return 0;

        const firstNumeric = /\d/.test(first.label) ? -1 : 1;
        const secondNumeric = /\d/.test(second.label) ? -1 : 1;

        return firstNumeric - secondNumeric;
      })
      .slice(0, 8);
  }, [activeTab, displayItemRanking, inventoryItems, menuItems, orders, search]);
  const inventorySummary = {
    total: inventoryItems.length,
    normal: inventoryItems.filter((item) => getInventoryStatus(item) === "Normal").length,
    low: inventoryItems.filter((item) => getInventoryStatus(item) === "Low Stock").length,
    critical: inventoryItems.filter((item) => getInventoryStatus(item) === "Critical").length,
    overstocked: inventoryItems.filter((item) => getInventoryStatus(item) === "Overstocked").length,
  };

  const applyStoreStatus = useCallback((status: StoreStatusPayload) => {
    setStoreStatus(status);
    setStoreOverrideStatus(status.overrideStatus);
    setStoreStatusError(
      status.setupRequired ? "Run backend/seed/store-settings.sql in Supabase." : ""
    );
  }, []);

  const loadStoreStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/store-status");
      const result = (await response.json()) as StoreStatusPayload & {
        error?: string;
      };

      if (!response.ok) {
        setStoreStatusError(result.error || "Failed to load store status.");
        return;
      }

      applyStoreStatus(result);
    } catch {
      setStoreStatusError("Something went wrong while loading store status.");
    }
  }, [applyStoreStatus]);

  useEffect(() => {
    loadAdminData({ showLoading: true });
    loadStoreStatus();
  }, [loadStoreStatus]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("admin-store-status-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_settings",
        },
        () => {
          void loadStoreStatus();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadStoreStatus]);

  useEffect(() => {
    const shouldAutoSync =
      activeTab === "dashboard" ||
      activeTab === "orders" ||
      activeTab === "time-series" ||
      activeTab === "peak-hours" ||
      activeTab === "item-ranking" ||
      activeTab === "satisfaction" ||
      activeTab === "customer-pref" ||
      activeTab === "inventory" ||
      activeTab === "feedback";

    if (!shouldAutoSync) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadAdminData({ showLoading: false });
    }, 15000);

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
      const [
        ordersResponse,
        menuResponse,
        inventoryResponse,
        feedbackResponse,
        rewardsResponse,
        analyticsResponse,
        analyticsHourlyResponse,
        analyticsWeeklyResponse,
        analyticsItemsResponse,
        peakHourWindowsResponse,
      ] = await Promise.all([
        fetch("/api/staff/orders/list", { method: "GET" }),
        fetch("/api/admin/menu", { method: "GET" }),
        fetch("/api/admin/inventory", { method: "GET" }),
        fetch("/api/feedback", { method: "GET" }),
        fetch("/api/admin/rewards", { method: "GET" }),
        fetch("/api/admin/analytics/daily", { method: "GET" }),
        fetch("/api/admin/analytics/hourly", { method: "GET" }),
        fetch("/api/admin/analytics/weekly", { method: "GET" }),
        fetch("/api/admin/analytics/items", { method: "GET" }),
        fetch("/api/admin/analytics/peak-hours", { method: "GET" }),
      ]);

      const ordersResult = await ordersResponse.json();
      const menuResult = await menuResponse.json();
      const inventoryResult = (await inventoryResponse.json()) as AdminInventoryPayload;
      const feedbackResult = await feedbackResponse.json();
      const rewardsResult = await rewardsResponse.json();
      const analyticsResult = (await analyticsResponse.json()) as {
        analyticsDaily?: AdminAnalyticsDailyRow[];
        error?: string;
      };
      const analyticsHourlyResult = (await analyticsHourlyResponse.json()) as {
        analyticsDate?: string;
        analyticsHourly?: AdminAnalyticsHourlyRow[];
        error?: string;
      };
      const analyticsWeeklyResult = (await analyticsWeeklyResponse.json()) as {
        analyticsWeekly?: AdminAnalyticsWeeklyRow[];
        error?: string;
      };
      const analyticsItemsResult = (await analyticsItemsResponse.json()) as {
        analyticsItems?: AdminAnalyticsItemRow[];
        error?: string;
      };
      const peakHourWindowsResult = (await peakHourWindowsResponse.json()) as {
        peakHourWindows?: PeakHourWindow[];
        error?: string;
      };

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
      if (inventoryResponse.ok) {
        setInventoryItems(inventoryResult.inventoryItems ?? []);
        setInventoryMessage("");
      } else {
        setInventoryMessage(
          inventoryResult.error ||
            "Inventory is not set up yet. Run backend/seed/inventory-items.sql in Supabase."
        );
      }
      if (feedbackResponse.ok) {
        setFeedbackRows(feedbackResult.feedback ?? []);
      }
      if (rewardsResponse.ok) {
        setAdminRewards(rewardsResult);
      }
      if (analyticsResponse.ok) {
        setAnalyticsDaily(analyticsResult.analyticsDaily ?? []);
      } else {
        setAnalyticsDaily([]);
      }
      if (analyticsHourlyResponse.ok) {
        setAnalyticsHourly(analyticsHourlyResult.analyticsHourly ?? []);
      } else {
        setAnalyticsHourly([]);
      }
      if (analyticsWeeklyResponse.ok) {
        setAnalyticsWeekly(analyticsWeeklyResult.analyticsWeekly ?? []);
      } else {
        setAnalyticsWeekly([]);
      }
      if (analyticsItemsResponse.ok) {
        setAnalyticsItems(analyticsItemsResult.analyticsItems ?? []);
      } else {
        setAnalyticsItems([]);
      }
      if (peakHourWindowsResponse.ok) {
        setPeakHourWindows(peakHourWindowsResult.peakHourWindows ?? []);
      } else {
        setPeakHourWindows([]);
      }
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

  async function handleRefreshAnalytics() {
    setError("");

    try {
      const [
        dailyResponse,
        hourlyResponse,
        weeklyResponse,
        itemsResponse,
        customerPreferencesResponse,
      ] = await Promise.all([
        fetch("/api/admin/analytics/daily", {
          method: "POST",
        }),
        fetch("/api/admin/analytics/hourly", {
          method: "POST",
        }),
        fetch("/api/admin/analytics/weekly", {
          method: "POST",
        }),
        fetch("/api/admin/analytics/items", {
          method: "POST",
        }),
        fetch("/api/admin/analytics/customer-preferences", {
          method: "POST",
        }),
      ]);
      const dailyResult = (await dailyResponse.json()) as { error?: string };
      const hourlyResult = (await hourlyResponse.json()) as { error?: string };
      const weeklyResult = (await weeklyResponse.json()) as { error?: string };
      const itemsResult = (await itemsResponse.json()) as { error?: string };
      const customerPreferencesResult = (await customerPreferencesResponse.json()) as {
        error?: string;
      };

      if (
        !dailyResponse.ok ||
        !hourlyResponse.ok ||
        !weeklyResponse.ok ||
        !itemsResponse.ok ||
        !customerPreferencesResponse.ok
      ) {
        setError(
          dailyResult.error ||
            hourlyResult.error ||
            weeklyResult.error ||
            itemsResult.error ||
            customerPreferencesResult.error ||
            "Failed to refresh analytics."
        );
        return;
      }

      const peakHoursResponse = await fetch("/api/admin/analytics/peak-hours", {
        method: "POST",
      });
      const peakHoursResult = (await peakHoursResponse.json()) as { error?: string };

      if (!peakHoursResponse.ok) {
        setError(peakHoursResult.error || "Failed to refresh peak-hour windows.");
        return;
      }

      await loadAdminData({ showLoading: true });
    } catch {
      setError("Something went wrong while refreshing analytics.");
    }
  }

  async function handleStoreOverrideChange(overrideStatus: StoreOverrideStatus) {
    setIsStoreStatusUpdating(true);
    setStoreStatusError("");

    try {
      const response = await fetch("/api/store-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ overrideStatus }),
      });
      const result = (await response.json()) as StoreStatusPayload & {
        error?: string;
      };

      if (!response.ok) {
        setStoreStatusError(result.error || "Failed to update store status.");
        return;
      }

      applyStoreStatus(result);
    } catch {
      setStoreStatusError("Something went wrong while updating store status.");
    } finally {
      setIsStoreStatusUpdating(false);
    }
  }

  function replaceInventoryItem(savedItem: InventoryItem) {
    setInventoryItems((currentItems) => {
      const itemIndex = currentItems.findIndex(
        (item) =>
          (savedItem.id && item.id === savedItem.id) ||
          item.name.toLowerCase() === savedItem.name.toLowerCase()
      );

      if (itemIndex === -1) {
        return [savedItem, ...currentItems];
      }

      return currentItems.map((item, index) =>
        index === itemIndex ? savedItem : item
      );
    });
  }

  async function saveInventoryItem(item: InventoryItem) {
    const existingItem = inventoryItems.find(
      (currentItem) =>
        currentItem.id === item.id ||
        currentItem.name.toLowerCase() === item.name.toLowerCase()
    );
    const optimisticItem = { ...existingItem, ...item };

    replaceInventoryItem(optimisticItem);
    setIsInventorySaving(true);
    setInventoryMessage("Saving inventory to Supabase...");

    try {
      const response = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(optimisticItem),
      });
      const result = (await response.json()) as AdminInventoryPayload;

      if (!response.ok || !result.item) {
        setInventoryMessage(result.error || "Failed to save inventory item.");
        void loadAdminData({ showLoading: false });
        return;
      }

      replaceInventoryItem(result.item);
      setInventoryMessage("Inventory saved.");
    } catch {
      setInventoryMessage("Something went wrong while saving inventory.");
      void loadAdminData({ showLoading: false });
    } finally {
      setIsInventorySaving(false);
    }
  }

  async function setInventoryStock(item: InventoryItem, onHand: number) {
    replaceInventoryItem({ ...item, onHand });

    if (!item.id) {
      await saveInventoryItem({ ...item, onHand });
      return;
    }

    setIsInventorySaving(true);
    setInventoryMessage("Saving stock level...");

    try {
      const response = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: item.id, onHand }),
      });
      const result = (await response.json()) as AdminInventoryPayload;

      if (!response.ok || !result.item) {
        setInventoryMessage(result.error || "Failed to update stock level.");
        void loadAdminData({ showLoading: false });
        return;
      }

      replaceInventoryItem(result.item);
      setInventoryMessage("Stock level saved.");
    } catch {
      setInventoryMessage("Something went wrong while updating stock.");
      void loadAdminData({ showLoading: false });
    } finally {
      setIsInventorySaving(false);
    }
  }

  async function addInventoryStock(item: InventoryItem, amount: number) {
    replaceInventoryItem({ ...item, onHand: item.onHand + amount });

    if (!item.id) {
      await saveInventoryItem({ ...item, onHand: item.onHand + amount });
      return;
    }

    setIsInventorySaving(true);
    setInventoryMessage("Adding stock delivery...");

    try {
      const response = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: item.id, addStock: amount }),
      });
      const result = (await response.json()) as AdminInventoryPayload;

      if (!response.ok || !result.item) {
        setInventoryMessage(result.error || "Failed to add stock.");
        void loadAdminData({ showLoading: false });
        return;
      }

      replaceInventoryItem(result.item);
      setInventoryMessage("Stock delivery saved.");
    } catch {
      setInventoryMessage("Something went wrong while adding stock.");
      void loadAdminData({ showLoading: false });
    } finally {
      setIsInventorySaving(false);
    }
  }

  function handleSearchSuggestionSelect(suggestion: AdminSearchSuggestion) {
    setSearch(suggestion.query);
    setIsSearchFocused(false);

    if (suggestion.targetTab) {
      setActiveTab(suggestion.targetTab);
    }

    if (suggestion.targetId) {
      window.setTimeout(() => {
        document
          .getElementById(suggestion.targetId as string)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }

  function handleTabSelect(tab: AdminTab) {
    setActiveTab(tab);

    if (tab === "feedback" || tab === "rewards" || tab === "inventory") {
      void loadAdminData({ showLoading: false });
    }

    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF0DA] text-[#0D2E18]">
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-[#0D2E18]/35 lg:hidden"
        />
      ) : null}

      <div
        className={`min-h-screen transition-all duration-300 lg:grid ${isSidebarOpen
          ? "lg:grid-cols-[190px_minmax(0,1fr)]"
          : "lg:grid-cols-[76px_minmax(0,1fr)]"
          }`}
      >
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[220px] flex-col overflow-hidden rounded-r-[26px] bg-[#0D2E18] text-[#FFF0DA] transition-transform duration-300 lg:sticky lg:top-0 lg:w-auto lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div
            className={`flex items-center gap-3 pt-9 ${isSidebarOpen ? "justify-between px-7" : "justify-center px-3"
              }`}
          >
            <p
              className={`font-sans font-semibold leading-none tracking-[-0.04em] transition-all ${isSidebarOpen ? "text-[2rem]" : "text-[1.35rem]"
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
                  onClick={() => handleTabSelect(tab.key)}
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
          <header className="border-b border-[#DCCFB8] bg-white/88">
            <div className="grid gap-3 px-5 py-3 xl:grid-cols-[1fr_auto_1fr] xl:items-center xl:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open admin navigation"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] transition hover:bg-white lg:hidden"
                >
                  <MenuIcon size={18} />
                </button>
                <div>
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
                    Admin Dashboard
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <h1 className="font-sans text-2xl font-bold leading-none text-[#0D2E18]">
                      {activeHeaderTitle}
                    </h1>
                    <button
                      type="button"
                      onClick={() => void handleRefreshAnalytics()}
                      disabled={isLoading}
                      aria-label="Refresh analytics"
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-[#D6C6AC] bg-[#FFF8EF] px-3 font-sans text-xs font-bold text-[#684B35] transition hover:bg-white disabled:opacity-60"
                    >
                      <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
                      <span className="hidden sm:inline">Refresh Analytics</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="hidden xl:block" />

              <div className="flex flex-wrap items-center justify-start gap-3 xl:justify-end">
                <div className="relative w-full max-w-[260px]">
                  <label className="flex h-10 items-center gap-2 rounded-[14px] bg-[#FFF0DA] px-3 shadow-[inset_0_0_0_1px_rgba(216,200,167,0.42)]">
                    <Search size={15} className="text-[#8C7A64]" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => {
                        window.setTimeout(() => setIsSearchFocused(false), 140);
                      }}
                      placeholder="Search records..."
                      className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                    />
                  </label>

                  {isSearchFocused && searchSuggestions.length > 0 ? (
                    <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-[16px] border border-[#DCCFB8] bg-white shadow-[0_14px_28px_rgba(13,46,24,0.14)]">
                      <p className="border-b border-[#EFE3CF] px-3 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-[#684B35]">
                        Suggested searches
                      </p>
                      <div className="max-h-64 overflow-y-auto py-1">
                        {searchSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.category}-${suggestion.label}`}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleSearchSuggestionSelect(suggestion)}
                            className="block w-full px-3 py-2 text-left transition hover:bg-[#FFF0DA]"
                          >
                            <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-[#684B35]">
                              {suggestion.category}
                            </span>
                            <span className="block font-sans text-sm font-semibold text-[#0D2E18]">
                              {suggestion.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 font-sans text-xs font-bold ${
                      storeStatus?.effectiveStatus === "open"
                        ? "bg-[#E9F5E7] text-[#0D2E18]"
                        : storeStatus?.effectiveStatus === "busy"
                        ? "bg-[#FFF0DA] text-[#684B35]"
                        : "bg-[#FFF1EC] text-[#9C543D]"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        storeStatus?.effectiveStatus === "open"
                          ? "bg-[#0F441D]"
                          : storeStatus?.effectiveStatus === "busy"
                          ? "bg-[#684B35]"
                          : "bg-[#9C543D]"
                      }`}
                    />
                    {storeStatus?.label ?? "Loading"}
                  </span>

                  <select
                    value={storeOverrideStatus}
                    onChange={(event) =>
                      handleStoreOverrideChange(
                        event.target.value as StoreOverrideStatus
                      )
                    }
                    disabled={isStoreStatusUpdating}
                    aria-label="Master store status override"
                    className="h-10 rounded-full border border-[#D6C6AC] bg-[#FFF8EF] px-3 font-sans text-xs font-semibold text-[#684B35] outline-none transition hover:bg-white disabled:opacity-60"
                  >
                    <option value="auto">Auto</option>
                    <option value="open">Force Open</option>
                    <option value="busy">Busy</option>
                    <option value="closed">Force Closed</option>
                  </select>

                </div>

                <p className="font-sans text-[11px] text-[#8C7A64]">
                  {syncMeta}
                </p>
              </div>
            </div>
            {storeStatusError ? (
              <p className="border-t border-[#F0DDC0] bg-[#FFF8EF] px-7 py-2 font-sans text-xs font-semibold text-[#9C543D]">
                {storeStatusError}
              </p>
            ) : null}
          </header>

          <div className="px-5 py-4 xl:px-6">
            {error ? (
              <div className="mb-5 rounded-[18px] bg-[#FFF1EC] px-5 py-4 font-sans text-sm text-[#9C543D]">
                {error}
              </div>
            ) : null}

            {activeTab === "dashboard" ? (
              <DashboardView
                averageOrderValue={dashboardMetrics.averageOrderValue}
                hourlyDateLabel={analyticsHourlyDateLabel}
                hourlyCounts={hourlyCounts}
                itemRanking={displayItemRanking}
                maxHourlyOrders={maxHourlyOrders}
                maxItemOrders={maxItemOrders}
                maxWeekdayOrders={maxWeekdayOrders}
                nonCancelledOrders={nonCancelledOrders}
                weeklyTrendCounts={weeklyTrendCounts}
                weeklyTrendLabel={weeklyTrendLabel}
                grossIncomeSales={dashboardMetrics.totalRevenue}
                averageRating={dashboardMetrics.averageRating}
                totalOrders={dashboardMetrics.totalOrders}
                search={debouncedSearch}
                weekdayCounts={dashboardMetrics.weekdayCounts}
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
                dateLabel={analyticsHourlyDateLabel}
                hourlyCounts={scopedHourlyCounts}
                maxHourlyOrders={maxScopedHourlyOrders}
              />
            ) : null}

            {activeTab === "peak-hours" ? (
              <PeakHoursView peakHourWindows={scopedPeakHourWindows} />
            ) : null}

            {activeTab === "item-ranking" ? (
              <ItemRankingView
                itemRanking={scopedItemRanking}
                maxItemOrders={maxScopedItemOrders}
              />
            ) : null}

            {activeTab === "satisfaction" ? (
              <SatisfactionView feedbackRows={scopedFeedbackRows} />
            ) : null}

            {activeTab === "customer-pref" ? (
              <CustomerPreferenceView
                feedbackRows={feedbackRows}
                menuItems={menuItems}
                orders={scopedCustomerPreferenceOrders}
              />
            ) : null}

            {activeTab === "rewards" ? (
              <RewardsManagementView
                orders={orders}
                adminRewards={adminRewards}
              />
            ) : null}

            {activeTab === "feedback" ? (
              <FeedbackManagementView feedbackRows={feedbackRows} />
            ) : null}

            {activeTab === "menu" ? (
              <MenuView menuItems={scopedMenuItems} setMenuItems={setMenuItems} />
            ) : null}

            {activeTab === "inventory" ? (
              <InventoryView
                inventoryItems={scopedInventoryItems}
                inventorySummary={inventorySummary}
                onSetStock={setInventoryStock}
                onAddStock={addInventoryStock}
                onSaveItem={saveInventoryItem}
                isInventorySaving={isInventorySaving}
                inventoryMessage={inventoryMessage}
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



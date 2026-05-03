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
import type {
  StoreOverrideStatus,
  StoreStatusPayload,
} from "@/lib/store-status";
import type { AdminMenuItem } from "@/types/menu";
import type { StaffOrder } from "@/types/orders";

const weekDays = ["MON", "TUES", "WED", "THURS", "FRI", "SAT", "SUN"];
const hourLabels = ["5PM", "6PM", "7PM", "8PM", "9PM", "10PM", "11PM", "12AM"];

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
  const isMidnight = label.includes("A") && hourNumber === 12;

  if (isMidnight) return 0;
  return isPm ? hourNumber + 12 : hourNumber;
}

function formatHourLabel(dateValue: string) {
  return new Date(dateValue)
    .toLocaleTimeString("en-PH", {
      hour: "numeric",
      hour12: true,
    })
    .replace(":00", "")
    .replace(" ", "")
    .toUpperCase();
}

function isSameManilaDate(value: string, date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date(value)) === formatter.format(date);
}

function peso(value: number) {
  return `\u20B1${Math.round(value).toLocaleString("en-PH")}`;
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
  type: "delivery_fee";
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

function normalizeSuggestion(value: string) {
  return value.trim().replaceAll("_", " ");
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
      <div>
        <h1 className="font-sans text-3xl font-bold text-[#0D2E18]">
          Rewards Management
        </h1>
        <p className="mt-1 font-sans text-sm text-[#684B35]">
          Monitor redeemed vouchers, used rewards, and the active reward pool.
        </p>
      </div>

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
          Active Reward Items
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
                Reward type: Free Delivery
              </p>
              <p className="mt-2 font-sans text-sm text-[#684B35]">
                {item.pointsCost} pts - {peso(item.value)} delivery fee waived
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-sans text-3xl font-bold text-[#0D2E18]">
          Customer Feedback
        </h1>
        <p className="mt-1 font-sans text-sm text-[#684B35]">
          Aggregate customer responses from completed orders.
        </p>
      </div>

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
          <h2 className="font-sans text-xl font-bold text-[#0D2E18]">
            Latest Responses
          </h2>
          <div className="mt-4 space-y-3">
            {feedbackRows.slice(0, 8).map((row) => (
              <article
                key={row.id}
                className="rounded-[14px] border border-[#EFE3CF] bg-[#FFF8EF] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-sans text-sm font-bold text-[#0D2E18]">
                    {row.menu_items?.name || "Menu item"}
                  </p>
                  <span className="rounded-full bg-[#E7F4EA] px-3 py-1 font-sans text-xs font-bold text-[#0D2E18]">
                    {Number(row.overall_rating).toFixed(1)} / 5
                  </span>
                </div>
                {row.comment ? (
                  <p className="mt-2 font-sans text-sm text-[#684B35]">
                    {row.comment}
                  </p>
                ) : null}
              </article>
            ))}
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
  const totalSalesToday = useMemo(
    () =>
      paidOrders
        .filter((order) => isSameManilaDate(order.ordered_at))
        .reduce((sum, order) => sum + order.total_amount, 0),
    [paidOrders]
  );

  const averageOrderValue = paidOrders.length
    ? grossIncomeSales / paidOrders.length
    : 0;
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
  }, [activeTab, debouncedSearch]);

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
  const scopedItemRanking = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    if (
      !keyword ||
      !["item-ranking", "satisfaction", "dashboard"].includes(activeTab)
    ) {
      return itemRanking;
    }

    return itemRanking.filter((item) =>
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
  }, [activeTab, debouncedSearch, itemRanking]);
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
  const scopedPeakHourOrders = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    if (activeTab !== "peak-hours" || !keyword) {
      return orders;
    }

    return orders.filter((order) =>
      [
        normalizeWeekday(order.ordered_at),
        formatHourLabel(order.ordered_at),
        getOrderDisplayName(order),
        order.status,
        order.order_type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [activeTab, debouncedSearch, orders]);

  const maxHourlyOrders = Math.max(1, ...hourlyCounts.map((item) => item.orders));
  const maxScopedHourlyOrders = Math.max(
    1,
    ...scopedHourlyCounts.map((item) => item.orders)
  );
  const maxWeekdayOrders = Math.max(1, ...weekdayCounts.map((item) => item.orders));
  const maxItemOrders = Math.max(1, ...itemRanking.map((item) => item.orders));
  const maxScopedItemOrders = Math.max(
    1,
    ...scopedItemRanking.map((item) => item.orders)
  );
  const averageRating = itemRanking.length
    ? itemRanking.reduce((sum, item) => sum + item.rating, 0) / itemRanking.length
    : 0;
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
      itemRanking.slice(0, 8).forEach((item) =>
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
      itemRanking.slice(0, 12).forEach((item) =>
        addSuggestion({ category: "Items", label: item.item, query: item.item })
      );
    } else if (activeTab === "peak-hours" || activeTab === "time-series") {
      ["Peak Hours", "Hourly Order Volume", "5PM", "6PM", "7PM", "8PM"].forEach(
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
  }, [activeTab, itemRanking, menuItems, orders, search]);
  const inventorySummary = {
    total: inventoryItems.length,
    normal: inventoryItems.filter((item) => getInventoryStatus(item) === "Good Stock").length,
    low: inventoryItems.filter((item) => getInventoryStatus(item) === "Low Stock").length,
    critical: inventoryItems.filter((item) => getInventoryStatus(item) === "Critical").length,
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
        feedbackResponse,
        rewardsResponse,
      ] = await Promise.all([
        fetch("/api/staff/orders/list", { method: "GET" }),
        fetch("/api/admin/menu", { method: "GET" }),
        fetch("/api/feedback", { method: "GET" }),
        fetch("/api/admin/rewards", { method: "GET" }),
      ]);

      const ordersResult = await ordersResponse.json();
      const menuResult = await menuResponse.json();
      const feedbackResult = await feedbackResponse.json();
      const rewardsResult = await rewardsResponse.json();

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
      if (feedbackResponse.ok) {
        setFeedbackRows(feedbackResult.feedback ?? []);
      }
      if (rewardsResponse.ok) {
        setAdminRewards(rewardsResult);
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

    if (tab === "feedback" || tab === "rewards") {
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
            <div className="grid gap-4 px-7 py-4 xl:grid-cols-[1fr_auto_1fr] xl:items-center">
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
                    <h1 className="font-sans text-3xl font-bold leading-none text-[#0D2E18]">
                      Dashboard Overview
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        loadAdminData({ showLoading: true });
                        void loadStoreStatus();
                      }}
                      disabled={isLoading}
                      aria-label="Sync admin dashboard"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] transition hover:bg-white disabled:opacity-60"
                    >
                      <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[18px] border border-[#DCCFB8] bg-[#FFF8EF] px-4 py-2.5 shadow-[0_8px_18px_rgba(13,46,24,0.06)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0D2E18] font-sans text-sm font-black text-[#FFF0DA]">
                  AD
                </div>
                <div className="min-w-[120px] font-sans">
                  <p className="text-sm font-bold text-[#0D2E18]">Admin</p>
                  <p className="text-[11px] text-[#8C7A64]">Owner Control</p>
                </div>
                <span className="h-9 w-px bg-[#DCCFB8]" />
                <div className="font-sans">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#684B35]">
                    Total Sales Today
                  </p>
                  <p className="text-xl font-black tabular-nums text-[#0D2E18]">
                    {peso(totalSalesToday)}
                  </p>
                </div>
              </div>

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
                search={debouncedSearch}
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
                hourlyCounts={scopedHourlyCounts}
                maxHourlyOrders={maxScopedHourlyOrders}
              />
            ) : null}

            {activeTab === "peak-hours" ? <PeakHoursView orders={scopedPeakHourOrders} /> : null}

            {activeTab === "item-ranking" ? (
              <ItemRankingView
                itemRanking={scopedItemRanking}
                maxItemOrders={maxScopedItemOrders}
              />
            ) : null}

            {activeTab === "satisfaction" ? (
              <SatisfactionView itemRanking={scopedItemRanking} />
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



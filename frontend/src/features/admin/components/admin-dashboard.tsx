"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  Clock,
  X,
  LogOut,
  Coffee,
  Menu,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  ItemRankingView,
  SatisfactionView,
} from "@/features/admin/components/admin-insights-views";
import { useToast } from "@/components/ui/toast-provider";
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
import type { StoreStatusPayload } from "@/lib/store-status";
import {
  getAdminOrderTotals,
  getAdminOrdersMetricLabel,
  getAdminReportOrders,
} from "@/lib/admin-order-totals";
import {
  getAnalyticsOrderCount,
  sortAnalyticsItemsByGlobalRanking,
} from "@/lib/analytics-ranking";
import { formatNameFromEmail, maskCustomerName } from "@/lib/customer-display";
import type { AdminMenuItem } from "@/types/menu";
import type { StaffOrder } from "@/types/orders";

const weekDays = ["MON", "TUES", "WED", "THURS", "FRI", "SAT", "SUN"];
const hourNumbers = [17, 18, 19, 20, 21, 22, 23, 0];

function getTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function formatOrderCode(id: string) {
  return `#KD-${id.slice(0, 4).toUpperCase()}`;
}

function getOrderDisplayName(order: StaffOrder) {
  return maskCustomerName(
    order.walkin_name?.trim() ||
    formatNameFromEmail(order.delivery_email) ||
    null,
    order.order_type === "delivery" ? "Delivery Customer" : "Walk-in Customer"
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

function getFeedbackRatingStyle(value: number) {
  if (value >= 4) {
    return "bg-[#E6F2E8] text-[#0F441D]";
  }

  if (value >= 3) {
    return "bg-[#FFF0DA] text-[#684B35]";
  }

  return "bg-[#FFF1EC] text-[#C55432]";
}

type AdminSearchSuggestion = {
  category: string;
  label: string;
  query: string;
  targetId?: string;
  targetTab?: AdminTab;
  targetDemandView?: DemandView;
};

type DemandView = "orders" | "time-series" | "peak-hours";
type CustomerIntelligenceView = "item-ranking" | "feedback";

const demandViews: Array<{
  key: DemandView;
  label: string;
  description: string;
}> = [
  {
    key: "orders",
    label: "Orders",
    description: "All order records",
  },
  {
    key: "time-series",
    label: "Time Series",
    description: "Hourly demand volume",
  },
  {
    key: "peak-hours",
    label: "Peak Hours",
    description: "Busiest service windows",
  },
];

const customerIntelligenceViews: Array<{
  key: CustomerIntelligenceView;
  label: string;
}> = [
  {
    key: "item-ranking",
    label: "Ranking",
  },
  {
    key: "feedback",
    label: "Feedback",
  },
];

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

function getOrderWeekdayLabel(value: string) {
  return normalizeAnalyticsWeekday(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      weekday: "long",
    }).format(new Date(value))
  );
}

function FeedbackManagementView({
  feedbackRows,
}: {
  feedbackRows: AdminFeedbackRow[];
}) {
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
  const [feedbackFilter, setFeedbackFilter] = useState<
    "all" | "five" | "four" | "review"
  >("all");
  const visibleFeedbackRows = sortedFeedbackRows.filter((row) => {
    const rating = Number(row.overall_rating);
    if (feedbackFilter === "five") return rating >= 5;
    if (feedbackFilter === "four") return rating >= 4 && rating < 5;
    if (feedbackFilter === "review") return rating < 3;
    return true;
  });
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const selectedFeedback =
    visibleFeedbackRows.find((row) => row.id === selectedFeedbackId) ??
    visibleFeedbackRows[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-[#DCCFB8] bg-[#FFFCF7] p-3 shadow-[0_10px_24px_rgba(75,50,24,0.06)]">
        {([
          ["all", "All"],
          ["five", "5 star"],
          ["four", "4 star"],
          ["review", "Review"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFeedbackFilter(key)}
            className={`rounded-full px-4 py-2 font-sans text-xs font-black transition ${
              feedbackFilter === key
                ? "bg-[#0D2E18] text-[#FFF8EF] shadow-[0_8px_18px_rgba(13,46,24,0.16)]"
                : "border border-[#DCCFB8] bg-[#FFF8EF] text-[#684B35] hover:bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-[22px] border border-[#DCCFB8] bg-[#FFFCF7] p-4 shadow-[0_12px_28px_rgba(75,50,24,0.07)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-sans text-lg font-black text-[#0D2E18]">
              Item Feedback Map
            </h2>
            <span className="rounded-full border border-[#DCCFB8] bg-white px-3 py-1 font-sans text-xs font-bold text-[#684B35]">
              Avg / 5
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {itemSummaries.map((item) => (
              <div
                key={item.item}
                className="rounded-[16px] border border-[#EFE3CF] bg-white px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-sans text-sm font-bold text-[#0D2E18]">
                    {item.item}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-sans text-xs font-black ${
                      item.average >= 4
                        ? "bg-[#E6F2E8] text-[#0F441D]"
                        : item.average >= 3
                        ? "bg-[#FFF0DA] text-[#684B35]"
                        : "bg-[#FFF1EC] text-[#C55432]"
                    }`}
                  >
                    {item.average.toFixed(1)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full border border-[#D6C6AC] bg-[#FFF8EF]">
                  <div
                    className="h-full rounded-full bg-[#0D2E18]"
                    style={{ width: `${Math.min(100, (item.average / 5) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 font-sans text-xs font-semibold text-[#8C7A64]">
                  {item.count} responses
                </p>
              </div>
            ))}
            {itemSummaries.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-6 text-center font-sans text-sm text-[#8C7A64]">
                No item averages yet
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[22px] border border-[#DCCFB8] bg-[#FFFCF7] p-4 shadow-[0_12px_28px_rgba(75,50,24,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-sans text-lg font-black text-[#0D2E18]">
              Customer Feedback
            </h2>
            <span className="rounded-full border border-[#DCCFB8] bg-white px-3 py-1 font-sans text-xs font-bold text-[#684B35]">
              {visibleFeedbackRows.length} shown
            </span>
          </div>
          {selectedFeedback ? (
            <div className="mt-4 rounded-[20px] border border-[#DCCFB8] bg-white p-4 shadow-[0_10px_22px_rgba(75,50,24,0.06)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-sans text-base font-black text-[#0D2E18]">
                    {selectedFeedback.menu_items?.name || "Menu item"}
                  </p>
                  <p className="mt-1 font-sans text-xs font-bold text-[#8C7A64]">
                    {maskCustomerName(
                      selectedFeedback.profiles?.full_name ||
                        formatNameFromEmail(selectedFeedback.profiles?.email),
                      "Customer"
                    )}{" "}
                    - {formatFeedbackDateTime(selectedFeedback.created_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 font-sans text-xs font-black ${getFeedbackRatingStyle(
                    Number(selectedFeedback.overall_rating)
                  )}`}
                >
                  {Number(selectedFeedback.overall_rating).toFixed(1)} / 5
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  ["Overall", selectedFeedback.overall_rating],
                  ["Taste", selectedFeedback.taste_rating],
                  ["Strength", selectedFeedback.strength_rating],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-[14px] border border-[#EFE3CF] bg-[#FFF8EF] px-3 py-2"
                  >
                    <p className="font-sans text-[10px] font-black uppercase tracking-[0.12em] text-[#684B35]">
                      {label}
                    </p>
                    <p className="mt-1 font-sans text-lg font-black text-[#0D2E18]">
                      {Number(value).toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-4 rounded-[16px] bg-[#FFF8EF] px-3 py-3 font-sans text-sm font-semibold leading-relaxed text-[#684B35]">
                {selectedFeedback.comment?.trim() || "No comment provided."}
              </p>
            </div>
          ) : null}

          <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {visibleFeedbackRows.map((row) => {
              const isSelected = selectedFeedback?.id === row.id;

              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedFeedbackId(row.id)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-[#0D2E18] bg-[#E6F2E8]"
                      : "border-[#EFE3CF] bg-white hover:border-[#0D2E18]/30 hover:bg-[#FFF8EF]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-sans text-sm font-black text-[#0D2E18]">
                      {row.menu_items?.name || "Menu item"}
                    </p>
                    <p className="mt-1 truncate font-sans text-xs font-bold text-[#8C7A64]">
                      {maskCustomerName(
                        row.profiles?.full_name || formatNameFromEmail(row.profiles?.email),
                        "Customer"
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-black ${getFeedbackRatingStyle(
                        Number(row.overall_rating)
                      )}`}
                    >
                      {Number(row.overall_rating).toFixed(1)}
                    </span>
                    <p className="mt-1 font-sans text-[10px] font-bold text-[#8C7A64]">
                      {formatFeedbackDateTime(row.created_at)}
                    </p>
                  </div>
                </button>
              );
            })}
            {visibleFeedbackRows.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-6 text-center font-sans text-sm text-[#8C7A64]">
                No matching feedback
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
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [demandView, setDemandView] = useState<DemandView>("orders");
  const [customerIntelligenceView, setCustomerIntelligenceView] =
    useState<CustomerIntelligenceView>("item-ranking");
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [menuItems, setMenuItems] = useState<AdminMenuItem[]>([]);
  const [analyticsHourly, setAnalyticsHourly] = useState<AdminAnalyticsHourlyRow[]>(
    []
  );
  const [analyticsWeekly, setAnalyticsWeekly] = useState<AdminAnalyticsWeeklyRow[]>(
    []
  );
  const [analyticsItems, setAnalyticsItems] = useState<AdminAnalyticsItemRow[]>([]);
  const [peakHourWindows, setPeakHourWindows] = useState<PeakHourWindow[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<AdminFeedbackRow[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingAnalytics, setIsRefreshingAnalytics] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [storeStatus, setStoreStatus] = useState<StoreStatusPayload | null>(null);
  const [storeStatusError, setStoreStatusError] = useState("");

  const nonCancelledOrders = useMemo(
    () => orders.filter((order) => order.status !== "cancelled"),
    [orders]
  );

  const dashboardTimeFilter = "month" as const;
  const dashboardOrders = useMemo(
    () => getAdminReportOrders(nonCancelledOrders, { timeFilter: dashboardTimeFilter }),
    [nonCancelledOrders]
  );
  const dashboardOrderTotals = useMemo(
    () => getAdminOrderTotals(dashboardOrders),
    [dashboardOrders]
  );
  const dashboardWeekdayCounts = useMemo(
    () =>
      weekDays.map((day) => ({
        day,
        orders: dashboardOrders.filter(
          (order) => getOrderWeekdayLabel(order.ordered_at) === day
        ).length,
      })),
    [dashboardOrders]
  );
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
    : activeTab === "demand"
      ? "Demand"
      : activeTab === "customer-intelligence"
      ? "Customers"
      : activeTab === "menu"
      ? "Menu Management"
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
      sortAnalyticsItemsByGlobalRanking(analyticsItems)
        .map((row) => ({
          item: row.item_name,
          orders: getAnalyticsOrderCount(row),
          revenue: Number(row.total_revenue ?? 0),
          rating: Number(row.avg_rating ?? 0),
        })),
    [analyticsItems]
  );
  const displayItemRanking =
    analyticsItemRanking.length > 0 ? analyticsItemRanking : itemRanking;
  const scopedItemRanking = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();
    const shouldFilterItems =
      activeTab === "dashboard" ||
      (activeTab === "customer-intelligence" &&
        customerIntelligenceView === "item-ranking");

    if (!keyword || !shouldFilterItems) {
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
  }, [activeTab, customerIntelligenceView, debouncedSearch, displayItemRanking]);
  const scopedFeedbackRows = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();
    const shouldFilterFeedback =
      activeTab === "customer-intelligence" && customerIntelligenceView === "feedback";

    if (!shouldFilterFeedback || !keyword) {
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
  }, [activeTab, customerIntelligenceView, debouncedSearch, feedbackRows]);
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
  const weeklyTrendLabel = weeklyTrendCounts.at(-1)?.label ?? "Demand Growth";
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

    if (activeTab !== "demand" || demandView !== "time-series" || !keyword) {
      return hourlyCounts;
    }

    return hourlyCounts.filter((item) =>
      [item.label, `${item.orders} orders`]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [activeTab, debouncedSearch, demandView, hourlyCounts]);
  const scopedPeakHourWindows = useMemo(() => {
    const keyword = debouncedSearch.trim().toLowerCase();

    if (activeTab !== "demand" || demandView !== "peak-hours" || !keyword) {
      return peakHourWindows;
    }

    return peakHourWindows.filter((window) =>
      [
        String(window.day_of_week),
        formatHourNumber(Number(window.hour_start)),
        formatHourNumber(Number(window.hour_end)),
        window.intensity,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [activeTab, debouncedSearch, demandView, peakHourWindows]);

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
  const dashboardMetrics = {
    totalOrders: dashboardOrderTotals.totalOrders,
    totalRevenue: dashboardOrderTotals.totalRevenue,
    averageOrderValue: dashboardOrderTotals.averageOrderValue,
    averageRating,
    weekdayCounts: dashboardWeekdayCounts,
  };
  const dashboardTotalOrdersLabel = getAdminOrdersMetricLabel(dashboardTimeFilter);
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
        [dashboardTotalOrdersLabel, "admin-total-orders"],
        ["Gross Sales", "admin-gross-sales"],
        ["Avg Order Value", "admin-avg-order-value"],
        ["Average Rating", "admin-average-rating"],
        ["Orders - Week", "admin-orders-week"],
        ["Peak Hours", "admin-peak-hours"],
        ["Demand Growth", "admin-weekly-trend"],
        ["Top Items", "admin-top-items"],
        ["Satisfaction", "admin-satisfaction"],
        ["Hourly Order Volume", "admin-hourly-order-volume"],
        ["Admin Snapshot", "admin-decision-support"],
        ["Demand Signal", "admin-decision-support"],
        ["Preference Signal", "admin-decision-support"],
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
          targetTab: "demand",
          targetDemandView: "orders",
        });
      });
    } else if (activeTab === "demand") {
      if (demandView === "orders") {
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
            category: "Order Type",
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
      } else {
        ["Peak Hours", "Hourly Order Volume", "5PM", "8PM", "10PM", "12AM"].forEach(
          (item) => addSuggestion({ category: "Time Metrics", label: item, query: item })
        );
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
    } else if (activeTab === "customer-intelligence") {
      if (customerIntelligenceView === "item-ranking") {
        displayItemRanking.slice(0, 12).forEach((item) =>
          addSuggestion({ category: "Items", label: item.item, query: item.item })
        );
      } else if (customerIntelligenceView === "feedback") {
        displayItemRanking.slice(0, 8).forEach((item) =>
          addSuggestion({ category: "Items", label: item.item, query: item.item })
        );
        feedbackRows.slice(0, 14).forEach((row) => {
          if (row.profiles?.full_name) {
            const customerLabel = maskCustomerName(row.profiles.full_name, "Customer");
            addSuggestion({
              category: "Customers",
              label: customerLabel,
              query: customerLabel,
            });
          }
          if (row.menu_items?.name) {
            addSuggestion({
              category: "Feedback Items",
              label: row.menu_items.name,
              query: row.menu_items.name,
            });
          }
          if (row.comment) {
            addSuggestion({
              category: "Comments",
              label: row.comment.slice(0, 60),
              query: row.comment,
            });
          }
        });
      } else {
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
  }, [
    activeTab,
    customerIntelligenceView,
    dashboardTotalOrdersLabel,
    demandView,
    displayItemRanking,
    feedbackRows,
    menuItems,
    orders,
    search,
  ]);

  const applyStoreStatus = useCallback((status: StoreStatusPayload) => {
    setStoreStatus(status);
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
        const message = result.error || "Failed to load store status.";
        setStoreStatusError(message);
        showToast({
          title: "Store status not loaded",
          description: message,
          variant: "error",
        });
        return;
      }

      applyStoreStatus(result);
    } catch {
      const message = "Something went wrong while loading store status.";
      setStoreStatusError(message);
      showToast({
        title: "Store status not loaded",
        description: message,
        variant: "error",
      });
    }
  }, [applyStoreStatus, showToast]);

  useEffect(() => {
    loadAdminData({ showLoading: true });
    loadStoreStatus();
    // loadAdminData writes fresh server data; loadStoreStatus controls store sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      activeTab === "demand" ||
      activeTab === "customer-intelligence";

    if (!shouldAutoSync) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadAdminData({ showLoading: false });
    }, 15000);

    return () => window.clearInterval(intervalId);
    // loadAdminData is an untracked polling action; activeTab owns this interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        analyticsHourlyResponse,
        analyticsWeeklyResponse,
        analyticsItemsResponse,
        peakHourWindowsResponse,
      ] = await Promise.all([
        fetch("/api/staff/orders/list", { method: "GET" }),
        fetch("/api/admin/menu", { method: "GET" }),
        fetch("/api/feedback", { method: "GET" }),
        fetch("/api/admin/analytics/hourly", { method: "GET" }),
        fetch("/api/admin/analytics/weekly", { method: "GET" }),
        fetch("/api/admin/analytics/items", { method: "GET" }),
        fetch("/api/admin/analytics/peak-hours", { method: "GET" }),
      ]);

      const ordersResult = await ordersResponse.json();
      const menuResult = await menuResponse.json();
      const feedbackResult = await feedbackResponse.json();
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
        const message = ordersResult.error || "Failed to load admin orders.";
        setError(message);
        if (showLoading) {
          showToast({
            title: "Admin data not loaded",
            description: message,
            variant: "error",
          });
        }
        return;
      }

      if (!menuResponse.ok) {
        const message = menuResult.error || "Failed to load menu items.";
        setError(message);
        if (showLoading) {
          showToast({
            title: "Admin data not loaded",
            description: message,
            variant: "error",
          });
        }
        return;
      }

      setOrders(ordersResult.orders ?? []);
      setMenuItems(menuResult.menuItems ?? []);
      if (feedbackResponse.ok) {
        setFeedbackRows(feedbackResult.feedback ?? []);
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
      const message = "Something went wrong while loading admin data.";
      setError(message);
      if (showLoading) {
        showToast({
          title: "Admin data not loaded",
          description: message,
          variant: "error",
        });
      }
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
      setIsLogoutConfirmOpen(false);
      setIsLoggingOut(false);
    }
  }

  async function handleRefreshAnalytics() {
    setError("");
    setIsRefreshingAnalytics(true);

    try {
      const [
        dailyResponse,
        hourlyResponse,
        weeklyResponse,
        itemsResponse,
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
      ]);
      const dailyResult = (await dailyResponse.json()) as { error?: string };
      const hourlyResult = (await hourlyResponse.json()) as { error?: string };
      const weeklyResult = (await weeklyResponse.json()) as { error?: string };
      const itemsResult = (await itemsResponse.json()) as { error?: string };

      if (
        !dailyResponse.ok ||
        !hourlyResponse.ok ||
        !weeklyResponse.ok ||
        !itemsResponse.ok
      ) {
        const message =
          dailyResult.error ||
          hourlyResult.error ||
          weeklyResult.error ||
          itemsResult.error ||
          "Failed to refresh analytics.";
        setError(message);
        showToast({
          title: "Analytics not refreshed",
          description: message,
          variant: "error",
        });
        return;
      }

      const peakHoursResponse = await fetch("/api/admin/analytics/peak-hours", {
        method: "POST",
      });
      const peakHoursResult = (await peakHoursResponse.json()) as { error?: string };

      if (!peakHoursResponse.ok) {
        const message =
          peakHoursResult.error || "Failed to refresh peak-hour windows.";
        setError(message);
        showToast({
          title: "Analytics not refreshed",
          description: message,
          variant: "error",
        });
        return;
      }

      await loadAdminData({ showLoading: false });
      void fetch("/api/admin/analytics/customer-preferences", {
        method: "POST",
      });
      showToast({
        title: "Analytics refreshed",
        description: "Dashboard and demand signals are now up to date.",
        variant: "success",
      });
    } catch {
      const message = "Something went wrong while refreshing analytics.";
      setError(message);
      showToast({
        title: "Analytics not refreshed",
        description: message,
        variant: "error",
      });
    } finally {
      setIsRefreshingAnalytics(false);
    }
  }

  function handleSearchSuggestionSelect(suggestion: AdminSearchSuggestion) {
    setSearch(suggestion.query);
    setIsSearchFocused(false);

    if (suggestion.targetTab) {
      setActiveTab(suggestion.targetTab);
    }

    if (suggestion.targetDemandView) {
      setDemandView(suggestion.targetDemandView);
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

    if (tab === "customer-intelligence") {
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
          ? "lg:grid-cols-[238px_minmax(0,1fr)]"
          : "lg:grid-cols-[88px_minmax(0,1fr)]"
          }`}
      >
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[238px] flex-col overflow-hidden rounded-r-[24px] bg-[#083C1F] text-[#FFF0DA] shadow-[12px_0_34px_rgba(13,46,24,0.16)] transition-transform duration-300 lg:sticky lg:top-0 lg:w-auto lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div
            className={`flex items-center gap-3 pt-7 ${isSidebarOpen ? "justify-between px-5" : "justify-center px-3"
              }`}
          >
            <div className={`flex items-center gap-2.5 ${isSidebarOpen ? "" : "hidden"}`}>
              {isSidebarOpen && (
                <div>
                  <p className="font-sans text-[1.4rem] font-black leading-none text-[#FFF8EF]">
                    KadaServe
                  </p>
                  <p className="mt-0.5 font-sans text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#E8D9BE]/78">
                    Admin Panel
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Open sidebar"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#FFF0DA]/12 bg-[#FFF0DA]/8 text-[#FFF0DA] transition hover:bg-[#FFF0DA]/16"
            >
              {isSidebarOpen ? <X size={18} strokeWidth={1.8} /> : <Menu size={18} strokeWidth={1.8} />}
            </button>
          </div>

          <nav
            className={`mt-8 space-y-1.5 ${isSidebarOpen ? "px-3" : "px-2"
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
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left font-sans text-xs font-semibold leading-tight transition ${isActive
                    ? "rounded-[14px] bg-[#FFF0DA] text-[#0D2E18] shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
                    : "rounded-[14px] text-[#FFF0DA]/82 hover:bg-[#FFF0DA]/10 hover:text-[#FFF8EF]"
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

          <div className={`mt-auto pb-5 ${isSidebarOpen ? "px-3" : "px-2"}`}>
            <button
              type="button"
              onClick={() => setIsLogoutConfirmOpen(true)}
              disabled={isLoggingOut}
              title="Logout"
              className={`flex w-full items-center gap-2.5 rounded-[14px] border border-[#FFF0DA]/10 bg-[#FFF0DA]/6 px-3 py-2.5 font-sans text-xs font-semibold text-[#FFF0DA]/88 transition hover:bg-[#9C543D]/18 hover:text-[#FFF8EF] disabled:opacity-60 ${isSidebarOpen ? "" : "justify-center"
                }`}
            >
              <LogOut size={18} strokeWidth={1.8} className="shrink-0" />
              {isSidebarOpen ? (isLoggingOut ? "Logging out..." : "Logout") : null}
            </button>
          </div>
        </aside>

        <section className="min-w-0 bg-[#FFF0DA]">
          <header className="sticky top-0 z-30 border-b border-[#DCCFB8] bg-gradient-to-r from-[#FFFCF7] via-[#FFFCF7] to-[#FFF8F0] text-[#0D2E18] shadow-[0_4px_16px_rgba(104,75,53,0.04)] backdrop-blur">
            <div className="grid gap-3 px-4 py-3 xl:grid-cols-[1fr_auto_1fr] xl:items-center xl:px-6">
              {/* LEFT: Header Title & Description */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open admin navigation"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] transition hover:bg-white lg:hidden"
                >
                  <Menu size={20} strokeWidth={1.8} />
                </button>
                <div>
                    <div className="flex items-baseline gap-1.5">
                      <h1 className="font-sans text-xl font-black leading-none text-[#0D2E18]">
                        {activeTab === "dashboard" 
                          ? `Good ${getTimeOfDay()}, Admin` 
                          : activeHeaderTitle}
                      </h1>
                      {activeTab === "dashboard" && (
                        <Coffee size={20} strokeWidth={1.8} className="text-[#8C6C48]" />
                      )}
                    </div>
                  </div>
                </div>


              {/* CENTER: Refresh Button */}
              <div className="hidden xl:block">
                <button
                  type="button"
                  onClick={() => void handleRefreshAnalytics()}
                  disabled={isRefreshingAnalytics}
                  aria-label="Refresh analytics"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#D6C6AC] bg-[#FFF8EF] px-3.5 font-sans text-[0.7rem] font-bold text-[#684B35] transition hover:bg-white disabled:opacity-60"
                >
                  <RefreshCw size={14} strokeWidth={1.8} className={isRefreshingAnalytics ? "animate-spin" : ""} />
                  {isRefreshingAnalytics ? "Refreshing" : "Refresh Analytics"}
                </button>
              </div>

              {/* RIGHT: Status, Search, Sync Info */}
              <div className="flex flex-wrap items-center justify-start gap-3 xl:justify-end">
                <div className="relative w-full max-w-[240px]">
                  <label className="flex h-9 items-center gap-2 rounded-full border border-[#D6C6AC] bg-[#FFF8EF] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
                    <Search size={14} strokeWidth={1.8} className="text-[#8C7A64]" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => {
                        window.setTimeout(() => setIsSearchFocused(false), 140);
                      }}
                      placeholder="Search..."
                      className="w-full bg-transparent font-sans text-xs text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
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

                {/* Store Status */}
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-sans text-[0.7rem] font-bold transition ${
                      storeStatus?.effectiveStatus === "open"
                        ? "bg-[#E9F5E7] text-[#0D2E18]"
                        : storeStatus?.effectiveStatus === "busy"
                        ? "bg-[#FFF0DA] text-[#684B35]"
                        : "bg-[#FFF1EC] text-[#9C543D]"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full animate-pulse ${
                        storeStatus?.effectiveStatus === "open"
                          ? "bg-[#0F441D]"
                          : storeStatus?.effectiveStatus === "busy"
                          ? "bg-[#684B35]"
                          : "bg-[#9C543D]"
                      }`}
                    />
                    {storeStatus?.label ?? "Loading"}
                  </span>

                </div>

                <p className="font-sans text-[11px] text-[#8C7A64]">
                  {syncMeta}
                </p>
              </div>
            </div>
            {storeStatusError ? (
              <p className="border-t border-[#FFF0DA]/10 bg-[#FFF1EC] px-7 py-2 font-sans text-xs font-semibold text-[#9C543D]">
                {storeStatusError}
              </p>
            ) : null}
          </header>

          <div className="px-4 py-4 xl:px-6">
            {error ? (
              <div className="mb-5 rounded-[18px] bg-[#FFF1EC] px-5 py-4 font-sans text-sm text-[#9C543D]">
                {error}
              </div>
            ) : null}

            {activeTab === "dashboard" ? (
              <DashboardView
                averageOrderValue={dashboardMetrics.averageOrderValue}
                feedbackCount={feedbackRows.length}
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
                totalOrdersLabel={dashboardTotalOrdersLabel}
                search={debouncedSearch}
                weekdayCounts={dashboardMetrics.weekdayCounts}
              />
            ) : null}

            {activeTab === "demand" ? (
              <div className="space-y-4">
                <section className="rounded-[24px] border border-[#DCCFB8] bg-[#FFFCF7] px-5 py-4 shadow-[0_14px_34px_rgba(75,50,24,0.08)] sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                      <div className="grid gap-1 rounded-full border border-[#DCCFB8] bg-[#FFF8EF] p-1 sm:grid-cols-3">
                        {demandViews.map((view) => {
                          const isActive = demandView === view.key;
                          return (
                            <button
                              key={view.key}
                              type="button"
                              onClick={() => setDemandView(view.key)}
                              className={`rounded-full px-4 py-2.5 text-center font-sans text-sm font-bold transition xl:min-w-[118px] ${
                                isActive
                                  ? "bg-[#0D2E18] text-[#FFF8EF] shadow-[0_8px_18px_rgba(13,46,24,0.18)]"
                                  : "text-[#684B35] hover:bg-white"
                              }`}
                            >
                              {view.label}
                            </button>
                          );
                        })}
                      </div>

                      <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#DCCFB8] bg-white px-4 py-2.5 font-sans text-xs font-bold text-[#684B35]">
                        <Clock size={13} strokeWidth={1.8} />
                        5PM-12AM
                      </span>
                  </div>
                </section>

                {demandView === "orders" ? (
                  <OrdersView
                    filteredOrders={filteredOrders}
                    onOpenOrder={setSelectedOrder}
                  />
                ) : null}

                {demandView === "time-series" ? (
                  <TimeSeriesView
                    dateLabel={analyticsHourlyDateLabel}
                    hourlyCounts={scopedHourlyCounts}
                    maxHourlyOrders={maxScopedHourlyOrders}
                  />
                ) : null}

                {demandView === "peak-hours" ? (
                  <PeakHoursView peakHourWindows={scopedPeakHourWindows} />
                ) : null}
              </div>
            ) : null}

            {activeTab === "customer-intelligence" ? (
              <div className="space-y-4">
                <div className="grid gap-2 rounded-[28px] border border-[#DCCFB8] bg-[#FFF8EF] p-1 sm:grid-cols-2 xl:w-fit">
                  {customerIntelligenceViews.map((view) => {
                    const isActive = customerIntelligenceView === view.key;

                    return (
                      <button
                        key={view.key}
                        type="button"
                        onClick={() => setCustomerIntelligenceView(view.key)}
                        className={`rounded-full px-4 py-2.5 text-left font-sans text-sm font-bold transition xl:min-w-[132px] ${
                          isActive
                            ? "bg-[#0D2E18] text-[#FFF8EF] shadow-[0_8px_18px_rgba(13,46,24,0.18)]"
                            : "text-[#684B35] hover:bg-white"
                        }`}
                      >
                        {view.label}
                      </button>
                    );
                  })}
                </div>

                {customerIntelligenceView === "item-ranking" ? (
                  <ItemRankingView
                    itemRanking={scopedItemRanking}
                    maxItemOrders={maxScopedItemOrders}
                  />
                ) : null}

                {customerIntelligenceView === "feedback" ? (
                  <div className="space-y-4">
                    <SatisfactionView feedbackRows={scopedFeedbackRows} />
                    <FeedbackManagementView feedbackRows={scopedFeedbackRows} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "menu" ? (
              <MenuView
                itemPerformance={displayItemRanking}
                menuItems={scopedMenuItems}
                setMenuItems={setMenuItems}
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

      {isLogoutConfirmOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0D2E18]/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-logout-title"
        >
          <div className="w-full max-w-sm rounded-[24px] border border-[#DCCFB8] bg-white p-5 shadow-[0_24px_60px_rgba(13,46,24,0.24)]">
            <h2
              id="admin-logout-title"
              className="font-sans text-xl font-black text-[#0D2E18]"
            >
              Log out?
            </h2>
            <p className="mt-2 font-sans text-sm font-semibold leading-relaxed text-[#684B35]">
              Are you sure you want to log out?
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-[14px] bg-[#9C543D] px-4 py-3 font-sans text-sm font-black text-[#FFF0D8] transition hover:bg-[#8A4632] disabled:opacity-60"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                disabled={isLoggingOut}
                className="rounded-[14px] border border-[#DCCFB8] bg-white px-4 py-3 font-sans text-sm font-black text-[#684B35] transition hover:bg-[#FFF0DA] disabled:opacity-60"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}



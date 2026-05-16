"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Award,
  Star,
} from "lucide-react";
import {
  getRecommendationsForCustomer,
  type RecommendationFeedback,
  type RecommendationGlobalRankItem,
  type RecommendationMenuItem,
  type RecommendationOrder,
} from "@/lib/recommendations";
import {
  getAnalyticsItemId,
  getAnalyticsOrderCount,
  sortAnalyticsItemsByGlobalRanking,
  type AnalyticsRankingRow,
} from "@/lib/analytics-ranking";
import type { AdminMenuItem } from "@/types/menu";
import type { StaffOrder } from "@/types/orders";

type RankedItem = {
  item: string;
  orders: number;
  revenue: number;
  rating: number;
};

type AdminPreferenceFeedbackRow = {
  id?: string;
  customer_id: string | null;
  menu_item_id: string | null;
  taste_rating: number;
  strength_rating: number;
  overall_rating: number;
  comment?: string | null;
  created_at?: string;
  profiles: { full_name: string | null; email: string | null } | null;
  menu_items: { name: string | null; category: string | null } | null;
};

function peso(value: number) {
  return `\u20B1${Math.round(value).toLocaleString("en-PH")}`;
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
    order.customer_profile?.full_name?.trim() ||
    order.walkin_name?.trim() ||
    formatNameFromEmail(order.customer_profile?.email ?? null) ||
    formatNameFromEmail(order.delivery_email) ||
    (order.order_type === "delivery" ? "Delivery Customer" : "Walk-in Customer")
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getRatingTone(value: number) {
  if (value >= 4) {
    return {
      label: "Strong",
      className: "border-[#0F441D]/15 bg-[#E6F2E8] text-[#0F441D]",
      fill: "bg-[#0F441D]",
    };
  }

  if (value >= 3) {
    return {
      label: "Watch",
      className: "border-[#DCCFB8] bg-[#FFF0DA] text-[#684B35]",
      fill: "bg-[#684B35]",
    };
  }

  return {
    label: "Review",
    className: "border-[#C55432]/15 bg-[#FFF1EC] text-[#C55432]",
    fill: "bg-[#C55432]",
  };
}

function getRecommendationTone(basis: string) {
  if (basis === "preference") {
    return "border-[#0F441D]/15 bg-[#E6F2E8] text-[#0F441D]";
  }

  if (basis === "top_seller") {
    return "border-[#684B35]/20 bg-[#FFF0DA] text-[#684B35]";
  }

  return "border-[#DCCFB8] bg-white text-[#684B35]";
}

function getPreferenceBasisLabel(basis: string) {
  if (basis === "preference") return "Preference";
  if (basis === "top_seller") return "Top seller";
  return "Popularity";
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-8 text-center font-sans text-sm text-[#8C7A64]">
      {label}
    </div>
  );
}

function InsightCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[22px] border border-[#DCCFB8] bg-[#FFFCF7] shadow-[0_12px_28px_rgba(75,50,24,0.07)] ${className}`}
    >
      {children}
    </section>
  );
}

function ProgressBar({
  max,
  tone = "green",
  value,
}: {
  max: number;
  tone?: "green" | "brown" | "muted";
  value: number;
}) {
  const width = Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
  const fill =
    tone === "green" ? "bg-[#0D2E18]" : tone === "brown" ? "bg-[#684B35]" : "bg-[#7D6B55]";

  return (
    <div className="h-2.5 overflow-hidden rounded-full border border-[#D6C6AC] bg-[#FFF8EF]">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value.toFixed(1)} rating`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={13}
          strokeWidth={1.8}
          className={
            index + 1 <= Math.round(value)
              ? "fill-[#0D2E18] text-[#0D2E18]"
              : "text-[#D6C6AC]"
          }
        />
      ))}
    </div>
  );
}

export function ItemRankingView({
  itemRanking,
  maxItemOrders,
}: {
  itemRanking: RankedItem[];
  maxItemOrders: number;
}) {
  const [rankMode, setRankMode] = useState<"orders" | "revenue" | "rating">("orders");
  const sortedRanking = [...itemRanking].sort((first, second) => {
    if (rankMode === "revenue") return second.revenue - first.revenue;
    if (rankMode === "rating") return second.rating - first.rating;
    return second.orders - first.orders;
  });
  const rankMax =
    rankMode === "revenue"
      ? Math.max(1, ...sortedRanking.map((item) => item.revenue))
      : rankMode === "rating"
      ? 5
      : maxItemOrders;
  const topItems = sortedRanking.slice(0, 3);
  const rankedItems = sortedRanking.slice(0, 8);
  const lowPerformingItems = [...itemRanking]
    .sort((first, second) => first.rating - second.rating || first.orders - second.orders)
    .slice(0, 4);
  const getRankValue = (item: RankedItem) => {
    if (rankMode === "revenue") return peso(item.revenue);
    if (rankMode === "rating") return item.rating.toFixed(1);
    return String(item.orders);
  };
  const getRankBarValue = (item: RankedItem) => {
    if (rankMode === "revenue") return item.revenue;
    if (rankMode === "rating") return item.rating;
    return item.orders;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#DCCFB8] bg-[#FFFCF7] p-3 shadow-[0_10px_24px_rgba(75,50,24,0.06)]">
        <div className="flex items-center gap-2">
          <Award size={18} strokeWidth={1.8} className="text-[#684B35]" />
          <p className="font-sans text-sm font-black text-[#0D2E18]">Ranking view</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-full border border-[#DCCFB8] bg-[#FFF8EF] p-1">
          {(["orders", "revenue", "rating"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setRankMode(mode)}
              className={`rounded-full px-3 py-2 font-sans text-xs font-black capitalize transition ${
                rankMode === mode
                  ? "bg-[#0D2E18] text-[#FFF8EF] shadow-[0_8px_18px_rgba(13,46,24,0.16)]"
                  : "text-[#684B35] hover:bg-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {topItems.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {topItems.map((item, index) => {
            const tone = index === 0 ? "green" : index === 1 ? "brown" : "muted";

            return (
              <InsightCard key={`top-${item.item}`} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-2.5 py-1 font-sans text-xs font-black text-[#684B35]">
                      #{index + 1}
                    </span>
                    <h2 className="mt-3 line-clamp-2 font-sans text-lg font-black leading-tight text-[#0D2E18]">
                      {item.item}
                    </h2>
                  </div>
                  <p className="font-sans text-2xl font-black tabular-nums text-[#0D2E18]">
                    {getRankValue(item)}
                  </p>
                </div>
                <div className="mt-4">
                  <ProgressBar value={getRankBarValue(item)} max={rankMax} tone={tone} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 font-sans text-xs font-semibold text-[#684B35]">
                  <span>{rankMode === "revenue" ? `${item.orders} orders` : peso(item.revenue)}</span>
                  <span>{item.rating.toFixed(1)} rating</span>
                </div>
              </InsightCard>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <InsightCard className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#EFE3CF] bg-[#FFF8EF] px-4 py-3">
            <h2 className="font-sans text-lg font-black text-[#0D2E18]">
              Ranked Menu Signals
            </h2>
            <span className="rounded-full bg-white px-3 py-1 font-sans text-xs font-bold capitalize text-[#684B35]">
              {rankMode}
            </span>
          </div>
          <div className="divide-y divide-[#EFE3CF]">
            {rankedItems.map((item, index) => (
              <div
                key={item.item}
                className="grid grid-cols-[38px_minmax(0,1fr)_70px_minmax(120px,0.45fr)] items-center gap-3 px-4 py-3 font-sans text-sm text-[#0D2E18]"
              >
                <span className="font-black text-[#684B35]">#{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate font-bold">{item.item}</p>
                  <p className="text-xs font-semibold text-[#8C7A64]">
                    {peso(item.revenue)} - {item.rating.toFixed(1)} rating
                  </p>
                </div>
                <span className="font-black tabular-nums">{getRankValue(item)}</span>
                <ProgressBar value={getRankBarValue(item)} max={rankMax} />
              </div>
            ))}
            {rankedItems.length === 0 ? <EmptyState label="No ranked items yet" /> : null}
          </div>
        </InsightCard>

        <InsightCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-sans text-lg font-black text-[#0D2E18]">
              Review Candidates
            </h2>
            <AlertTriangle size={18} strokeWidth={1.8} className="text-[#684B35]" />
          </div>
          <div className="mt-4 space-y-3">
            {lowPerformingItems.map((item, index) => (
              <div
                key={`low-${item.item}`}
                className="rounded-[16px] border border-[#EFE3CF] bg-white px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-sans text-sm font-bold text-[#0D2E18]">
                    {item.item}
                  </p>
                  <span className="rounded-full bg-[#FFF8EF] px-2.5 py-1 font-sans text-xs font-black text-[#684B35]">
                    #{itemRanking.length - index}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={item.rating} max={5} tone="brown" />
                </div>
                <p className="mt-2 font-sans text-xs font-semibold text-[#8C7A64]">
                  {item.orders} orders - {item.rating.toFixed(1)} rating
                </p>
              </div>
            ))}
            {lowPerformingItems.length === 0 ? (
              <EmptyState label="No low-performing items yet" />
            ) : null}
          </div>
        </InsightCard>
      </div>
    </div>
  );
}

export function SatisfactionView({
  feedbackRows,
}: {
  feedbackRows: AdminPreferenceFeedbackRow[];
}) {
  const [ratingFilter, setRatingFilter] = useState<"all" | "strong" | "watch" | "review">("all");
  const byItem = new Map<
    string,
    {
      count: number;
      taste: number;
      strength: number;
      overall: number;
      latestComment: string | null;
    }
  >();

  feedbackRows.forEach((row) => {
    const itemName = row.menu_items?.name || "Menu item";
    const current = byItem.get(itemName) ?? {
      count: 0,
      taste: 0,
      strength: 0,
      overall: 0,
      latestComment: null,
    };

    byItem.set(itemName, {
      count: current.count + 1,
      taste: current.taste + Number(row.taste_rating),
      strength: current.strength + Number(row.strength_rating),
      overall: current.overall + Number(row.overall_rating),
      latestComment: current.latestComment || row.comment?.trim() || null,
    });
  });

  const itemSummaries = Array.from(byItem.entries())
    .map(([item, value]) => ({
      item,
      count: value.count,
      taste: value.taste / value.count,
      strength: value.strength / value.count,
      overall: value.overall / value.count,
      latestComment: value.latestComment,
    }))
    .sort((first, second) => second.overall - first.overall);
  const filteredItemSummaries = itemSummaries.filter((item) => {
    if (ratingFilter === "strong") return item.overall >= 4;
    if (ratingFilter === "watch") return item.overall >= 3 && item.overall < 4;
    if (ratingFilter === "review") return item.overall < 3;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-[#DCCFB8] bg-[#FFFCF7] p-3 shadow-[0_10px_24px_rgba(75,50,24,0.06)]">
        {([
          ["all", "All"],
          ["strong", "Strong"],
          ["watch", "Watch"],
          ["review", "Review"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setRatingFilter(key)}
            className={`rounded-full px-4 py-2 font-sans text-xs font-black transition ${
              ratingFilter === key
                ? "bg-[#0D2E18] text-[#FFF8EF] shadow-[0_8px_18px_rgba(13,46,24,0.16)]"
                : "border border-[#DCCFB8] bg-[#FFF8EF] text-[#684B35] hover:bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <InsightCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-sans text-lg font-black text-[#0D2E18]">
            Rating Quality Map
          </h2>
          <span className="rounded-full border border-[#DCCFB8] bg-white px-3 py-1 font-sans text-xs font-bold text-[#684B35]">
            Avg / 5
          </span>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {filteredItemSummaries.map((item) => {
            const tone = getRatingTone(item.overall);

            return (
              <article
                key={item.item}
                className="rounded-[18px] border border-[#EFE3CF] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 font-sans text-base font-black leading-tight text-[#0D2E18]">
                      {item.item}
                    </h3>
                    <p className="mt-1 font-sans text-xs font-semibold text-[#8C7A64]">
                      {item.count} responses
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 font-sans text-xs font-black ${tone.className}`}
                  >
                    {item.overall.toFixed(1)}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    { label: "Overall", value: item.overall },
                    { label: "Taste", value: item.taste },
                    { label: "Strength", value: item.strength },
                  ].map((rating) => (
                    <div
                      key={`${item.item}-${rating.label}`}
                      className="grid grid-cols-[78px_minmax(0,1fr)_42px] items-center gap-3"
                    >
                      <span className="font-sans text-xs font-bold text-[#684B35]">
                        {rating.label}
                      </span>
                      <ProgressBar value={rating.value} max={5} />
                      <span className="font-sans text-xs font-black tabular-nums text-[#0D2E18]">
                        {rating.value.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>

                {item.latestComment ? (
                  <p className="mt-4 rounded-[14px] bg-[#FFF8EF] px-3 py-2 font-sans text-sm font-semibold leading-relaxed text-[#684B35]">
                    {item.latestComment}
                  </p>
                ) : null}
              </article>
            );
          })}
          {filteredItemSummaries.length === 0 ? <EmptyState label="No matching ratings" /> : null}
        </div>
      </InsightCard>
    </div>
  );
}

export function CustomerPreferenceView({
  feedbackRows,
  globalAnalyticsItems,
  menuItems,
  orders,
}: {
  feedbackRows: AdminPreferenceFeedbackRow[];
  globalAnalyticsItems: AnalyticsRankingRow[];
  menuItems: AdminMenuItem[];
  orders: StaffOrder[];
}) {
  const recommendationMenuItems: RecommendationMenuItem[] = menuItems.map(
    (item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      imageUrl: item.imageUrl,
      isAvailable: item.isAvailable,
    })
  );
  const menuByName = new Map(
    recommendationMenuItems.map((item) => [item.name.toLowerCase(), item])
  );
  const recommendationOrders: RecommendationOrder[] = orders.map((order) => ({
    id: order.id,
    customerId: order.customer_id || getOrderDisplayName(order),
    customerName: getOrderDisplayName(order),
    status: order.status,
    orderedAt: order.ordered_at,
    items: order.order_items.map((item) => {
      const itemName = item.menu_items?.name ?? "Menu item";
      const matchedMenuItem = menuByName.get(itemName.toLowerCase());

      return {
        menuItemId: matchedMenuItem?.id,
        name: itemName,
        category: matchedMenuItem?.category,
        quantity: item.quantity,
      };
    }),
  }));
  const recommendationFeedback: RecommendationFeedback[] = feedbackRows.map(
    (row) => ({
      customerId: row.customer_id,
      menuItemId: row.menu_item_id,
      itemName: row.menu_items?.name,
      tasteRating: row.taste_rating,
      strengthRating: row.strength_rating,
      overallRating: row.overall_rating,
    })
  );
  const globalRanking: RecommendationGlobalRankItem[] =
    sortAnalyticsItemsByGlobalRanking(globalAnalyticsItems).map((row, index) => ({
      id: getAnalyticsItemId(row),
      name: row.item_name ?? "",
      orderCount: getAnalyticsOrderCount(row),
      rank: index + 1,
    }));
  const customers = Array.from(
    recommendationOrders.reduce((map, order) => {
      if (!map.has(order.customerId)) {
        map.set(order.customerId, {
          id: order.customerId,
          name: order.customerName,
        });
      }

      return map;
    }, new Map<string, { id: string; name: string }>())
  ).map(([, customer]) =>
    getRecommendationsForCustomer({
      customerId: customer.id,
      customerName: customer.name,
      menuItems: recommendationMenuItems,
      orders: recommendationOrders,
      feedback: recommendationFeedback,
      globalRanking,
    })
  );
  const profiles = customers.sort(
    (first, second) => second.preferenceScore - first.preferenceScore
  );
  const visibleProfiles = profiles.slice(0, 6);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const selectedProfile =
    visibleProfiles.find((profile) => profile.customerId === selectedCustomerId) ??
    visibleProfiles[0];

  return (
    <div className="space-y-4">
      {selectedProfile ? (
        <InsightCard className="overflow-hidden">
          <div className="grid gap-4 p-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[#0D2E18] font-sans text-xl font-black text-[#FFF0DA]">
                {getInitials(selectedProfile.customerName)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-sans text-xl font-black text-[#0D2E18]">
                  {selectedProfile.customerName}
                </p>
                <p className="mt-1 font-sans text-sm font-bold text-[#684B35]">
                  {Math.round(selectedProfile.preferenceScore * 100)}% score
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {selectedProfile.recommendations.map((recommendation) => (
                <div
                  key={`spotlight-${recommendation.label}-${recommendation.item.id}`}
                  className="rounded-[16px] border border-[#EFE3CF] bg-[#FFF8EF] px-3 py-3"
                >
                  <p className="font-sans text-xs font-black uppercase tracking-[0.12em] text-[#684B35]">
                    {recommendation.label}
                  </p>
                  <p className="mt-1 line-clamp-2 font-sans text-sm font-black leading-tight text-[#0D2E18]">
                    {recommendation.item.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </InsightCard>
      ) : null}

      <InsightCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE3CF] bg-[#FFF8EF] px-4 py-3">
          <div>
            <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
              Profiles
            </p>
            <h2 className="mt-1 font-sans text-lg font-black text-[#0D2E18]">
              Top recommendations
            </h2>
          </div>
          <span className="rounded-full border border-[#DCCFB8] bg-white px-3 py-1.5 font-sans text-xs font-bold text-[#684B35]">
            Top 6
          </span>
        </div>

        <div className="divide-y divide-[#EFE3CF]">
          {visibleProfiles.map((profile, index) => {
            const isSelected = selectedProfile?.customerId === profile.customerId;

            return (
            <button
              key={profile.customerId}
              type="button"
              onClick={() => setSelectedCustomerId(profile.customerId)}
              className={`grid w-full gap-4 px-4 py-4 text-left transition hover:bg-[#FFF8EF] xl:grid-cols-[42px_64px_minmax(180px,0.9fr)_minmax(280px,1fr)_92px] ${
                isSelected ? "bg-[#E6F2E8]" : ""
              }`}
            >
              <span className="font-sans text-sm font-black text-[#8C7A64]">
                #{index + 1}
              </span>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0D2E18] font-sans text-lg font-black text-[#FFF0DA]">
                {getInitials(profile.customerName)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-sans text-lg font-black text-[#0D2E18]">
                  {profile.customerName}
                </p>
                <p className="mt-1 font-sans text-sm font-semibold text-[#684B35]">
                  Most ordered: {profile.mostOrderedItem}
                </p>
                <p className="font-sans text-sm font-semibold text-[#684B35]">
                  Last ordered: {profile.lastOrderedItem}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RatingStars value={profile.averageFeedbackRating ?? 0} />
                  <span className="font-sans text-xs font-bold text-[#8C7A64]">
                    {profile.averageFeedbackRating
                      ? `${profile.averageFeedbackRating.toFixed(1)} avg feedback`
                      : "No rating yet"}
                  </span>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                {profile.recommendations.map((recommendation) => (
                  <div
                    key={`${profile.customerId}-${recommendation.label}-${recommendation.item.id}`}
                    className="rounded-[16px] border border-[#EFE3CF] bg-white px-3 py-2.5 font-sans text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-[#0D2E18]">
                        {recommendation.label}: {recommendation.item.name}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getRecommendationTone(
                          recommendation.basis
                        )}`}
                      >
                        {getPreferenceBasisLabel(recommendation.basis)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-[#684B35]">
                      {recommendation.reason}
                    </p>
                  </div>
                ))}
              </div>
              <div className="xl:text-right">
                <p className="font-sans text-2xl font-black text-[#0D2E18]">
                  {Math.round(profile.preferenceScore * 100)}%
                </p>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                  Pref Score
                </p>
              </div>
            </button>
            );
          })}
          {profiles.length === 0 ? <EmptyState label="No customer order data yet" /> : null}
        </div>
      </InsightCard>
    </div>
  );
}

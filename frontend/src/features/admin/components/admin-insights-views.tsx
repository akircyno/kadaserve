"use client";

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

const topItemStyles = [
  {
    badge: "bg-[#0D2E18] text-[#FFF0DA]",
    card: "border-[#0D2E18]/20 bg-[#F7FBF5]",
    bar: "#0D2E18",
  },
  {
    badge: "bg-[#684B35] text-[#FFF0DA]",
    card: "border-[#684B35]/20 bg-[#FFF8EF]",
    bar: "#684B35",
  },
  {
    badge: "bg-[#A77B5D] text-white",
    card: "border-[#A77B5D]/25 bg-[#FFF0DA]",
    bar: "#A77B5D",
  },
];

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-8 text-center font-sans text-sm text-[#8C7A64]">
      {label}
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
  const topItems = itemRanking.slice(0, 3);
  const rankedItems = itemRanking.slice(0, 10);
  const lowPerformingItems = [...itemRanking].slice(-5).reverse();

  return (
    <div className="space-y-4">
      {topItems.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {topItems.map((item, index) => {
            const style = topItemStyles[index] ?? topItemStyles[0];

            return (
              <article
                key={`top-${item.item}`}
                className={`rounded-[16px] border px-4 py-3 ${style.card}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-black ${style.badge}`}
                    >
                      #{index + 1}
                    </span>
                    <h2 className="mt-3 truncate font-sans text-lg font-black text-[#0D2E18]">
                      {item.item}
                    </h2>
                  </div>
                  <p className="font-sans text-2xl font-black tabular-nums text-[#0D2E18]">
                    {item.orders}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, (item.orders / maxItemOrders) * 100))}%`,
                      backgroundColor: style.bar,
                    }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between font-sans text-xs font-semibold text-[#684B35]">
                  <span>{peso(item.revenue)}</span>
                  <span>{item.rating.toFixed(1)} rating</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[18px] border border-[#DCCFB8] bg-white">
        <div className="grid grid-cols-[44px_minmax(180px,1.8fr)_0.7fr_0.8fr_0.7fr_1fr] gap-4 bg-[#FFF8EF] px-4 py-3 font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
          <span>#</span>
          <span>Item</span>
          <span>Orders</span>
          <span>Revenue</span>
          <span>Rating</span>
          <span>Order Bar</span>
        </div>
        <div className="divide-y divide-[#EFE3CF]">
          {rankedItems.map((item, index) => (
            <div
              key={item.item}
              className="grid grid-cols-[44px_minmax(180px,1.8fr)_0.7fr_0.8fr_0.7fr_1fr] items-center gap-4 px-4 py-3 font-sans text-sm text-[#0D2E18]"
            >
              <span className="font-black text-[#684B35]">{index + 1}</span>
              <span className="truncate font-bold">{item.item}</span>
              <span className="font-semibold tabular-nums">{item.orders}</span>
              <span className="font-semibold tabular-nums">{peso(item.revenue)}</span>
              <span className="font-semibold tabular-nums">{item.rating.toFixed(1)}</span>
              <ProgressBar value={item.orders} max={maxItemOrders} />
            </div>
          ))}
          {rankedItems.length === 0 ? <EmptyState label="No ranked items yet" /> : null}
        </div>
      </div>

      {lowPerformingItems.length > 0 ? (
        <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-sans text-lg font-bold text-[#0D2E18]">
              Low Performing Items
            </h2>
            <p className="font-sans text-sm uppercase text-[#684B35]">Lowest sales</p>
          </div>
          <div className="mt-3 space-y-3">
            {lowPerformingItems.map((item, index) => (
              <div
                key={`low-${item.item}`}
                className="grid grid-cols-[34px_1fr_72px_120px] items-center gap-4 border-b border-[#E8D9BE] py-3 font-sans text-[15px] last:border-b-0"
              >
                <span className="font-bold text-[#A77B5D]">-{index + 1}</span>
                <span className="truncate font-semibold text-[#0D2E18]">
                  {item.item}
                </span>
                <span className="font-semibold tabular-nums text-[#684B35]">
                  {item.orders}
                </span>
                <ProgressBar max={maxItemOrders} value={item.orders} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function formatRating(value: number) {
  return value ? value.toFixed(1) : "N/A";
}

export function SatisfactionView({
  feedbackRows,
}: {
  feedbackRows: AdminPreferenceFeedbackRow[];
}) {
  const overallAverage = average(
    feedbackRows.map((row) => Number(row.overall_rating)).filter(Number.isFinite)
  );
  const tasteAverage = average(
    feedbackRows.map((row) => Number(row.taste_rating)).filter(Number.isFinite)
  );
  const strengthAverage = average(
    feedbackRows.map((row) => Number(row.strength_rating)).filter(Number.isFinite)
  );
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

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
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
            Overall
          </p>
          <p className="mt-3 font-sans text-3xl font-black text-[#0D2E18]">
            {formatRating(overallAverage)}
          </p>
        </div>
        <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
            Taste
          </p>
          <p className="mt-3 font-sans text-3xl font-black text-[#0D2E18]">
            {formatRating(tasteAverage)}
          </p>
        </div>
        <div className="rounded-[18px] border border-[#DCCFB8] bg-white p-4">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
            Strength
          </p>
          <p className="mt-3 font-sans text-3xl font-black text-[#0D2E18]">
            {formatRating(strengthAverage)}
          </p>
        </div>
      </div>

      {itemSummaries.length === 0 ? <EmptyState label="No feedback data yet" /> : null}
      {itemSummaries.map((item) => (
        <Panel key={item.item} title={item.item} rightLabel={`${item.count} responses`}>
          <div className="mt-4 space-y-4 px-2 pb-2 sm:px-4">
            {[
              { label: "Overall", value: item.overall },
              { label: "Taste", value: item.taste },
              { label: "Strength", value: item.strength },
            ].map((rating) => (
              <div
                key={`${item.item}-${rating.label}`}
                className="grid grid-cols-[92px_1fr_52px] items-center gap-4"
              >
                <span className="font-sans text-sm font-bold text-[#0D2E18]">
                  {rating.label}
                </span>
                <ProgressBar value={rating.value} max={5} />
                <span className="font-sans text-sm font-bold tabular-nums text-[#684B35]">
                  {rating.value.toFixed(1)}
                </span>
              </div>
            ))}
            {item.latestComment ? (
              <p className="rounded-[14px] bg-[#FFF8EF] px-3 py-2 font-sans text-sm text-[#684B35]">
                {item.latestComment}
              </p>
            ) : null}
          </div>
        </Panel>
      ))}
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

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-[#DCCFB8] bg-white px-5 py-4">
        <p className="w-fit rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-1.5 font-sans text-xs font-bold text-[#684B35]">
          Preference Score = (0.5 x Frequency) + (0.3 x Recency) + (0.2 x Feedback Rating)
        </p>
      </div>
      <Panel title="Customer Profiles + Top-N Recommendations" rightLabel="MONITOR ONLY">
        <div className="mt-6 space-y-6 px-2 pb-2 sm:px-4">
          {profiles.slice(0, 5).map((profile, index) => (
            <div
              key={profile.customerId}
              className="grid gap-4 border-b border-[#0D2E18]/10 pb-6 last:border-b-0 xl:grid-cols-[40px_72px_1fr_1.25fr_100px]"
            >
              <span className="font-sans text-[#8C7A64]">{index + 1}</span>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0D2E18] font-sans text-xl font-bold text-[#FFF0DA]">
                {getInitials(profile.customerName)}
              </div>
              <div>
                <p className="font-sans text-lg font-semibold">
                  {profile.customerName}
                </p>
                <p className="font-sans text-sm text-[#684B35]">
                  Most ordered: {profile.mostOrderedItem}
                </p>
                <p className="font-sans text-sm text-[#684B35]">
                  Last ordered: {profile.lastOrderedItem}
                </p>
                <p className="font-sans text-sm text-[#684B35]">
                  Avg feedback:{" "}
                  {profile.averageFeedbackRating
                    ? profile.averageFeedbackRating.toFixed(1)
                    : "No rating yet"}
                </p>
              </div>
              <div className="space-y-2">
                {profile.recommendations.map((recommendation) => (
                  <div
                    key={`${profile.customerId}-${recommendation.label}-${recommendation.item.id}`}
                    className="rounded-[14px] bg-[#FFF8EF] px-3 py-2 font-sans text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-[#0D2E18]">
                        {recommendation.label}: {recommendation.item.name}
                      </p>
                      <span className="rounded-full border border-[#D6C6AC] px-2 py-0.5 text-[11px] font-bold uppercase text-[#684B35]">
                        {recommendation.basis}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#684B35]">
                      {recommendation.reason}
                    </p>
                  </div>
                ))}
              </div>
              <div className="text-right">
                <p className="font-sans text-xl font-bold">
                  {(profile.preferenceScore * 100).toFixed(0)}%
                </p>
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

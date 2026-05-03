"use client";

import {
  getRecommendationsForCustomer,
  type RecommendationFeedback,
  type RecommendationMenuItem,
  type RecommendationOrder,
} from "@/lib/recommendations";
import type { AdminMenuItem } from "@/types/menu";
import type { StaffOrder } from "@/types/orders";

type RankedItem = {
  item: string;
  orders: number;
  revenue: number;
  rating: number;
};
type AdminPreferenceFeedbackRow = {
  customer_id: string | null;
  menu_item_id: string | null;
  taste_rating: number;
  strength_rating: number;
  overall_rating: number;
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

export function SatisfactionView({ itemRanking }: { itemRanking: RankedItem[] }) {
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

export function CustomerPreferenceView({
  feedbackRows,
  menuItems,
  orders,
}: {
  feedbackRows: AdminPreferenceFeedbackRow[];
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
    })
  );
  const profiles = customers.sort(
    (first, second) => second.preferenceScore - first.preferenceScore
  );

  return (
    <div className="space-y-5">
      <h1 className="font-sans text-3xl font-bold">Customer Preference Scoring</h1>
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

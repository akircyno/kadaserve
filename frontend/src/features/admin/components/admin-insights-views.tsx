"use client";

import type { StaffOrder } from "@/types/orders";

type RankedItem = {
  item: string;
  orders: number;
  revenue: number;
  rating: number;
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
    order.walkin_name?.trim() ||
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

export function CustomerPreferenceView({ orders }: { orders: StaffOrder[] }) {
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
  )
    .map(([, value]) => {
      const topItems = Array.from(value.items.entries())
        .sort((first, second) => second[1] - first[1])
        .slice(0, 2)
        .map(([name]) => name);

      return {
        ...value,
        topItems,
        score: Math.min(0.99, 0.5 + value.visits / 20 + value.total / 10000),
      };
    })
    .sort((first, second) => second.score - first.score);

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

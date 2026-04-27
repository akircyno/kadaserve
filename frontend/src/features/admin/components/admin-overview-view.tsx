"use client";

import type { StaffOrder } from "@/types/orders";

const weekDays = ["MON", "TUES", "WED", "THURS", "FRI", "SAT", "SUN"];
const peakHourLabels = ["6A", "7A", "8A", "9A", "10A", "11A", "12P", "1P", "2P", "3P"];

function peso(value: number) {
  return `\u20B1${Math.round(value).toLocaleString("en-PH")}`;
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

function ProgressBar({ max, value }: { max: number; value: number }) {
  const width = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="h-3 overflow-hidden rounded-full border border-[#DCCFB8] bg-[#FFF8EF]">
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
    <div className="grid grid-cols-[34px_1fr_90px_130px] items-center gap-4 font-sans text-sm">
      <span>{index}</span>
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
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
  const maxOrders = Math.max(
    1,
    ...weekDays.flatMap((day) =>
      peakHourLabels.map((hour) => countOrdersForSlot(orders, day, hour))
    )
  );

  const visibleDays = compact ? weekDays.slice(0, 5) : weekDays;
  const visibleHours = compact ? peakHourLabels.slice(2, 7) : peakHourLabels;

  return (
    <div className="mt-5 overflow-x-auto">
      <div className="min-w-[620px] space-y-3">
        {visibleDays.map((day) => (
          <div key={day} className="grid grid-cols-[48px_1fr] items-center gap-3">
            <span className="font-sans text-sm">{day}</span>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${visibleHours.length}, minmax(0, 1fr))` }}>
              {visibleHours.map((hour) => {
                const count = countOrdersForSlot(orders, day, hour);

                return (
                  <div
                    key={`${day}-${hour}`}
                    className="h-6 rounded-[7px]"
                    title={`${day} ${hour}: ${count} orders`}
                    style={{ backgroundColor: getHeatmapColor(count, maxOrders) }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[48px_1fr] gap-3">
          <span />
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${visibleHours.length}, minmax(0, 1fr))` }}>
            {visibleHours.map((hour) => (
              <span key={hour} className="text-center font-sans text-sm text-[#8C7A64]">
                {hour}
              </span>
            ))}
          </div>
        </div>
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

export function DashboardView({
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
            {itemRanking.slice(0, 5).map((item, index) => (
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
            {itemRanking.slice(0, 5).map((item) => (
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

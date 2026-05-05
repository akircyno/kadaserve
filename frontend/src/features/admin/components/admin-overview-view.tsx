"use client";

import type { StaffOrder } from "@/types/orders";

const weekDays = ["MON", "TUES", "WED", "THURS", "FRI", "SAT", "SUN"];
const peakHourLabels = ["5P", "6P", "7P", "8P", "9P", "10P", "11P", "12A"];

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
  const isMidnight = label.includes("A") && hourNumber === 12;

  if (isMidnight) return 0;
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
    <section className="rounded-[16px] bg-white/80 p-4 shadow-[inset_0_0_0_1px_rgba(216,200,167,0.52)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans text-xl font-bold text-[#0D2E18]">{title}</h2>
        {rightLabel ? (
          <p className="font-sans text-[15px] uppercase text-[#684B35]">{rightLabel}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#DCCFB8] bg-white px-4 py-3 shadow-[0_8px_18px_rgba(13,46,24,0.05)]">
      <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
        {label}
      </p>
      <p className="mt-3 font-sans text-3xl font-black tabular-nums text-[#0D2E18]">{value}</p>
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
    <div className="grid grid-cols-[34px_1fr_72px_120px] items-center gap-4 border-b border-[#E8D9BE] py-3 font-sans text-[15px] last:border-b-0">
      <span className="font-bold text-[#684B35]">{index}</span>
      <span className="font-semibold text-[#0D2E18]">{label}</span>
      <span className="font-semibold tabular-nums text-[#684B35]">{value}</span>
      <ProgressBar max={max} value={value} />
    </div>
  );
}

function RatingRow({ item, rating }: { item: string; rating: number }) {
  return (
    <div className="grid grid-cols-[120px_1fr_50px] items-center gap-4 border-b border-[#E8D9BE] py-3 font-sans text-[15px] last:border-b-0">
      <span className="font-semibold text-[#0D2E18]">{item}</span>
      <ProgressBar max={5} value={rating} />
      <span className="font-semibold tabular-nums text-[#684B35]">{rating.toFixed(1)}</span>
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
            <span className="font-sans text-[15px]">{day}</span>
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
              <span key={hour} className="text-center font-sans text-[15px] text-[#8C7A64]">
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

function matchesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search.trim().toLowerCase());
}

export function DashboardView({
  averageRating,
  averageOrderValue,
  grossIncomeSales,
  hourlyDateLabel,
  hourlyCounts,
  itemRanking,
  maxHourlyOrders,
  maxItemOrders,
  maxWeekdayOrders,
  nonCancelledOrders,
  weeklyTrendCounts,
  weeklyTrendLabel,
  totalOrders,
  totalOrdersLabel = "Total Orders",
  search,
  weekdayCounts,
}: {
  averageRating: number;
  averageOrderValue: number;
  grossIncomeSales: number;
  hourlyDateLabel: string;
  hourlyCounts: Array<{ label: string; orders: number }>;
  itemRanking: Array<{ item: string; orders: number; revenue: number; rating: number }>;
  maxHourlyOrders: number;
  maxItemOrders: number;
  maxWeekdayOrders: number;
  nonCancelledOrders: StaffOrder[];
  weeklyTrendCounts: Array<{ label: string; orders: number }>;
  weeklyTrendLabel: string;
  totalOrders: number;
  totalOrdersLabel?: string;
  search?: string;
  weekdayCounts: Array<{ day: string; orders: number }>;
}) {
  const keyword = search?.trim().toLowerCase() ?? "";
  const metricCards = [
    { id: "admin-total-orders", label: totalOrdersLabel, value: totalOrders.toString() },
    { id: "admin-gross-sales", label: "Gross Sales", value: peso(grossIncomeSales) },
    { id: "admin-avg-order-value", label: "Avg Order Value", value: peso(averageOrderValue) },
    { id: "admin-average-rating", label: "Avg Rating", value: averageRating ? averageRating.toFixed(1) : "N/A" },
  ];
  const visibleMetricCards = keyword
    ? metricCards.filter(
        (metric) =>
          matchesSearch(metric.label, keyword) || matchesSearch(metric.value, keyword)
      )
    : metricCards;
  const visibleItemRanking = keyword
    ? itemRanking.filter((item) => matchesSearch(item.item, keyword))
    : itemRanking;
  const showOrdersWeek =
    !keyword ||
    matchesSearch("Orders - Week", keyword) ||
    weekdayCounts.some((item) => matchesSearch(item.day, keyword));
  const showPeakHours = !keyword || matchesSearch("Peak Hours", keyword);
  const showTopItems =
    !keyword ||
    matchesSearch("Top Items", keyword) ||
    visibleItemRanking.length > 0;
  const showSatisfaction =
    !keyword ||
    matchesSearch("Satisfaction", keyword) ||
    visibleItemRanking.length > 0;
  const showHourly =
    !keyword ||
    matchesSearch("Hourly Order Volume", keyword) ||
    hourlyCounts.some((item) => matchesSearch(item.label, keyword));
  const showWeekly =
    !keyword ||
    matchesSearch("Weekly Trend", keyword) ||
    weeklyTrendCounts.some((item) => matchesSearch(item.label, keyword));
  const hasDashboardResults =
    visibleMetricCards.length > 0 ||
    showOrdersWeek ||
    showPeakHours ||
    showTopItems ||
    showSatisfaction ||
    showHourly ||
    showWeekly;

  return (
    <div className="space-y-4">
      {visibleMetricCards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleMetricCards.map((metric) => (
            <div
              key={metric.label}
              id={metric.id}
              className="scroll-mt-28"
            >
              <MetricCard
                label={metric.label}
                value={metric.value}
              />
            </div>
          ))}
        </div>
      ) : null}

      {showOrdersWeek || showPeakHours ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        {showOrdersWeek ? (
          <div id="admin-orders-week" className="scroll-mt-28">
          <Panel title="Orders - Week">
          <div className="flex h-[160px] items-end gap-4">
            {weekdayCounts.map((item) => (
              <div key={item.day} className="flex flex-1 flex-col items-center gap-3">
                <p className="font-sans text-sm font-semibold tabular-nums text-[#0D2E18]">
                  {item.orders}
                </p>
                <div
                  className="w-full max-w-[54px] rounded-t-[10px] bg-[#0D2E18]"
                  style={{
                    height: `${Math.max(16, (item.orders / maxWeekdayOrders) * 104)}px`,
                  }}
                />
                <p className="font-sans text-sm text-[#0D2E18]">{item.day}</p>
              </div>
            ))}
          </div>
          </Panel>
          </div>
        ) : null}

        {showPeakHours ? (
          <div id="admin-peak-hours" className="scroll-mt-28">
          <Panel title="Peak Hours">
          <Heatmap compact orders={nonCancelledOrders} />
          </Panel>
          </div>
        ) : null}
        </div>
      ) : null}

      {showTopItems || showSatisfaction ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        {showTopItems ? (
          <div id="admin-top-items" className="scroll-mt-28">
          <Panel title="Top Items" rightLabel="ORDERS">
          <div className="mt-3 space-y-3">
            {visibleItemRanking.slice(0, 5).map((item, index) => (
              <RankingRow
                key={item.item}
                index={index + 1}
                label={item.item}
                value={item.orders}
                max={maxItemOrders}
              />
            ))}
            {visibleItemRanking.length === 0 ? <EmptyState label="No matching item data" /> : null}
          </div>
          </Panel>
          </div>
        ) : null}

        {showSatisfaction ? (
          <div id="admin-satisfaction" className="scroll-mt-28">
          <Panel title="Satisfaction" rightLabel="AVG / 5">
          <div className="mt-3 space-y-3">
            {visibleItemRanking.slice(0, 5).map((item) => (
              <RatingRow key={item.item} item={item.item} rating={item.rating} />
            ))}
            {visibleItemRanking.length === 0 ? <EmptyState label="No matching rating data" /> : null}
          </div>
          </Panel>
          </div>
        ) : null}
        </div>
      ) : null}

      {showHourly ? (
        <div id="admin-hourly-order-volume" className="scroll-mt-28">
        <Panel title="Hourly Order Volume" rightLabel={hourlyDateLabel}>
        <div className="mt-5 flex items-end gap-3 overflow-x-auto pb-2">
          {hourlyCounts.map((item) => (
            <div key={item.label} className="flex min-w-[62px] flex-col items-center gap-2">
              <p className="font-sans text-[15px] tabular-nums text-[#0D2E18]">{item.orders}</p>
              <div
                className="w-12 rounded-full bg-[#0D2E18]"
                style={{
                  height: `${Math.max(10, (item.orders / maxHourlyOrders) * 44)}px`,
                }}
              />
              <p className="font-sans text-[15px] text-[#0D2E18]">{item.label}</p>
            </div>
          ))}
        </div>
        </Panel>
        </div>
      ) : null}

      {showWeekly ? (
        <div id="admin-weekly-trend" className="scroll-mt-28">
        <Panel title="Weekly Trend" rightLabel={weeklyTrendLabel}>
        {weeklyTrendCounts.length > 0 ? (
          <div className="mt-5 flex items-end gap-3 overflow-x-auto pb-2">
            {weeklyTrendCounts.map((item) => (
              <div key={item.label} className="flex min-w-[84px] flex-col items-center gap-2">
                <p className="font-sans text-[15px] tabular-nums text-[#0D2E18]">{item.orders}</p>
                <div
                  className="w-12 rounded-full bg-[#684B35]"
                  style={{
                    height: `${Math.max(10, (item.orders / Math.max(1, ...weeklyTrendCounts.map((entry) => entry.orders))) * 44)}px`,
                  }}
                />
                <p className="text-center font-sans text-[12px] leading-tight text-[#0D2E18]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState label="No weekly analytics yet" />
          </div>
        )}
        </Panel>
        </div>
      ) : null}

      {!hasDashboardResults ? (
        <EmptyState label="No dashboard results match this search" />
      ) : null}
    </div>
  );
}

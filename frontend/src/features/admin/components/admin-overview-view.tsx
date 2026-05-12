"use client";

import { useMemo, useState } from "react";
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
  className = "",
  rightLabel,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  rightLabel?: string;
  title: string;
}) {
  return (
    <section
      className={`rounded-[24px] border border-[#D8C8AA] bg-[#FFFCF7] p-5 shadow-[0_16px_36px_rgba(75,50,24,0.08)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans text-lg font-black text-[#0D2E18]">{title}</h2>
        {rightLabel ? (
          <p className="rounded-full bg-[#FFF0DA] px-3 py-1 font-sans text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#684B35]">
            {rightLabel}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[128px] rounded-[24px] border border-[#D8C8AA] bg-[#FFFCF7] px-5 py-4 shadow-[0_16px_36px_rgba(75,50,24,0.08)]">
      <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8C6C48]">
        {label}
      </p>
      <p className="mt-5 font-sans text-3xl font-black tabular-nums leading-none text-[#0D2E18]">
        {value}
      </p>
    </div>
  );
}

function InsightCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <article className="min-h-[146px] rounded-[24px] border border-[#D8C8AA] bg-[#FFFCF7] px-4 py-4 shadow-[0_16px_34px_rgba(75,50,24,0.08)]">
      <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8C6C48]">
        {label}
      </p>
      <p className="mt-3 font-sans text-2xl font-black leading-tight text-[#0D2E18]">
        {value}
      </p>
      <p className="mt-3 font-sans text-sm leading-relaxed text-[#6D5B48]">
        {detail}
      </p>
    </article>
  );
}

function ProgressBar({ max, value }: { max: number; value: number }) {
  const width = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="h-3 overflow-hidden rounded-full border border-[#DCCFB8] bg-[#FFF8EF]">
      <div
        className="h-full rounded-full bg-[#0D2E18]"
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
    <div className="grid min-h-[54px] grid-cols-[34px_minmax(0,1fr)_48px_112px] items-center gap-3 border-b border-[#E8D9BE] py-2.5 font-sans text-sm last:border-b-0">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF0DA] font-bold text-[#684B35]">
        {index}
      </span>
      <span className="truncate font-semibold text-[#0D2E18]">{label}</span>
      <span className="text-right font-semibold tabular-nums text-[#684B35]">
        {value}
      </span>
      <ProgressBar max={max} value={value} />
    </div>
  );
}

function RatingRow({ item, rating }: { item: string; rating: number }) {
  return (
    <div className="grid min-h-[54px] grid-cols-[minmax(120px,0.8fr)_minmax(120px,1fr)_44px] items-center gap-3 border-b border-[#E8D9BE] py-2.5 font-sans text-sm last:border-b-0">
      <span className="truncate font-semibold text-[#0D2E18]">{item}</span>
      <ProgressBar max={5} value={rating} />
      <span className="text-right font-semibold tabular-nums text-[#684B35]">
        {rating.toFixed(1)}
      </span>
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
  const cells = visibleDays.flatMap((day) =>
    visibleHours.map((hour) => ({
      count: countOrdersForSlot(orders, day, hour),
      day,
      hour,
    }))
  );
  const strongestCell = cells.reduce(
    (best, cell) => (cell.count > best.count ? cell : best),
    cells[0] ?? { count: 0, day: "N/A", hour: "N/A" }
  );

  return (
    <div className="mt-4 rounded-[18px] bg-[#FFF8EF] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8C6C48]">
          Strongest slot
        </p>
        <span className="rounded-full border border-[#D8C8AA] bg-[#FFFCF7] px-3 py-1 font-sans text-xs font-bold text-[#0D2E18]">
          {strongestCell.day} {strongestCell.hour} · {strongestCell.count} orders
        </span>
      </div>
      <div className="space-y-2">
        {visibleDays.map((day) => (
          <div key={day} className="grid grid-cols-[44px_1fr] items-center gap-2">
            <span className="font-sans text-xs font-bold text-[#684B35]">{day}</span>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${visibleHours.length}, minmax(0, 1fr))` }}>
              {visibleHours.map((hour) => {
                const count = countOrdersForSlot(orders, day, hour);

                return (
                  <div
                    key={`${day}-${hour}`}
                    className="h-8 rounded-[10px] border border-white/60 transition hover:scale-[1.02]"
                    title={`${day} ${hour}: ${count} orders`}
                    style={{ backgroundColor: getHeatmapColor(count, maxOrders) }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[44px_1fr] gap-2 pt-1">
          <span />
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${visibleHours.length}, minmax(0, 1fr))` }}>
            {visibleHours.map((hour) => (
              <span key={hour} className="text-center font-sans text-xs font-semibold text-[#8C7A64]">
                {hour}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HourlyVolumeGrid({
  hourlyCounts,
  maxHourlyOrders,
}: {
  hourlyCounts: Array<{ label: string; orders: number }>;
  maxHourlyOrders: number;
}) {
  return (
    <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-8 2xl:grid-cols-12">
      {hourlyCounts.map((item) => {
        const hasOrders = item.orders > 0;
        const height = Math.max(8, (item.orders / maxHourlyOrders) * 44);

        return (
          <div
            key={item.label}
            className="flex min-h-[68px] flex-col items-center justify-end gap-1.5 rounded-[14px] bg-[#FFF8EF] px-2 py-2"
            title={`${item.label}: ${item.orders} orders`}
          >
            <span className="font-sans text-[0.7rem] font-bold tabular-nums text-[#0D2E18]">
              {item.orders}
            </span>
            <div className="flex h-11 items-end">
              <div
                className={`w-7 rounded-full ${
                  hasOrders ? "bg-[#0D2E18]" : "bg-[#D8C8AA]"
                }`}
                style={{ height: `${height}px` }}
              />
            </div>
            <span className="font-sans text-[0.68rem] font-semibold text-[#684B35]">
              {item.label}
            </span>
          </div>
        );
      })}
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

function DemandGrowthChart({
  points,
}: {
  points: Array<{ label: string; orders: number }>;
}) {
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, points.length - 1)
  );
  const [rangeSize, setRangeSize] = useState<4 | 8 | "all">(4);
  const visiblePoints = useMemo(() => {
    if (rangeSize === "all") return points;

    return points.slice(-rangeSize);
  }, [points, rangeSize]);
  const chartWidth = 860;
  const chartHeight = 232;
  const padding = { bottom: 40, left: 50, right: 46, top: 58 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const maxOrders = Math.max(1, ...visiblePoints.map((point) => point.orders));
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    Math.round((maxOrders / 4) * index)
  );
  const coordinates = useMemo(
    () =>
      visiblePoints.map((point, index) => {
        const x =
          padding.left +
          (visiblePoints.length > 1
            ? (innerWidth / (visiblePoints.length - 1)) * index
            : innerWidth / 2);
        const y =
          padding.top + innerHeight - (point.orders / maxOrders) * innerHeight;

        return { ...point, x, y };
      }),
    [innerHeight, innerWidth, maxOrders, padding.left, padding.top, visiblePoints]
  );
  const boundedActiveIndex = Math.min(
    Math.max(activeIndex, 0),
    Math.max(0, coordinates.length - 1)
  );
  const activePoint = coordinates[boundedActiveIndex] ?? coordinates.at(-1);
  const previousPoint =
    boundedActiveIndex > 0 ? coordinates[boundedActiveIndex - 1] : undefined;
  const activeDelta = previousPoint
    ? activePoint.orders - previousPoint.orders
    : activePoint?.orders ?? 0;
  const activeDeltaLabel =
    boundedActiveIndex === 0
      ? "Baseline week"
      : activeDelta >= 0
      ? `+${activeDelta} vs previous`
      : `${activeDelta} vs previous`;
  const tooltipWidth = 168;
  const tooltipHeight = 50;
  const tooltipX = activePoint
    ? Math.min(
        Math.max(activePoint.x - tooltipWidth / 2, padding.left),
        chartWidth - padding.right - tooltipWidth
      )
    : padding.left;
  const tooltipY = padding.top - tooltipHeight - 12;
  const linePath = coordinates
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;

      const previous = coordinates[index - 1];
      const controlOffset = (point.x - previous.x) / 2;

      return `C ${previous.x + controlOffset} ${previous.y}, ${
        point.x - controlOffset
      } ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");
  const areaPath =
    coordinates.length > 0
      ? `${linePath} L ${coordinates.at(-1)?.x ?? padding.left} ${
          padding.top + innerHeight
        } L ${coordinates[0].x} ${padding.top + innerHeight} Z`
      : "";
  const formatAxisLabel = (label: string) => label.replaceAll(" - ", "-");
  const getTextAnchor = (index: number) => {
    if (index === 0) return "start";
    if (index === coordinates.length - 1) return "end";

    return "middle";
  };

  return (
    <div className="mt-4 rounded-[22px] border border-[#EFE3CF] bg-[#FFF8EF] px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8C6C48]">
            Selected range
          </p>
          <p className="mt-1 font-sans text-base font-black text-[#0D2E18]">
            {activePoint?.label ?? "No range"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-[#D8C8AA] bg-[#FFFCF7] p-1">
            {[
              { label: "Last 4", value: 4 },
              { label: "Last 8", value: 8 },
              { label: "All", value: "all" },
            ].map((range) => {
              const isActive = rangeSize === range.value;

              return (
                <button
                  key={range.label}
                  type="button"
                  onClick={() => {
                    const nextRange = range.value as 4 | 8 | "all";
                    const nextPointCount =
                      nextRange === "all"
                        ? points.length
                        : Math.min(points.length, nextRange);

                    setRangeSize(nextRange);
                    setActiveIndex(Math.max(0, nextPointCount - 1));
                  }}
                  className={`rounded-full px-3 py-1.5 font-sans text-xs font-bold transition ${
                    isActive
                      ? "bg-[#0D2E18] text-[#FFF8EF]"
                      : "text-[#684B35] hover:bg-[#FFF0DA]"
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#D8C8AA] bg-[#FFFCF7] px-4 py-2">
            <span className="font-sans text-sm font-bold tabular-nums text-[#0D2E18]">
              {activePoint?.orders ?? 0} orders
            </span>
            <span
              className={`font-sans text-xs font-bold ${
                activeDelta >= 0 ? "text-[#0F441D]" : "text-[#9C543D]"
              }`}
            >
              {activeDeltaLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden">
      <svg
        aria-label="Demand growth line chart"
        className="h-auto w-full"
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <defs>
          <linearGradient id="demandGrowthArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0D2E18" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#0D2E18" stopOpacity="0.02" />
          </linearGradient>
          <filter id="demandGrowthGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="8"
              floodColor="#0D2E18"
              floodOpacity="0.18"
              stdDeviation="5"
            />
          </filter>
        </defs>

        {yTicks.map((tick) => {
          const y = padding.top + innerHeight - (tick / maxOrders) * innerHeight;

          return (
            <g key={tick}>
              <line
                stroke="#E8D9BE"
                strokeDasharray="4 6"
                strokeWidth="1"
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={y}
                y2={y}
              />
              <text
                fill="#8C7A64"
                fontSize="12"
                textAnchor="end"
                x={padding.left - 12}
                y={y + 4}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {areaPath ? <path d={areaPath} fill="url(#demandGrowthArea)" /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            filter="url(#demandGrowthGlow)"
            stroke="#0D2E18"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5"
          />
        ) : null}

        {activePoint ? (
          <g pointerEvents="none">
            <line
              stroke="#D0AC91"
              strokeDasharray="4 5"
              strokeWidth="1.5"
              x1={activePoint.x}
              x2={activePoint.x}
              y1={padding.top}
              y2={padding.top + innerHeight}
            />
            <g
              transform={`translate(${tooltipX} ${tooltipY})`}
            >
              <rect
                fill="#0D2E18"
                height={tooltipHeight}
                rx="14"
                width={tooltipWidth}
              />
              <text fill="#FFF8EF" fontSize="11" fontWeight="800" x="14" y="20">
                {activePoint.label}
              </text>
              <text fill="#E8D9BE" fontSize="11" fontWeight="700" x="14" y="36">
                {activePoint.orders} orders - {activeDeltaLabel}
              </text>
            </g>
          </g>
        ) : null}

        {coordinates.map((point, index) => {
          const isActive = index === boundedActiveIndex;

          return (
          <g key={point.label}>
            <circle
              cx={point.x}
              cy={point.y}
              fill="transparent"
              onFocus={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
              r="22"
              tabIndex={0}
            />
            <circle
              cx={point.x}
              cy={point.y}
              fill="#FFF8EF"
              r={isActive ? "9" : "6"}
              stroke="#0D2E18"
              strokeWidth={isActive ? "5" : "3"}
            />
            <text
              fill="#684B35"
              fontSize="12"
              fontWeight="700"
              textAnchor={getTextAnchor(index)}
              x={point.x}
              y={chartHeight - 12}
            >
              {formatAxisLabel(point.label)}
            </text>
          </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}

function matchesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search.trim().toLowerCase());
}

function getPercentDelta(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

export function DashboardView({
  averageRating,
  averageOrderValue,
  feedbackCount,
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
  feedbackCount: number;
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
  const busiestHour = hourlyCounts.reduce(
    (best, item) => (item.orders > best.orders ? item : best),
    hourlyCounts[0] ?? { label: "N/A", orders: 0 }
  );
  const busiestDay = weekdayCounts.reduce(
    (best, item) => (item.orders > best.orders ? item : best),
    weekdayCounts[0] ?? { day: "N/A", orders: 0 }
  );
  const topItem = itemRanking[0];
  const latestWeek = weeklyTrendCounts.at(-1)?.orders ?? 0;
  const previousWeek = weeklyTrendCounts.at(-2)?.orders ?? 0;
  const trendDelta = getPercentDelta(latestWeek, previousWeek);
  const trendLabel =
    weeklyTrendCounts.length < 2
      ? "New baseline"
      : trendDelta >= 0
      ? `+${Math.round(trendDelta)}%`
      : `${Math.round(trendDelta)}%`;
  const satisfactionLabel =
    feedbackCount === 0
      ? "No signal"
      : averageRating >= 4.5
      ? "Strong"
      : averageRating >= 4
      ? "Healthy"
      : "Needs review";
  const visibleInsights = [
    {
      label: "Demand Signal",
      value: busiestHour.orders > 0 ? busiestHour.label : "No peak yet",
      detail:
        busiestHour.orders > 0
          ? `${busiestHour.orders} orders at the strongest hour. Prepare staff and batching around ${busiestDay.day}.`
          : "No demand cluster has enough data yet.",
    },
    {
      label: "Growth Pulse",
      value: trendLabel,
      detail:
        weeklyTrendCounts.length < 2
          ? "Weekly analytics need another period before growth can be compared."
          : `${latestWeek} orders in the latest week versus ${previousWeek} before.`,
    },
    {
      label: "Preference Signal",
      value: topItem?.item ?? "No item yet",
      detail: topItem
        ? `${topItem.orders} item orders. Use this as a recommendation and menu-placement signal.`
        : "No ranked item pattern is available yet.",
    },
    {
      label: "Satisfaction Signal",
      value: satisfactionLabel,
      detail:
        feedbackCount > 0
          ? `${averageRating.toFixed(1)} average from ${feedbackCount} feedback samples.`
          : "Collect feedback first before presenting satisfaction quality.",
    },
  ].filter(
    (insight) =>
      !keyword ||
      matchesSearch(insight.label, keyword) ||
      matchesSearch(insight.value, keyword) ||
      matchesSearch(insight.detail, keyword)
  );
  const visibleItemRanking = keyword
    ? itemRanking.filter((item) => matchesSearch(item.item, keyword))
    : itemRanking;
  const showInsights = !keyword || visibleInsights.length > 0;
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
    matchesSearch("Demand Growth", keyword) ||
    matchesSearch("Weekly Trend", keyword) ||
    weeklyTrendCounts.some((item) => matchesSearch(item.label, keyword));
  const hasDashboardResults =
    visibleMetricCards.length > 0 ||
    showInsights ||
    showOrdersWeek ||
    showPeakHours ||
    showTopItems ||
    showSatisfaction ||
    showHourly ||
    showWeekly;

  return (
    <div className="space-y-5">
      {showInsights ? (
        <section
          id="admin-decision-support"
          className="scroll-mt-28 overflow-hidden rounded-[30px] border border-[#D8C8AA] bg-white/88 p-5 shadow-[0_18px_44px_rgba(75,50,24,0.1)]"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#8C6C48]">
                Admin Snapshot
              </p>
              <h2 className="mt-1 font-sans text-2xl font-black text-[#0D2E18]">
                Demand, growth, preference, and satisfaction
              </h2>
            </div>
          </div>

          {visibleInsights.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {visibleInsights.map((insight) => (
                <InsightCard
                  key={insight.label}
                  detail={insight.detail}
                  label={insight.label}
                  value={insight.value}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState label="No insight cards match this search" />
            </div>
          )}
        </section>
      ) : null}

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

      {showWeekly || showPeakHours ? (
        <div className="grid items-stretch gap-4 xl:grid-cols-2">
        {showWeekly ? (
          <div id="admin-weekly-trend" className="scroll-mt-28">
          <Panel className="h-full" title="Demand Growth" rightLabel={weeklyTrendLabel}>
          {weeklyTrendCounts.length > 0 ? (
            <DemandGrowthChart points={weeklyTrendCounts} />
          ) : (
            <div className="mt-4">
              <EmptyState label="No demand growth data yet" />
            </div>
          )}
          </Panel>
          </div>
        ) : null}

        {showPeakHours ? (
          <div id="admin-peak-hours" className="scroll-mt-28">
          <Panel className="h-full" title="Peak Hours">
          <Heatmap compact orders={nonCancelledOrders} />
          </Panel>
          </div>
        ) : null}
        </div>
      ) : null}

      {showOrdersWeek || showHourly ? (
        <div className="grid items-stretch gap-4 xl:grid-cols-2">
        {showOrdersWeek ? (
          <div id="admin-orders-week" className="scroll-mt-28">
          <Panel className="h-full" title="Orders - Week">
          <div className="mt-3 flex h-[150px] items-end gap-3 rounded-[18px] bg-[#FFF8EF] px-4 pb-4 pt-3">
            {weekdayCounts.map((item) => (
              <div key={item.day} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <p className="font-sans text-xs font-bold tabular-nums text-[#0D2E18]">
                  {item.orders}
                </p>
                <div
                  className="w-full max-w-[44px] rounded-t-[14px] bg-[#0D2E18] shadow-[0_10px_18px_rgba(13,46,24,0.14)]"
                  style={{
                    height: `${Math.max(14, (item.orders / maxWeekdayOrders) * 90)}px`,
                  }}
                />
                <p className="font-sans text-xs font-semibold text-[#684B35]">{item.day}</p>
              </div>
            ))}
          </div>
          </Panel>
          </div>
        ) : null}

        {showHourly ? (
          <div id="admin-hourly-order-volume" className="scroll-mt-28">
          <Panel className="h-full" title="Hourly Order Volume" rightLabel={hourlyDateLabel}>
          <HourlyVolumeGrid
            hourlyCounts={hourlyCounts}
            maxHourlyOrders={maxHourlyOrders}
          />
          </Panel>
          </div>
        ) : null}
        </div>
      ) : null}

      {showTopItems || showSatisfaction ? (
        <div className="grid items-stretch gap-4 xl:grid-cols-2">
        {showTopItems ? (
          <div id="admin-top-items" className="scroll-mt-28">
          <Panel className="h-full" title="Top Items" rightLabel="ORDERS">
          <div className="mt-3 rounded-[18px] bg-[#FFF8EF] px-3">
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
          <Panel className="h-full" title="Satisfaction" rightLabel="AVG / 5">
          <div className="mt-3 rounded-[18px] bg-[#FFF8EF] px-3">
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

      {!hasDashboardResults ? (
        <EmptyState label="No dashboard results match this search" />
      ) : null}
    </div>
  );
}

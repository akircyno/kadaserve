"use client";

import { type ComponentType, useState } from "react";
import { Activity, BarChart3, Clock, Flame, TrendingUp, Users } from "lucide-react";

export type PeakHourWindow = {
  id: string;
  day_of_week: number;
  hour_start: number;
  hour_end: number;
  avg_order_count: number;
  intensity: string;
  detected_at: string;
};

const weekDays = [
  { label: "MON", value: 1 },
  { label: "TUES", value: 2 },
  { label: "WED", value: 3 },
  { label: "THURS", value: 4 },
  { label: "FRI", value: 5 },
  { label: "SAT", value: 6 },
  { label: "SUN", value: 0 },
];

// Operating hours: 5PM (17) to 12AM (0)
const OPERATING_HOURS = [17, 18, 19, 20, 21, 22, 23, 0];
const HOUR_LABELS = ["5PM", "6PM", "7PM", "8PM", "9PM", "10PM", "11PM", "12AM"];

function formatHourNumber(hour: number) {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const displayHour = normalizedHour % 12 || 12;
  const suffix = normalizedHour < 12 ? "A" : "P";

  return `${displayHour}${suffix}`;
}

function getDayLabel(dayOfWeek: number) {
  return weekDays.find((day) => day.value === dayOfWeek)?.label ?? "DAY";
}

function formatOrderCount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getVolumeBand(orders: number, maxOrders: number) {
  if (orders === 0) return "None";

  const ratio = orders / Math.max(1, maxOrders);

  if (ratio >= 0.8) return "Peak";
  if (ratio >= 0.5) return "High";
  if (ratio >= 0.25) return "Medium";

  return "Low";
}

function TimeSeriesMetricCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#DCCFB8] bg-[#FFFCF7] p-4 shadow-[0_10px_24px_rgba(75,50,24,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
          {label}
        </p>
        <Icon size={16} className="text-[#7D6B55]" />
      </div>
      <p className="mt-3 font-sans text-[1.75rem] font-bold leading-none text-[#0D2E18]">
        {value}
      </p>
      <p className="mt-2 font-sans text-xs font-semibold text-[#8C7A64]">
        {detail}
      </p>
    </div>
  );
}

function ServiceWindowCurve({
  activeIndex,
  maxOrders,
  points,
  setActiveIndex,
}: {
  activeIndex: number;
  maxOrders: number;
  points: Array<{ label: string; orders: number }>;
  setActiveIndex: (index: number) => void;
}) {
  const width = 640;
  const height = 200;
  const padX = 40;
  const padTop = 22;
  const padBottom = 42;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padTop - padBottom;
  const yTicks = Array.from(new Set([maxOrders, Math.round(maxOrders / 2), 0]));
  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (plotWidth * index) / (points.length - 1);
    const y =
      padTop +
      plotHeight -
      (point.orders / Math.max(1, maxOrders)) * plotHeight;

    return { ...point, x, y };
  });
  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${path} L ${coords.at(-1)?.x ?? padX} ${padTop + plotHeight} L ${
    coords[0]?.x ?? padX
  } ${padTop + plotHeight} Z`;
  const activePoint = coords[activeIndex] ?? coords[0];

  return (
    <div className="flex h-full flex-col rounded-[22px] border border-[#DCCFB8] bg-[#FFFCF7] p-5 shadow-[0_12px_30px_rgba(75,50,24,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
            Demand Curve
          </p>
          <h3 className="mt-1 font-sans text-xl font-bold text-[#0D2E18]">
            Hourly demand curve
          </h3>
        </div>
        {activePoint ? (
          <div className="rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-4 py-2 text-right font-sans text-xs font-bold text-[#684B35]">
            {activePoint.label} | {activePoint.orders} orders
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-1 items-center rounded-[20px] border border-[#EFE3CF] bg-white px-3 py-4">
        <svg
          aria-label="Hourly demand curve"
          className="h-[220px] w-full overflow-visible"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          {yTicks.map((tick) => {
            const y =
              padTop +
              plotHeight -
              (tick / Math.max(1, maxOrders)) * plotHeight;

            return (
              <g key={tick}>
                <line
                  x1={padX}
                  x2={width - padX}
                  y1={y}
                  y2={y}
                  stroke="#EFE3CF"
                  strokeDasharray="6 8"
                  strokeWidth="1"
                />
                <text
                  fill="#8C7A64"
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="end"
                  x={padX - 10}
                  y={y + 4}
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {coords.length > 0 ? (
            <>
              <path d={areaPath} fill="rgba(13,46,24,0.08)" />
              <path
                d={path}
                fill="none"
                stroke="#0D2E18"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="5"
              />
              {coords.map((point, index) => (
                <g key={point.label}>
                  <line
                    x1={point.x}
                    x2={point.x}
                    y1={point.y}
                    y2={padTop + plotHeight}
                    stroke={index === activeIndex ? "#DCCFB8" : "transparent"}
                    strokeDasharray="5 7"
                    strokeWidth="2"
                  />
                  <circle
                    className="cursor-pointer transition"
                    cx={point.x}
                    cy={point.y}
                    fill={index === activeIndex ? "#FFF8EF" : "#FFFCF7"}
                    onFocus={() => setActiveIndex(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    r={index === activeIndex ? 8 : 6}
                    stroke="#0D2E18"
                    strokeWidth={index === activeIndex ? 5 : 3}
                    tabIndex={0}
                  />
                  <text
                    fill="#684B35"
                    fontSize="11"
                    fontWeight="800"
                    textAnchor="middle"
                    x={point.x}
                    y={height - 10}
                  >
                    {points.length > 12 && index !== activeIndex && index % 3 !== 0
                      ? ""
                      : point.label}
                  </text>
                </g>
              ))}
            </>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

function Heatmap({ peakHourWindows }: { peakHourWindows: PeakHourWindow[] }) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  
  const rowsBySlot = new Map(
    peakHourWindows.map((row) => [
      `${Number(row.day_of_week)}:${Number(row.hour_start)}`,
      row,
    ])
  );
  
  // Calculate max only from operating hours
  const operatingHourData = peakHourWindows.filter((row) =>
    OPERATING_HOURS.includes(Number(row.hour_start))
  );
  const maxOrders = Math.max(
    1,
    ...operatingHourData.map((row) => Number(row.avg_order_count ?? 0))
  );

  const getIntensityColor = (avgOrderCount: number, max: number) => {
    if (avgOrderCount === 0) return { bg: "#FFF8EF", border: "#DCCFB8" };
    
    const ratio = avgOrderCount / max;
    
    if (ratio >= 0.9) return { bg: "#0D2E18", border: "#0D2E18", glow: true };
    if (ratio >= 0.7) return { bg: "#0F441D", border: "#0F441D" };
    if (ratio >= 0.5) return { bg: "#684B35", border: "#684B35" };
    if (ratio >= 0.3) return { bg: "#8C7A64", border: "#8C7A64" };
    
    return { bg: "#EFE3CF", border: "#DCCFB8" };
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Heatmap Grid */}
      <div className="rounded-[18px] border border-[#EFE3CF] bg-white/45 p-4">
        <div className="space-y-2">
          {weekDays.map((day) => (
            <div
              key={day.label}
              className="grid grid-cols-[58px_repeat(8,minmax(46px,1fr))] items-center gap-2"
            >
              <span className="font-sans text-xs font-bold text-[#0D2E18]">
                {day.label}
              </span>
              {OPERATING_HOURS.map((hour, idx) => {
                const row = rowsBySlot.get(`${day.value}:${hour}`);
                const avgOrderCount = Number(row?.avg_order_count ?? 0);
                const colors = getIntensityColor(avgOrderCount, maxOrders);
                const cellId = `${day.value}:${hour}`;
                const isHovered = hoveredCell === cellId;

                return (
                  <div
                    key={`${day.label}-${hour}`}
                    onMouseEnter={() => setHoveredCell(cellId)}
                    onMouseLeave={() => setHoveredCell(null)}
                    className="group relative cursor-pointer"
                  >
                    <div
                      className={`h-10 rounded-[12px] border transition-all duration-200 ${
                        isHovered
                          ? "scale-[1.03] shadow-lg"
                          : "hover:scale-[1.015] hover:shadow-md"
                      } ${
                        colors.glow
                          ? "shadow-[0_0_16px_rgba(13,46,24,0.22)]"
                          : ""
                      }`}
                      style={{
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                        borderWidth: "1.5px",
                      }}
                      title={`${day.label} / ${HOUR_LABELS[idx]} / ${formatOrderCount(avgOrderCount)} orders`}
                    />

                    {isHovered && (
                      <div className="absolute bottom-full left-1/2 z-20 mb-3 -translate-x-1/2 rounded-lg bg-[#0D2E18] px-3 py-2 text-xs font-semibold whitespace-nowrap text-white shadow-lg animate-in fade-in zoom-in-95 duration-200">
                        {day.label} / {HOUR_LABELS[idx]}
                        <br />
                        <span className="text-[#FFF0DA]">
                          {formatOrderCount(avgOrderCount)} orders
                        </span>
                        <div className="absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-t-4 border-r-4 border-l-4 border-t-[#0D2E18] border-r-transparent border-l-transparent" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-[58px_repeat(8,minmax(46px,1fr))] gap-2">
          <span />
          {HOUR_LABELS.map((label) => (
            <span
              key={label}
              className="text-center font-sans text-xs font-bold text-[#8C7A64]"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs">
        <span className="font-sans font-semibold text-[#684B35]">Traffic Level:</span>
        <div className="flex gap-3">
          {[
            { color: "#0D2E18", label: "Very High" },
            { color: "#0F441D", label: "High" },
            { color: "#684B35", label: "Medium" },
            { color: "#8C7A64", label: "Low" },
            { color: "#EFE3CF", label: "Minimal" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-md"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-sans text-[#8C7A64]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#DCCFB8] bg-[#FFF8EF] px-4 py-8 text-center font-sans text-sm text-[#8C7A64]">
      {label}
    </div>
  );
}

function PeakInsights({
  peakHourWindows,
}: {
  peakHourWindows: PeakHourWindow[];
}) {
  if (peakHourWindows.length === 0) return null;

  // Get strongest day
  const dayOrderTotals = new Map<number, number>();
  peakHourWindows.forEach((window) => {
    const dayOfWeek = Number(window.day_of_week);
    const currentTotal = dayOrderTotals.get(dayOfWeek) ?? 0;
    dayOrderTotals.set(dayOfWeek, currentTotal + Number(window.avg_order_count ?? 0));
  });

  const strongestDay = Array.from(dayOrderTotals.entries()).reduce((max, current) =>
    current[1] > max[1] ? current : max
  );
  const strongestDayLabel = getDayLabel(strongestDay[0]);

  // Get strongest hour
  const hourOrderTotals = new Map<number, number>();
  peakHourWindows.forEach((window) => {
    const hour = Number(window.hour_start);
    const currentTotal = hourOrderTotals.get(hour) ?? 0;
    hourOrderTotals.set(hour, currentTotal + Number(window.avg_order_count ?? 0));
  });

  const strongestHour = Array.from(hourOrderTotals.entries()).reduce((max, current) =>
    current[1] > max[1] ? current : max
  );
  const strongestHourLabel = HOUR_LABELS[OPERATING_HOURS.indexOf(strongestHour[0])] || formatHourNumber(strongestHour[0]);

  // Get average peak window
  const avgOrderCount = Math.round(
    peakHourWindows.reduce((sum, w) => sum + Number(w.avg_order_count ?? 0), 0) /
      peakHourWindows.length
  );

  // Determine staffing recommendation
  const maxOrders = Math.max(...peakHourWindows.map((w) => Number(w.avg_order_count ?? 0)));
  let staffingLevel = "Standard";
  let staffingColor = "bg-[#E6F2E8] border-[#0F441D]/20";
  if (maxOrders >= 8) {
    staffingLevel = "High Alert";
    staffingColor = "bg-[#FFF1EC] border-[#C55432]/20";
  } else if (maxOrders >= 5) {
    staffingLevel = "Elevated";
    staffingColor = "bg-[#FFF0DA] border-[#DCCFB8]";
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-[#DCCFB8]/40 bg-white/60 p-4">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#684B35]">
          Busiest Day
        </p>
        <p className="mt-2 font-sans text-2xl font-bold text-[#0D2E18]">
          {strongestDayLabel}
        </p>
        <p className="mt-1 font-sans text-xs text-[#8C7A64]">
          {Math.round(strongestDay[1])} avg orders
        </p>
      </div>

      <div className="rounded-lg border border-[#DCCFB8]/40 bg-white/60 p-4">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#684B35]">
          Peak Hour
        </p>
        <p className="mt-2 font-sans text-2xl font-bold text-[#0D2E18]">
          {strongestHourLabel}
        </p>
        <p className="mt-1 font-sans text-xs text-[#8C7A64]">
          {Math.round(strongestHour[1])} avg orders
        </p>
      </div>

      <div className="rounded-lg border border-[#DCCFB8]/40 bg-white/60 p-4">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#684B35]">
          Average Traffic
        </p>
        <p className="mt-2 font-sans text-2xl font-bold text-[#0D2E18]">
          {avgOrderCount}
        </p>
        <p className="mt-1 font-sans text-xs text-[#8C7A64]">
          orders per window
        </p>
      </div>

      <div className={`rounded-lg border p-4 ${staffingColor}`}>
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#684B35]">
          Staffing Level
        </p>
        <p className="mt-2 font-sans text-2xl font-bold text-[#0D2E18]">
          {staffingLevel}
        </p>
        <p className="mt-1 font-sans text-xs text-[#8C7A64]">
          {maxOrders} max orders
        </p>
      </div>
    </div>
  );
}

export function TimeSeriesView({
  dateLabel,
  hourlyCounts,
  maxHourlyOrders,
}: {
  dateLabel: string;
  hourlyCounts: Array<{ label: string; orders: number }>;
  maxHourlyOrders: number;
}) {
  const peak = hourlyCounts.reduce(
    (best, current) => (current.orders > best.orders ? current : best),
    hourlyCounts[0] ?? { label: "N/A", orders: 0 }
  );
  const total = hourlyCounts.reduce((sum, item) => sum + item.orders, 0);
  const avg = hourlyCounts.length ? Math.round(total / hourlyCounts.length) : 0;
  const low = hourlyCounts.length
    ? Math.min(...hourlyCounts.map((item) => item.orders))
    : 0;
  const serviceWindowCounts = HOUR_LABELS
    .map((label) => hourlyCounts.find((item) => item.label === label))
    .filter((item): item is { label: string; orders: number } => Boolean(item));
  const serviceTotal = serviceWindowCounts.reduce((sum, item) => sum + item.orders, 0);
  const chartSeries = hourlyCounts.length > 0 ? hourlyCounts : serviceWindowCounts;
  const chartMax = Math.max(1, ...chartSeries.map((item) => item.orders));
  const activeHourCount = hourlyCounts.filter((item) => item.orders > 0).length;
  const serviceShare = total ? Math.round((serviceTotal / total) * 100) : 0;
  const peakIndex = Math.max(
    0,
    chartSeries.findIndex((item) => item.label === peak.label)
  );
  const [selectedServiceIndex, setSelectedServiceIndex] = useState<number | null>(
    null
  );
  const activeServiceIndex =
    selectedServiceIndex == null
      ? peakIndex
      : Math.min(selectedServiceIndex, Math.max(0, chartSeries.length - 1));
  const topHours = [...hourlyCounts]
    .sort((first, second) => second.orders - first.orders)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-[#DCCFB8] bg-[#FFFCF7] p-5 shadow-[0_12px_30px_rgba(75,50,24,0.08)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
              Time Series
            </p>
            <h3 className="mt-1 font-sans text-2xl font-bold text-[#0D2E18]">
              Hourly demand profile
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-4 py-2 font-sans text-xs font-bold text-[#684B35]">
              {dateLabel}
            </span>
            <span className="rounded-full border border-[#DCCFB8] bg-white px-4 py-2 font-sans text-xs font-bold text-[#684B35]">
              {total} orders
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TimeSeriesMetricCard
          detail={`at ${peak.label}`}
          icon={Activity}
          label="Peak Hour"
          value={String(peak.orders)}
        />
        <TimeSeriesMetricCard
          detail={`${activeHourCount} active hours`}
          icon={BarChart3}
          label="Total Volume"
          value={String(total)}
        />
        <TimeSeriesMetricCard
          detail={`${serviceShare}% of daily demand`}
          icon={Clock}
          label="Service Window"
          value={String(serviceTotal)}
        />
        <TimeSeriesMetricCard
          detail={`${low} lowest hour`}
          icon={TrendingUp}
          label="Average"
          value={String(avg)}
        />
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-2">
        <ServiceWindowCurve
          activeIndex={activeServiceIndex}
          maxOrders={chartMax}
          points={chartSeries}
          setActiveIndex={setSelectedServiceIndex}
        />

        <section className="flex h-full flex-col rounded-[22px] border border-[#DCCFB8] bg-[#FFFCF7] p-5 shadow-[0_12px_30px_rgba(75,50,24,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
                All-Day Scan
              </p>
              <h3 className="mt-1 font-sans text-xl font-bold text-[#0D2E18]">
                24-hour volume
              </h3>
            </div>
            <span className="rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-1.5 font-sans text-xs font-bold text-[#684B35]">
              {activeHourCount} active
            </span>
          </div>

          <div className="mt-4 grid grid-cols-6 gap-1.5">
            {hourlyCounts.map((item) => (
              <div
                key={item.label}
                className="rounded-[14px] border border-[#EFE3CF] bg-white px-2 py-1.5 text-center"
                title={`${item.label} / ${item.orders} orders`}
              >
                <p className={`font-sans text-xs font-bold tabular-nums ${
                    item.orders === 0 ? "text-[#0D2E18]/35" : "text-[#0D2E18]"
                  }`}>
                  {item.orders}
                </p>
                <div className="mt-1.5 flex h-8 items-end justify-center">
                  <div
                    className="w-5 rounded-t-full"
                    style={{
                      backgroundColor:
                        item.orders >= maxHourlyOrders * 0.8
                          ? "#0D2E18"
                          : item.orders >= maxHourlyOrders * 0.5
                            ? "#0F441D"
                            : item.orders >= maxHourlyOrders * 0.2
                              ? "#684B35"
                              : "#EFE3CF",
                      height: `${Math.max(5, (item.orders / Math.max(1, maxHourlyOrders)) * 30)}px`,
                    }}
                  />
                </div>
                <p className="mt-1 font-sans text-[0.68rem] font-bold text-[#8C7A64]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            {topHours.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                className="flex items-center justify-between rounded-full border border-[#EFE3CF] bg-white px-3 py-2 font-sans text-xs font-bold"
              >
                <span className="text-[#684B35]">#{index + 1} {item.label}</span>
                <span className="text-[#0D2E18]">{item.orders} orders</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[24px] border border-[#DCCFB8] bg-[#FFFCF7] p-5 shadow-[0_12px_30px_rgba(75,50,24,0.08)]">
        <h3 className="font-sans text-lg font-bold text-[#0D2E18]">Hourly Breakdown</h3>
        
        <div className="mt-4 overflow-x-auto rounded-[18px] border border-[#EFE3CF] bg-white">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[1fr_1fr_1fr_1.1fr] gap-4 border-b border-[#EFE3CF] bg-[#FFF8EF] px-5 py-3 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
              <span>Hour</span>
              <span>Orders</span>
              <span>Share</span>
              <span>Trend</span>
            </div>
            <div className="max-h-[360px] divide-y divide-[#EFE3CF] overflow-y-auto">
              {hourlyCounts.map((item, index, list) => {
                const previous = list[index - 1]?.orders ?? item.orders;
                const delta = item.orders - previous;
                const band = getVolumeBand(item.orders, maxHourlyOrders);

                return (
                  <div
                    key={item.label}
                    className={`grid grid-cols-[1fr_1fr_1fr_1.1fr] items-center gap-4 px-5 py-3 font-sans text-sm transition hover:bg-[#FFF8EF] ${
                      index % 2 === 0 ? "bg-white/30" : ""
                    }`}
                  >
                    <span className="font-semibold text-[#0D2E18]">{item.label}</span>
                    <span className="font-bold tabular-nums text-[#0D2E18]">
                      {item.orders}
                    </span>
                    <span className="font-semibold text-[#8C7A64]">
                      {total ? `${Math.round((item.orders / total) * 100)}%` : "0%"}
                    </span>
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                        band === "Peak"
                          ? "bg-[#0D2E18] text-[#FFF8EF]"
                          : band === "High"
                            ? "bg-[#E6F2E8] text-[#0F441D]"
                            : band === "Medium"
                              ? "bg-[#FFF0DA] text-[#684B35]"
                              : "bg-[#EFE3CF] text-[#7D6B55]"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta} / {band}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function PeakHoursView({
  peakHourWindows,
}: {
  peakHourWindows: PeakHourWindow[];
}) {
  const detectedPeakWindows = [...peakHourWindows]
    .sort(
      (first, second) =>
        Number(second.avg_order_count ?? 0) - Number(first.avg_order_count ?? 0) ||
        Number(first.day_of_week ?? 0) - Number(second.day_of_week ?? 0) ||
        Number(first.hour_start ?? 0) - Number(second.hour_start ?? 0)
    )
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Main Analytics Card Header */}
      <section className="rounded-2xl border border-[#DCCFB8]/40 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8EF] to-[#FFF8EF] p-8 shadow-[0_12px_40px_rgba(75,50,24,0.1)] transition-all hover:shadow-[0_20px_60px_rgba(75,50,24,0.15)]">
        <div className="space-y-3">
          {/* Title with Icon */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Flame size={20} className="text-[#684B35]" />
                <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
                  Peak Hour Intelligence
                </p>
              </div>
              <h3 className="font-sans text-2xl font-bold text-[#0D2E18]">
                Busiest operating hours
              </h3>
            </div>
            <span className="whitespace-nowrap rounded-full border border-[#DCCFB8] bg-[#FFF0DA]/60 px-4 py-2 font-sans text-xs font-semibold text-[#684B35]">
              <Clock size={12} className="inline mr-1" />
              5PM-12AM
            </span>
          </div>
        </div>
      </section>

      {/* Peak Insights Cards */}
      {peakHourWindows.length > 0 && (
        <div>
          <h4 className="mb-3 font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#684B35]">
            Quick Intelligence
          </h4>
          <PeakInsights peakHourWindows={peakHourWindows} />
        </div>
      )}

      {/* Modern Heatmap Section */}
      <section className="rounded-2xl border border-[#DCCFB8]/40 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8EF] to-[#FFF8EF] p-8 shadow-[0_12px_40px_rgba(75,50,24,0.1)]">
        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#684B35]" />
            <h4 className="font-sans text-lg font-bold text-[#0D2E18]">
              Hourly Traffic Heatmap
            </h4>
          </div>
        </div>

        <div className="mt-8">
          {peakHourWindows.length > 0 ? (
            <Heatmap peakHourWindows={peakHourWindows} />
          ) : (
            <EmptyState label="Waiting for traffic data..." />
          )}
        </div>
      </section>

      {/* Busiest Service Hours Section */}
      {detectedPeakWindows.length > 0 && (
        <section className="rounded-2xl border border-[#DCCFB8]/40 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8EF] to-[#FFF8EF] p-8 shadow-[0_12px_40px_rgba(75,50,24,0.1)]">
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#684B35]" />
              <h4 className="font-sans text-lg font-bold text-[#0D2E18]">
                Busiest Service Hours
              </h4>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {detectedPeakWindows.map((peak, idx) => {
              const hourIdx = OPERATING_HOURS.indexOf(Number(peak.hour_start));
              const hourLabel = hourIdx >= 0 ? HOUR_LABELS[hourIdx] : formatHourNumber(Number(peak.hour_start));
              
              // Determine intensity styling
              const getIntensityStyle = (intensity: string) => {
                switch (intensity) {
                  case "Very High":
                    return { bg: "#0D2E18", text: "white", badge: "bg-[#0D2E18]/10 text-[#0D2E18]" };
                  case "High":
                    return { bg: "#0F441D", text: "white", badge: "bg-[#E6F2E8] text-[#0F441D]" };
                  case "Medium":
                    return { bg: "#684B35", text: "white", badge: "bg-[#FFF0DA] text-[#684B35]" };
                  default:
                    return { bg: "#8C7A64", text: "white", badge: "bg-[#EFE3CF] text-[#684B35]" };
                }
              };

              const style = getIntensityStyle(peak.intensity);

              return (
                <div
                  key={`${peak.day_of_week}-${peak.hour_start}`}
                  className="group rounded-xl border border-[#DCCFB8]/40 bg-white/60 p-5 transition-all hover:border-[#DCCFB8]/70 hover:bg-white hover:shadow-[0_8px_24px_rgba(75,50,24,0.12)]"
                >
                  {/* Rank Badge */}
                  <div className="mb-3 inline-block">
                    <span className="rounded-full bg-[#FFF0DA] px-2.5 py-1 font-sans text-xs font-bold text-[#684B35]">
                      #{idx + 1}
                    </span>
                  </div>

                  {/* Main Content */}
                  <div className="space-y-3">
                    {/* Time Display */}
                    <div>
                      <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#684B35]">
                        {getDayLabel(Number(peak.day_of_week))} / {hourLabel}
                      </p>
                      <p className="mt-2 font-sans text-xl font-bold text-[#0D2E18]">
                        {formatOrderCount(Number(peak.avg_order_count ?? 0))} orders
                      </p>
                    </div>

                    {/* Intensity Badge */}
                    <div className={`rounded-lg px-3 py-2 text-center ${style.badge}`}>
                      <p className="font-sans text-xs font-bold uppercase tracking-[0.1em]">
                        {peak.intensity}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-1.5 rounded-full bg-[#EFE3CF]/40 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${((Number(peak.avg_order_count ?? 0) / 10) * 100).toFixed(0)}%`,
                          backgroundColor: style.bg,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}


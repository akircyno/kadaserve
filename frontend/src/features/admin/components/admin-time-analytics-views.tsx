"use client";

import { useState } from "react";
import { Flame, TrendingUp, Users, Clock } from "lucide-react";

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
const peakHourNumbers = Array.from({ length: 24 }, (_, hour) => hour);

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

function getHeatmapColor(avgOrderCount: number, max: number) {
  if (avgOrderCount === 0) return "#F7FBF5";

  const ratio = avgOrderCount / max;

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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#DCCFB8] bg-white px-4 py-3 shadow-[0_8px_18px_rgba(13,46,24,0.05)]">
      <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">{label}</p>
      <p className="mt-2 font-sans text-2xl font-black text-[#0D2E18]">
        {value}
      </p>
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
    if (avgOrderCount === 0) return { bg: "#FFF3E6", border: "#E8D9BE" };
    
    const ratio = avgOrderCount / max;
    
    if (ratio >= 0.9) return { bg: "#0D2E18", border: "#0D2E18", glow: true };
    if (ratio >= 0.7) return { bg: "#4A6B4D", border: "#3D5A42" };
    if (ratio >= 0.5) return { bg: "#8C6C48", border: "#7A5F3D" };
    if (ratio >= 0.3) return { bg: "#B8956A", border: "#A0825D" };
    
    return { bg: "#FFE8CC", border: "#E8D9BE" };
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Heatmap Grid */}
      <div className="overflow-x-auto rounded-xl pb-2">
        <div className="min-w-full space-y-2">
          {weekDays.map((day) => (
            <div key={day.label} className="grid grid-cols-[70px_1fr] items-center gap-4">
              <span className="font-sans text-sm font-semibold text-[#0D2E18]">
                {day.label}
              </span>
              <div className="flex gap-2">
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
                      className="relative group cursor-pointer"
                    >
                      <div
                        className={`h-10 w-10 rounded-lg transition-all duration-200 border ${
                          isHovered
                            ? "scale-110 shadow-lg"
                            : "hover:scale-105 hover:shadow-md"
                        } ${
                          colors.glow
                            ? "shadow-[0_0_16px_rgba(13,46,24,0.3)]"
                            : ""
                        }`}
                        style={{
                          backgroundColor: colors.bg,
                          borderColor: colors.border,
                          borderWidth: "1.5px",
                        }}
                        title={`${day.label} • ${HOUR_LABELS[idx]} • ${formatOrderCount(avgOrderCount)} orders`}
                      />
                      
                      {/* Tooltip */}
                      {isHovered && (
                        <div className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 z-20 px-3 py-2 rounded-lg bg-[#0D2E18] text-white text-xs font-semibold whitespace-nowrap shadow-lg animate-in fade-in zoom-in-95 duration-200">
                          {day.label} • {HOUR_LABELS[idx]}
                          <br />
                          <span className="text-[#FFF0DA]">
                            {formatOrderCount(avgOrderCount)} orders
                          </span>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#0D2E18]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hour Labels */}
      <div className="flex gap-2 ml-[70px] mt-2">
        {HOUR_LABELS.map((label) => (
          <div key={label} className="h-10 w-10 flex items-center justify-center">
            <span className="font-sans text-xs font-semibold text-[#8C7A64]">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Intensity Legend */}
      <div className="mt-4 flex items-center justify-center flex-wrap gap-4 text-xs">
        <span className="font-sans font-semibold text-[#8C6C48]">Traffic Level:</span>
        <div className="flex gap-3">
          {[
            { color: "#0D2E18", label: "Very High" },
            { color: "#4A6B4D", label: "High" },
            { color: "#8C6C48", label: "Medium" },
            { color: "#B8956A", label: "Low" },
            { color: "#FFE8CC", label: "Minimal" },
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
    <div className="rounded-[18px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-8 text-center font-sans text-sm text-[#8C7A64]">
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
  let staffingColor = "bg-[#4A6B4D]/10 border-[#4A6B4D]/30";
  if (maxOrders >= 8) {
    staffingLevel = "High Alert";
    staffingColor = "bg-[#D97C6F]/10 border-[#D97C6F]/30";
  } else if (maxOrders >= 5) {
    staffingLevel = "Elevated";
    staffingColor = "bg-[#B8956A]/10 border-[#B8956A]/30";
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-[#D8C8AA]/40 bg-white/60 p-4">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8C6C48]">
          Busiest Day
        </p>
        <p className="mt-2 font-sans text-2xl font-bold text-[#0D2E18]">
          {strongestDayLabel}
        </p>
        <p className="mt-1 font-sans text-xs text-[#8C7A64]">
          {Math.round(strongestDay[1])} avg orders
        </p>
      </div>

      <div className="rounded-lg border border-[#D8C8AA]/40 bg-white/60 p-4">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8C6C48]">
          Peak Hour
        </p>
        <p className="mt-2 font-sans text-2xl font-bold text-[#0D2E18]">
          {strongestHourLabel}
        </p>
        <p className="mt-1 font-sans text-xs text-[#8C7A64]">
          {Math.round(strongestHour[1])} avg orders
        </p>
      </div>

      <div className="rounded-lg border border-[#D8C8AA]/40 bg-white/60 p-4">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8C6C48]">
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
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8C6C48]">
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

  return (
    <div className="space-y-4">
      {/* Info Header */}
      <div className="rounded-[24px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] px-6 py-4 shadow-[0_12px_30px_rgba(75,50,24,0.08)]">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <p className="font-sans text-sm text-[#6D5B48]">
            Operating Hours: 5PM–12AM Analysis
          </p>
          <span className="rounded-full border border-[#FFE0BA] bg-[#FFF0DA]/60 px-4 py-1.5 font-sans text-xs font-semibold text-[#684B35]">
            {dateLabel} · {total} total orders
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[20px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] to-[#FFF3E6] p-5 shadow-[0_12px_30px_rgba(75,50,24,0.08)] transition hover:shadow-[0_20px_50px_rgba(75,50,24,0.12)]">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-[#8C6C48]">Peak Hour</p>
          <p className="mt-2 font-sans text-3xl font-bold text-[#0D2E18]">{peak.orders}</p>
          <p className="mt-1 font-sans text-sm text-[#8C7A64]">at {peak.label}</p>
        </div>

        <div className="rounded-[20px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] to-[#FFF3E6] p-5 shadow-[0_12px_30px_rgba(75,50,24,0.08)] transition hover:shadow-[0_20px_50px_rgba(75,50,24,0.12)]">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-[#8C6C48]">Lowest Hour</p>
          <p className="mt-2 font-sans text-3xl font-bold text-[#0D2E18]">{low}</p>
          <p className="mt-1 font-sans text-sm text-[#8C7A64]">orders</p>
        </div>

        <div className="rounded-[20px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] to-[#FFF3E6] p-5 shadow-[0_12px_30px_rgba(75,50,24,0.08)] transition hover:shadow-[0_20px_50px_rgba(75,50,24,0.12)]">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-[#8C6C48]">Average</p>
          <p className="mt-2 font-sans text-3xl font-bold text-[#0D2E18]">{avg}</p>
          <p className="mt-1 font-sans text-sm text-[#8C7A64]">per hour</p>
        </div>

        <div className="rounded-[20px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] to-[#FFF3E6] p-5 shadow-[0_12px_30px_rgba(75,50,24,0.08)] transition hover:shadow-[0_20px_50px_rgba(75,50,24,0.12)]">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-[#8C6C48]">Total Volume</p>
          <p className="mt-2 font-sans text-3xl font-bold text-[#0D2E18]">{total}</p>
          <p className="mt-1 font-sans text-sm text-[#8C7A64]">orders</p>
        </div>
      </div>

      {/* Hourly Volume Chart */}
      <section className="rounded-[24px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] p-6 shadow-[0_12px_30px_rgba(75,50,24,0.08)]">
        <h3 className="font-sans text-lg font-bold text-[#0D2E18]">Hourly Order Volume</h3>
        <p className="mt-1 font-sans text-sm text-[#8C7A64]">Distribution across operating hours (5PM–12AM)</p>
        
        <div className="mt-6 rounded-[20px] border border-[#D8C8AA]/40 bg-white/50 backdrop-blur-sm px-4 py-6">
          <div className="flex min-w-0 items-end gap-3 overflow-x-auto pb-3 sm:gap-4">
            {hourlyCounts.map((item) => (
              <div
                key={item.label}
                className="flex min-w-[54px] flex-col items-center gap-2 sm:min-w-[68px]"
              >
                <p
                  className={`font-sans text-sm font-semibold tabular-nums ${
                    item.orders === 0 ? "text-[#0D2E18]/35" : "text-[#0D2E18]"
                  }`}
                >
                  {item.orders}
                </p>
                <div className="flex h-[120px] items-end">
                  <div
                    className="w-10 rounded-t-[12px] transition hover:opacity-90 sm:w-12"
                    style={{
                      backgroundColor:
                        item.orders >= maxHourlyOrders * 0.8
                          ? "#0D2E18"
                          : item.orders >= maxHourlyOrders * 0.5
                            ? "#4A6B4D"
                            : item.orders >= maxHourlyOrders * 0.2
                              ? "#B8956A"
                              : "rgba(13,46,24,0.15)",
                      height: `${Math.max(10, (item.orders / maxHourlyOrders) * 108)}px`,
                    }}
                  />
                </div>
                <p className="font-sans text-xs font-semibold text-[#8C7A64]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Table */}
      <section className="rounded-[24px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] p-6 shadow-[0_12px_30px_rgba(75,50,24,0.08)]">
        <h3 className="font-sans text-lg font-bold text-[#0D2E18]">Hourly Breakdown</h3>
        <p className="mt-1 font-sans text-sm text-[#8C7A64]">Order counts and trend analysis by time period</p>
        
        <div className="mt-4 overflow-x-auto rounded-[16px] border border-[#D8C8AA]/40 bg-white/50 backdrop-blur-sm">
          <div className="min-w-[400px]">
            <div className="grid grid-cols-3 gap-4 border-b border-[#D8C8AA]/40 bg-white/60 px-5 py-3 font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#8C6C48]">
              <span>Hour</span>
              <span>Orders</span>
              <span>Trend</span>
            </div>
            <div className="divide-y divide-[#D8C8AA]/40">
              {hourlyCounts.map((item, index, list) => {
                const previous = list[index - 1]?.orders ?? item.orders;
                const isUp = item.orders >= previous;
                return (
                  <div
                    key={item.label}
                    className={`grid grid-cols-3 gap-4 px-5 py-3 font-sans text-sm transition hover:bg-white/40 ${
                      index % 2 === 0 ? "bg-white/30" : ""
                    }`}
                  >
                    <span className="font-semibold text-[#0D2E18]">{item.label}</span>
                    <span className="font-bold tabular-nums text-[#0D2E18]">
                      {item.orders}
                    </span>
                    <span className={`font-semibold ${isUp ? "text-[#0D2E18]" : "text-[#8C7A64]"}`}>
                      {isUp ? "↑ Up" : "↓ Down"}
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
      <section className="rounded-2xl border border-[#D8C8AA]/40 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] p-8 shadow-[0_12px_40px_rgba(75,50,24,0.1)] transition-all hover:shadow-[0_20px_60px_rgba(75,50,24,0.15)]">
        <div className="space-y-3">
          {/* Title with Icon */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Flame size={20} className="text-[#B8956A]" />
                <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8C6C48]">
                  Peak Hour Intelligence
                </p>
              </div>
              <h3 className="font-sans text-2xl font-bold text-[#0D2E18]">
                Track the busiest operating hours
              </h3>
              <p className="font-sans text-sm text-[#8C7A64] max-w-2xl">
                Monitor demand patterns between 5PM–12AM to optimize staffing and inventory planning.
              </p>
            </div>
            <span className="whitespace-nowrap rounded-full border border-[#FFE0BA] bg-[#FFF0DA]/60 px-4 py-2 font-sans text-xs font-semibold text-[#684B35]">
              <Clock size={12} className="inline mr-1" />
              Store Hours: 5PM–12AM
            </span>
          </div>
        </div>
      </section>

      {/* Peak Insights Cards */}
      {peakHourWindows.length > 0 && (
        <div>
          <h4 className="mb-3 font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#8C6C48]">
            Quick Intelligence
          </h4>
          <PeakInsights peakHourWindows={peakHourWindows} />
        </div>
      )}

      {/* Modern Heatmap Section */}
      <section className="rounded-2xl border border-[#D8C8AA]/40 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] p-8 shadow-[0_12px_40px_rgba(75,50,24,0.1)]">
        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#8C6C48]" />
            <h4 className="font-sans text-lg font-bold text-[#0D2E18]">
              Hourly Traffic Heatmap
            </h4>
          </div>
          <p className="font-sans text-sm text-[#8C7A64]">
            Visualize demand intensity across all days and hours. Darker cells indicate higher traffic periods.
          </p>
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
        <section className="rounded-2xl border border-[#D8C8AA]/40 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] p-8 shadow-[0_12px_40px_rgba(75,50,24,0.1)]">
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#8C6C48]" />
              <h4 className="font-sans text-lg font-bold text-[#0D2E18]">
                Busiest Service Hours
              </h4>
            </div>
            <p className="font-sans text-sm text-[#8C7A64]">
              Top 5 peak windows ranked by average order volume. Plan staffing around these times.
            </p>
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
                    return { bg: "#4A6B4D", text: "white", badge: "bg-[#4A6B4D]/10 text-[#4A6B4D]" };
                  case "Medium":
                    return { bg: "#8C6C48", text: "white", badge: "bg-[#8C6C48]/10 text-[#8C6C48]" };
                  default:
                    return { bg: "#B8956A", text: "white", badge: "bg-[#B8956A]/10 text-[#B8956A]" };
                }
              };

              const style = getIntensityStyle(peak.intensity);

              return (
                <div
                  key={`${peak.day_of_week}-${peak.hour_start}`}
                  className="group rounded-xl border border-[#D8C8AA]/40 bg-white/60 p-5 transition-all hover:border-[#D8C8AA]/70 hover:bg-white hover:shadow-[0_8px_24px_rgba(75,50,24,0.12)]"
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
                      <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8C6C48]">
                        {getDayLabel(Number(peak.day_of_week))} • {hourLabel}
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
                    <div className="relative h-1.5 rounded-full bg-[#E8D9BE]/40 overflow-hidden">
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

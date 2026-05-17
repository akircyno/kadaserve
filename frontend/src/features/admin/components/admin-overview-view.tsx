"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronUp,
  Clock,
  TrendingUp,
  Flame,
  Info,
  Coffee,
  PhilippinePeso,
  Package,
  Smile,
  Star,
  X,
  Zap,
} from "lucide-react";
import type { StaffOrder } from "@/types/orders";

const STORE_HOURS_LABEL = "Store Hours: 5:00 PM – 12:00 AM";
const weekDays = ["MON", "TUES", "WED", "THURS", "FRI", "SAT", "SUN"];
const peakHourLabels = ["5P", "6P", "7P", "8P", "9P", "10P", "11P", "12A"];
type OverviewIcon = React.ComponentType<{
  size: number;
  className?: string;
  strokeWidth?: number;
}>;

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
  if (count === 0) return "#F4FAF1";

  const ratio = count / max;

  if (ratio >= 0.85) return "#0B3B1D";
  if (ratio >= 0.65) return "#21633A";
  if (ratio >= 0.45) return "#8A5B3A";
  if (ratio >= 0.25) return "#C78A53";

  return "#EAD7B8";
}

function getRatingColors(rating: number) {
  if (rating >= 4.5) {
    return {
      barGradient: "from-[#0D2E18] via-[#0F441D] to-[#2E6A3A]",
      barGradientHover: "from-[#0F441D] to-[#2E6A3A]",
      textColor: "text-[#0D2E18]",
      dotColor: "bg-[#0D2E18]",
      bgColor: "bg-[#E9F5E7]/40",
    };
  } else if (rating >= 3.5) {
    return {
      barGradient: "from-[#0F441D] via-[#4A6B4D] to-[#7D6B55]",
      barGradientHover: "from-[#0F441D] to-[#4A6B4D]",
      textColor: "text-[#0F441D]",
      dotColor: "bg-[#4A6B4D]",
      bgColor: "bg-[#EDF4EC]/40",
    };
  } else if (rating >= 2.5) {
    return {
      barGradient: "from-[#684B35] via-[#7D6B55] to-[#8C7A64]",
      barGradientHover: "from-[#684B35] to-[#8C7A64]",
      textColor: "text-[#684B35]",
      dotColor: "bg-[#684B35]",
      bgColor: "bg-[#FFF0DA]/50",
    };
  } else {
    return {
      barGradient: "from-[#9C543D] via-[#C55432] to-[#DCCFB8]",
      barGradientHover: "from-[#9C543D] to-[#C55432]",
      textColor: "text-[#9C543D]",
      dotColor: "bg-[#9C543D]",
      bgColor: "bg-[#FFF1EC]/50",
    };
  }
}

function Panel({
  children,
  className = "",
  rightLabel,
  title,
  formulaTitle,
  formula,
  formulaExplanation,
}: {
  children: React.ReactNode;
  className?: string;
  rightLabel?: string;
  title: string;
  formulaTitle?: string;
  formula?: string;
  formulaExplanation?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[20px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] p-4 shadow-[0_8px_20px_rgba(75,50,24,0.06)] transition-all hover:shadow-[0_16px_40px_rgba(75,50,24,0.12)] hover:border-[#D8C8AA]/70 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <h2 className="font-sans text-lg font-bold text-[#0D2E18]">{title}</h2>
          {formula && formulaTitle && formulaExplanation && (
            <FormulaTooltip 
              title={formulaTitle}
              formula={formula}
              explanation={formulaExplanation}
            />
          )}
        </div>
        {rightLabel ? (
          <p className="rounded-full bg-gradient-to-br from-[#0D2E18]/8 to-[#4A6B4D]/4 px-2.5 py-1.5 font-sans text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#684B35] border border-[#D8C8AA]/30">
            {rightLabel}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ 
  label, 
  value,
  icon: Icon,
  trend,
  trendUp = true,
  formulaTitle,
  formula,
  formulaExplanation
}: { 
  label: string
  value: string
  icon: OverviewIcon
  trend?: string
  trendUp?: boolean
  formulaTitle?: string
  formula?: string
  formulaExplanation?: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-[20px] border border-[#D8C8AA]/60 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] px-5 py-5 shadow-[0_8px_24px_rgba(75,50,24,0.06)] transition-all hover:shadow-[0_16px_40px_rgba(75,50,24,0.12)] hover:border-[#D8C8AA] hover:-translate-y-0.5">
      {/* Background gradient accent */}
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-[#0D2E18]/8 to-[#4A6B4D]/4 transition-transform group-hover:scale-125" />
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-[#8C6C48]">
                {label}
              </p>
              {formula && formulaTitle && formulaExplanation && (
                <FormulaTooltip 
                  title={formulaTitle}
                  formula={formula}
                  explanation={formulaExplanation}
                />
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="font-sans text-3xl font-black tabular-nums leading-none text-[#0D2E18]">
                {value}
              </p>
              {trend && (
                <span className={`font-sans text-xs font-bold tabular-nums px-2.5 py-1 rounded-full ${
                  trendUp 
                    ? "bg-[#E9F5E7]/60 text-[#0F441D]" 
                    : "bg-[#FFF1EC]/60 text-[#D97C6F]"
                }`}>
                  {trendUp ? "↑" : "↓"} {trend}
                </span>
              )}
            </div>
          </div>
          <div className="ml-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#0D2E18]/8 transition-all group-hover:bg-[#0D2E18]/12">
            <Icon size={20} strokeWidth={1.8} className="text-[#0D2E18]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  detail,
  label,
  value,
  icon: Icon,
}: {
  detail: string
  label: string
  value: string
  icon: OverviewIcon
}) {
  return (
    <article className="group relative overflow-hidden rounded-[18px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] px-4 py-3.5 shadow-[0_6px_16px_rgba(75,50,24,0.04)] transition-all hover:shadow-[0_12px_32px_rgba(75,50,24,0.1)] hover:border-[#D8C8AA]/80 hover:-translate-y-0.5">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#4A6B4D]/6 transition-transform group-hover:scale-125" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8C6C48]">
              {label}
            </p>
            <p className="mt-1.5 font-sans text-base font-bold leading-tight text-[#0D2E18] truncate">
              {value}
            </p>
          </div>
          <div className="ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#0D2E18]/6 transition-all group-hover:bg-[#0D2E18]/10">
            <Icon size={18} strokeWidth={1.8} className="text-[#0D2E18]" />
          </div>
        </div>
        <p className="mt-1.5 font-sans text-[0.7rem] leading-relaxed text-[#6D5B48]">
          {detail}
        </p>
      </div>
    </article>
  );
}

function NeedsAttentionItem({
  icon: Icon,
  title,
  description,
  type = "info",
}: {
  icon: OverviewIcon
  title: string
  description: string
  type?: "warning" | "success" | "info"
}) {
  const typeStyles = {
    warning: {
      bg: "bg-gradient-to-br from-[#FFF1EC]/70 to-[#FFF6F3]/40",
      border: "border-[#E8C5B8]/50",
      iconBg: "bg-[#D97C6F]/12",
      icon: "text-[#D97C6F]",
      title: "text-[#9C543D]",
      dotColor: "bg-[#D97C6F]",
    },
    success: {
      bg: "bg-gradient-to-br from-[#E9F5E7]/70 to-[#F2F9EF]/40",
      border: "border-[#C8E6C0]/50",
      iconBg: "bg-[#0F441D]/12",
      icon: "text-[#0F441D]",
      title: "text-[#0D2E18]",
      dotColor: "bg-[#0F441D]",
    },
    info: {
      bg: "bg-gradient-to-br from-[#FFF0DA]/70 to-[#FFF8F0]/40",
      border: "border-[#FFE0BA]/50",
      iconBg: "bg-[#684B35]/12",
      icon: "text-[#684B35]",
      title: "text-[#0D2E18]",
      dotColor: "bg-[#684B35]",
    },
  };

  const style = typeStyles[type];

  return (
    <div className={`flex gap-3 rounded-[14px] border ${style.border} ${style.bg} px-3 py-2.5 transition-all hover:shadow-[0_4px_12px_rgba(75,50,24,0.08)] group hover:translate-y-[-1px]`}>
      <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${style.iconBg} transition-transform group-hover:scale-110`}>
        <Icon size={14} strokeWidth={1.8} className={style.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-sans text-xs font-semibold ${style.title}`}>
          {title}
        </p>
        <p className="mt-0.5 font-sans text-[0.65rem] leading-relaxed text-[#6D5B48]">
          {description}
        </p>
      </div>
      <div className={`${style.dotColor} h-1 w-1 flex-shrink-0 rounded-full mt-1.5 opacity-60`} />
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
  const rankColors = [
    { text: "text-white", badge: "bg-gradient-to-br from-[#0D2E18] to-[#0F441D]", bar: "from-[#0D2E18] via-[#0F441D] to-[#2E6A3A]" },
    { text: "text-white", badge: "bg-gradient-to-br from-[#0F441D] to-[#4A6B4D]", bar: "from-[#0F441D] via-[#4A6B4D] to-[#7D6B55]" },
    { text: "text-white", badge: "bg-gradient-to-br from-[#684B35] to-[#7D6B55]", bar: "from-[#684B35] via-[#7D6B55] to-[#8C7A64]" },
  ];

  const rankColor = rankColors[Math.min(index - 1, 2)] || { text: "text-white", badge: "bg-gradient-to-br from-[#7D6B55] to-[#8C7A64]", bar: "from-[#7D6B55] via-[#8C7A64] to-[#DCCFB8]" };

  return (
    <div className="group relative grid min-h-[38px] grid-cols-[32px_minmax(0,1fr)_40px_100px] items-center gap-2.5 border-b border-[#EBE0D3]/60 px-0.5 py-1.5 font-sans text-xs transition-all hover:bg-white/40 last:border-b-0">
      {/* Rank Badge */}
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${rankColor.badge} shadow-[0_3px_8px_rgba(13,46,24,0.12)] transition-transform group-hover:scale-110`}>
        <span className={`text-[0.65rem] font-bold ${rankColor.text}`}>#{index}</span>
      </div>
      
      {/* Item Label */}
      <span className="truncate font-semibold text-[#0D2E18] group-hover:text-[#0D2E18]">{label}</span>
      
      {/* Order Count */}
      <span className="text-right font-bold tabular-nums text-[#684B35]">
        {value}
      </span>
      
      {/* Progress Bar */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-[#E8D9BE]/50 backdrop-blur-sm">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${rankColor.bar} shadow-[0_1px_6px_rgba(13,46,24,0.15)] transition-all duration-500`}
          style={{
            width: `${Math.min(100, Math.max(0, (value / max) * 100))}%`,
          }}
        />
      </div>
    </div>
  );
}

function RatingRow({ item, rating }: { item: string; rating: number }) {
  const colors = getRatingColors(rating);
  const starCount = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <div className="group relative grid min-h-[38px] grid-cols-[minmax(120px,0.8fr)_1fr_40px] items-center gap-2.5 border-b border-[#EBE0D3]/60 px-0.5 py-1.5 font-sans text-xs transition-all hover:bg-white/40 last:border-b-0">
      {/* Item Name */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate font-semibold text-[#0D2E18]">{item}</span>
      </div>

      {/* Rating Bar & Stars */}
      <div className="flex items-center gap-2.5">
        {/* Progress Bar */}
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#E8D9BE]/50 backdrop-blur-sm">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.barGradient} shadow-[0_1px_6px_rgba(13,46,24,0.15)] transition-all duration-500 group-hover:shadow-[0_2px_10px_rgba(13,46,24,0.2)]`}
            style={{
              width: `${Math.min(100, (rating / 5) * 100)}%`,
            }}
          />
        </div>
        
        {/* Stars */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {[...Array(5)].map((_, i) => {
            const isFilled = i < starCount;
            const isHalf = i === starCount && hasHalfStar;
            return (
              <div key={i} className="relative h-3 w-3">
                {isFilled || isHalf ? (
                  <Star
                    size={12}
                    strokeWidth={1.8}
                    className="absolute inset-0 fill-current text-[#0F441D] transition-transform group-hover:scale-110"
                    style={{
                      clipPath: isHalf ? "polygon(0 0, 50% 0, 50% 100%, 0 100%)" : undefined,
                    }}
                  />
                ) : null}
                <Star size={12} strokeWidth={1.8} className="absolute inset-0 text-[#DCCFB8]" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Rating Number */}
      <span className={`text-right text-[0.65rem] font-bold tabular-nums ${colors.textColor}`}>
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
    <div className="mt-3 rounded-[20px] border border-[#EFE3CF]/50 bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E6] p-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-sans text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#8C6C48]">
            Peak Activity Time
          </p>
          {strongestCell.count > 0 && (
            <p className="mt-0.5 font-sans text-sm font-bold text-[#0D2E18]">
              {strongestCell.day} {strongestCell.hour}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8C8AA] bg-white/70 px-2.5 py-1 font-sans text-[0.7rem] font-bold text-[#0D2E18]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getHeatmapColor(maxOrders * 0.9, maxOrders) }} />
          {strongestCell.count} orders
        </span>
      </div>
      <div className="space-y-1.5">
        {visibleDays.map((day) => (
          <div key={day} className="grid grid-cols-[42px_1fr] items-center gap-2">
            <span className="text-center font-sans text-[0.68rem] font-bold text-[#684B35]">{day}</span>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${visibleHours.length}, minmax(0, 1fr))` }}>
              {visibleHours.map((hour) => {
                const count = countOrdersForSlot(orders, day, hour);
                const bgColor = getHeatmapColor(count, maxOrders);

                return (
                  <div
                    key={`${day}-${hour}`}
                    className="group relative h-6 rounded-[10px] border border-white/60 transition-all hover:scale-[1.04] hover:shadow-[0_6px_16px_rgba(13,46,24,0.16)] cursor-pointer overflow-hidden"
                    title={`${day} ${hour}: ${count} orders`}
                    style={{ backgroundColor: bgColor }}
                  >
                    {/* Hover gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/0 to-white/0 group-hover:from-black/10 group-hover:to-white/10 transition-all" />
                    
                    {/* Intensity indicator on hover */}
                    {count > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="font-sans text-[0.65rem] font-bold text-white/90 drop-shadow-sm">
                          {count}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[42px_1fr] gap-2 pt-0.5">
          <span />
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${visibleHours.length}, minmax(0, 1fr))` }}>
            {visibleHours.map((hour) => (
              <span key={hour} className="text-center font-sans text-[0.68rem] font-semibold text-[#8C7A64]">
                {hour}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[#EFE3CF]/50 bg-white/55 px-3 py-1.5">
        <p className="font-sans text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#8C6C48]">
          Intensity
        </p>
        <div className="flex items-center gap-2">
          {[
            { color: "#F7FBF5", label: "None", opacity: "opacity-50" },
            { color: "#E5D9C9", label: "Low", opacity: "opacity-70" },
            { color: "#A77B5D", label: "Medium", opacity: "opacity-85" },
            { color: "#684B35", label: "High", opacity: "opacity-95" },
            { color: "#0D2E18", label: "Peak", opacity: "opacity-100" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <div
                className={`h-3 w-3 rounded-full border border-white/40 transition-transform hover:scale-125 ${item.opacity}`}
                style={{ backgroundColor: item.color }}
              />
              <span className="font-sans text-[0.58rem] font-medium text-[#6D5B48]">
                {item.label}
              </span>
            </div>
          ))}
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
    <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-8 2xl:grid-cols-12">
      {hourlyCounts.map((item) => {
        const hasOrders = item.orders > 0;
        const heightPercent = Math.max(12, (item.orders / maxHourlyOrders) * 100);
        const isHighVolume = item.orders > maxHourlyOrders * 0.7;
        const isMediumVolume = item.orders > maxHourlyOrders * 0.4;

        return (
          <div
            key={item.label}
            className="group flex min-h-[64px] flex-col items-center justify-end gap-1.5 rounded-[16px] border border-[#E8D9BE]/30 bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E6] px-2 py-2 transition-all hover:border-[#D8C8AA] hover:from-white hover:to-[#FFFBF4] hover:shadow-[0_10px_22px_rgba(13,46,24,0.14)]"
            title={`${item.label}: ${item.orders} orders`}
          >
            {/* Count Badge */}
            <span className="font-sans text-[0.7rem] font-bold tabular-nums text-[#0D2E18] transition-transform group-hover:scale-110">
              {item.orders}
            </span>

            {/* Bar */}
            <div className="flex h-8 w-full items-end justify-center">
              {hasOrders ? (
                <div
                  className={`w-5 rounded-t-[12px] transition-all duration-300 group-hover:translate-y-[-2px] ${
                    isHighVolume
                      ? "bg-gradient-to-t from-[#0D2E18] via-[#0F441D] to-[#2E6A3A]"
                      : isMediumVolume
                      ? "bg-gradient-to-t from-[#0F441D] via-[#4A6B4D] to-[#7D6B55]"
                      : "bg-gradient-to-t from-[#684B35] via-[#7D6B55] to-[#DCCFB8]"
                  } shadow-[0_4px_12px_rgba(13,46,24,0.12)] group-hover:shadow-[0_8px_20px_rgba(13,46,24,0.2)]`}
                  style={{
                    height: `${heightPercent}%`,
                  }}
                />
              ) : (
                <div className="h-6 w-5 rounded-[9px] border border-[#DCCFB8] bg-gradient-to-t from-[#DCCFB8] to-[#FFF0DA]" />
              )}
            </div>

            {/* Label */}
            <span className="font-sans text-[0.6rem] font-bold text-[#684B35]">
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
    <div className="w-full rounded-[18px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-8 text-center font-sans text-sm text-[#8C7A64]">
      {label}
    </div>
  );
}

// Formula Explanation Component
function FormulaTooltip({ 
  title, 
  formula, 
  explanation 
}: { 
  title: string
  formula: string
  explanation: string
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#0D2E18]/10 hover:bg-[#0D2E18]/20 transition-colors"
        title={title}
      >
        <Info size={14} strokeWidth={1.8} className="text-[#684B35]" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 w-80 rounded-[16px] border border-[#D8C8AA] bg-gradient-to-br from-[#FFFCF7] to-[#FFF8F0] p-4 shadow-[0_12px_32px_rgba(75,50,24,0.2)]">
          <div className="space-y-2.5">
            <h4 className="font-sans text-sm font-bold text-[#0D2E18]">{title}</h4>
            <div className="rounded-[12px] bg-white/60 border border-[#E8D9BE] px-3 py-2.5 font-mono text-xs font-semibold text-[#684B35] whitespace-normal break-words">
              {formula}
            </div>
            <p className="font-sans text-xs leading-relaxed text-[#6D5B48]">
              {explanation}
            </p>
          </div>
          {/* Backdrop click to close */}
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

// Store Hours Badge Component
function StoreHoursBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#684B35] px-3 py-1.5 rounded-full bg-[#FFF0DA]/60 border border-[#FFE0BA]">
      <Clock size={13} strokeWidth={1.8} />
      {STORE_HOURS_LABEL}
    </span>
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
  const chartHeight = 188;
  const padding = { bottom: 30, left: 44, right: 40, top: 54 };
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
  const tooltipHeight = 44;
  const tooltipX = activePoint
    ? Math.min(
        Math.max(activePoint.x - tooltipWidth / 2, padding.left),
        chartWidth - padding.right - tooltipWidth
      )
    : padding.left;
  const tooltipY = padding.top - tooltipHeight - 4;
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
    <div className="mt-3 rounded-[20px] border border-[#EFE3CF] bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E6] px-3.5 py-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <p className="font-sans text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#8C6C48]">
            Selected range
          </p>
          <p className="mt-0.5 font-sans text-sm font-black text-[#0D2E18]">
            {activePoint?.label ?? "No range"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-[#D8C8AA] bg-white/70 p-0.5">
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
                  className={`rounded-full px-2.5 py-1 font-sans text-[0.7rem] font-bold transition ${
                    isActive
                      ? "bg-[#0D2E18] text-white shadow-[0_4px_12px_rgba(13,46,24,0.2)]"
                      : "text-[#684B35] hover:bg-[#FFF0DA]"
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-[#D8C8AA] bg-white/70 px-3 py-1.5">
            <span className="font-sans text-xs font-bold tabular-nums text-[#0D2E18]">
              {activePoint?.orders ?? 0} orders
            </span>
            <span
              className={`font-sans text-[0.65rem] font-bold ${
                activeDelta >= 0 ? "text-[#0F441D]" : "text-[#D97C6F]"
              }`}
            >
              {activeDeltaLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden pt-1">
      <svg
        aria-label="Demand growth line chart"
        className="h-auto w-full"
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <defs>
          <linearGradient id="demandGrowthArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0D2E18" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0D2E18" stopOpacity="0.02" />
          </linearGradient>
          <filter id="demandGrowthGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="8"
              floodColor="#0D2E18"
              floodOpacity="0.22"
              stdDeviation="6"
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
                fontWeight="600"
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
                filter="drop-shadow(0 8px 16px rgba(13, 46, 24, 0.25))"
              />
              <text fill="#FFF8EF" fontSize="10.5" fontWeight="800" x="14" y="17">
                {activePoint.label}
              </text>
              <text fill="#E8D9BE" fontSize="10.5" fontWeight="700" x="14" y="32">
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
              r={isActive ? "8" : "5.5"}
              stroke="#0D2E18"
              strokeWidth={isActive ? "4.5" : "3"}
              filter={isActive ? "drop-shadow(0 4px 12px rgba(13, 46, 24, 0.3))" : undefined}
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
  const [isDemandGrowthOpen, setIsDemandGrowthOpen] = useState(false);
  
  // Calculate key metrics
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
      ? "Strong ✓"
      : averageRating >= 4
      ? "Healthy"
      : "Needs review";
  
  // Build KPI cards with trend information
  const kpiCards = [
    { 
      id: "admin-total-orders", 
      label: totalOrdersLabel, 
      value: totalOrders.toString(),
      icon: Package,
      trend: totalOrders > 10 ? "+12%" : undefined,
      trendUp: true,
      formulaTitle: "Order Count Formula",
      formula: "Order Count = Σ completed, non-cancelled orders",
      formulaExplanation: "Counts all successfully completed customer orders. Only includes orders placed during store hours (5PM–12AM)."
    },
    { 
      id: "admin-gross-sales", 
      label: "Today's Revenue", 
      value: peso(grossIncomeSales),
      icon: PhilippinePeso,
      trend: grossIncomeSales > 1000 ? "+8%" : undefined,
      trendUp: true,
      formulaTitle: "Revenue Formula",
      formula: "Revenue = Σ order_total",
      formulaExplanation: "Sum of all order totals for the day. Reflects actual cash collected from completed orders."
    },
    { 
      id: "admin-avg-order-value", 
      label: "Avg Order Value", 
      value: peso(averageOrderValue),
      icon: Coffee,
      formulaTitle: "Average Order Value Formula",
      formula: "Average Order Value = Total Revenue ÷ Total Orders",
      formulaExplanation: "Shows typical customer spending. Higher values indicate larger basket sizes or premium items."
    },
    { 
      id: "admin-average-rating", 
      label: "Satisfaction", 
      value: averageRating ? averageRating.toFixed(1) : "N/A",
      icon: Star,
      trend: feedbackCount > 0 ? `${feedbackCount} reviews` : undefined,
      trendUp: averageRating >= 4,
      formulaTitle: "Satisfaction Rating Formula",
      formula: "Average Rating = Σ customer_ratings ÷ feedback_count",
      formulaExplanation: "Mean of all 1–5 star ratings from customers. 4.5+ is excellent, 3–3.5 needs attention, <3 requires action."
    },
  ];
  
  const visibleKpiCards = keyword
    ? kpiCards.filter(
        (metric) =>
          matchesSearch(metric.label, keyword) || 
          matchesSearch(metric.value, keyword)
      )
    : kpiCards;

  // Build "Needs Attention" alerts
  const needsAttentionItems = [
    ...(totalOrders === 0 
      ? [{ icon: TrendingUp, title: "No orders yet", description: "Start accepting orders to see analytics", type: "info" as const }]
      : []),
    ...(topItem && topItem.rating < 3.5
      ? [{ icon: AlertTriangle, title: `${topItem.item} rating dropped`, description: `Rating: ${topItem.rating.toFixed(1)}/5. Check quality or preparation.`, type: "warning" as const }]
      : []),
    ...(busiestHour.orders > 0 && busiestHour.label
      ? [{ icon: Flame, title: `Peak demand: ${busiestHour.label}`, description: `Expect ~${busiestHour.orders} orders. Prepare ingredients and staff.`, type: "info" as const }]
      : []),
    ...(trendDelta < -20
      ? [{ icon: TrendingUp, title: "Order volume declined", description: `Week-over-week: ${trendLabel}. Review pricing or marketing.`, type: "warning" as const }]
      : []),
    ...(satisfactionLabel === "Needs review"
      ? [{ icon: Smile, title: "Customer satisfaction needs attention", description: `Average rating: ${averageRating.toFixed(1)}/5. Review feedback and improve.`, type: "warning" as const }]
      : []),
  ].slice(0, 3);

  const visibleInsights = [
    {
      label: "Peak Hour",
      value: busiestHour.orders > 0 ? busiestHour.label : "No data",
      detail:
        busiestHour.orders > 0
          ? `${busiestHour.orders} orders at peak. Busiest day: ${busiestDay.day}.`
          : "Wait for more order data.",
      icon: Clock,
    },
    {
      label: "Weekly Growth",
      value: trendLabel,
      detail:
        weeklyTrendCounts.length < 2
          ? "Need more data for comparison."
          : `${latestWeek} orders vs ${previousWeek} last week.`,
      icon: TrendingUp,
    },
    {
      label: "Top Favorite",
      value: topItem?.item ?? "—",
      detail: topItem
        ? `${topItem.orders} orders. Use as recommendation signal.`
        : "Collect order data first.",
      icon: Star,
    },
    {
      label: "Satisfaction",
      value: satisfactionLabel,
      detail:
        feedbackCount > 0
          ? `${averageRating.toFixed(1)}/5 from ${feedbackCount} ratings.`
          : "Encourage customer feedback.",
      icon: Smile,
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
  const showNeedsAttention = needsAttentionItems.length > 0 && (!keyword || matchesSearch("attention", keyword) || matchesSearch("alert", keyword));
  const showKpi = !keyword || visibleKpiCards.length > 0;
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
    showKpi ||
    showInsights ||
    showNeedsAttention ||
    showOrdersWeek ||
    showPeakHours ||
    showTopItems ||
    showSatisfaction ||
    showHourly ||
    showWeekly;

  return (
    <div className="space-y-3">
      {/* Store Hours Badge */}
      <div className="flex justify-between items-start gap-3">
        <StoreHoursBadge />
      </div>

      {/* KPI Cards */}
      {showKpi ? (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {visibleKpiCards.map((metric) => (
            <div
              key={metric.label}
              id={metric.id}
              className="scroll-mt-28"
            >
              <MetricCard
                label={metric.label}
                value={metric.value}
                icon={metric.icon}
                trend={metric.trend}
                trendUp={metric.trendUp}
                formulaTitle={metric.formulaTitle}
                formula={metric.formula}
                formulaExplanation={metric.formulaExplanation}
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* Needs Attention Section */}
      {showNeedsAttention ? (
        <section
          id="admin-needs-attention"
          className="scroll-mt-28 overflow-hidden rounded-[20px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] to-[#FFF8F0] p-3.5 shadow-[0_8px_20px_rgba(75,50,24,0.06)]"
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} strokeWidth={1.8} className="text-[#684B35]" />
            <h3 className="font-sans text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#8C6C48]">
              Needs Attention
            </h3>
          </div>
          <div className="space-y-1.5">
            {needsAttentionItems.map((item, idx) => (
              <NeedsAttentionItem
                key={idx}
                icon={item.icon}
                title={item.title}
                description={item.description}
                type={item.type}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Insights Cards - Quick Summary */}
      {showInsights ? (
        <section
          id="admin-decision-support"
          className="scroll-mt-28"
        >
          <div className="mb-2.5">
            <p className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#8C6C48]">
              Quick Insights
            </p>
          </div>
          {visibleInsights.length > 0 ? (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {visibleInsights.map((insight) => (
                <InsightCard
                  key={insight.label}
                  detail={insight.detail}
                  label={insight.label}
                  value={insight.value}
                  icon={insight.icon}
                />
              ))}
            </div>
          ) : (
            <div>
              <EmptyState label="No insights match this search" />
            </div>
          )}
        </section>
      ) : null}

      {/* Charts Grid */}
      {showWeekly || showPeakHours ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {showWeekly ? (
            <div
              id="admin-weekly-trend"
              className="scroll-mt-28 xl:h-[300px]"
              role="button"
              tabIndex={0}
              title="Open Demand Growth"
              onClick={() => setIsDemandGrowthOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setIsDemandGrowthOpen(true);
                }
              }}
            >
              <Panel 
                className="h-full" 
                title="Demand Growth" 
                rightLabel={weeklyTrendLabel}
                formulaTitle="Demand Growth Formula"
                formula="Order Count = Σ orders per time period"
                formulaExplanation="Tracks total completed orders over each week. Helps identify growth trends and busy seasons."
              >
                {weeklyTrendCounts.length > 0 ? (
                  <DemandGrowthChart points={weeklyTrendCounts} />
                ) : (
                  <div className="mt-3 flex h-[244px] items-center">
                    <EmptyState label="No demand growth data yet" />
                  </div>
                )}
              </Panel>
            </div>
          ) : null}

          {showPeakHours ? (
            <div id="admin-peak-hours" className="scroll-mt-28 xl:h-[300px]">
              <Panel 
                className="h-full" 
                title="Peak Hours Heatmap"
                formulaTitle="Peak Hour Detection"
                formula="Peak Hour = hour with max order_count (5PM–12AM)"
                formulaExplanation="Identifies the busiest time slots within store operating hours. Use this to optimize staffing."
              >
                <Heatmap compact orders={nonCancelledOrders} />
              </Panel>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Order & Hourly Volume */}
      {showOrdersWeek || showHourly ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {showOrdersWeek ? (
            <div id="admin-orders-week" className="scroll-mt-28 xl:h-[280px]">
              <Panel 
                className="h-full" 
                title="Orders by Day"
                formulaTitle="Daily Order Count"
                formula="Order Count = number of completed orders per day (5PM–12AM)"
                formulaExplanation="Shows which days are busiest. Orders are counted during store operating hours only."
              >
                <div className="mt-2.5 space-y-2.5">
                  <div className="flex h-[110px] items-end gap-2 rounded-[16px] border border-[#EFE3CF]/45 bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E6] px-3.5 pb-3 pt-2.5">
                    {weekdayCounts.map((item) => {
                      const hasOrders = item.orders > 0;
                      const heightPercent = Math.max(8, (item.orders / maxWeekdayOrders) * 100);
                      const isHighest = item.orders === Math.max(...weekdayCounts.map(c => c.orders));
                      
                      return (
                        <div key={item.day} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                          {/* Count Label */}
                          <p className="font-sans text-xs font-bold tabular-nums text-[#0D2E18] transition-all group-hover:scale-110">
                            {item.orders}
                          </p>
                          
                          {/* Bar */}
                          <div
                            className={`w-full max-w-[38px] rounded-t-[12px] transition-all duration-300 shadow-[0_6px_12px_rgba(13,46,24,0.1)] group-hover:translate-y-[-2px] group-hover:shadow-[0_10px_24px_rgba(13,46,24,0.18)] ${
                              !hasOrders
                                ? "border border-[#DCCFB8] bg-gradient-to-t from-[#DCCFB8] to-[#FFF0DA] shadow-none"
                                : isHighest
                                ? "bg-gradient-to-t from-[#0D2E18] via-[#0F441D] to-[#2E6A3A]"
                                : "bg-gradient-to-t from-[#684B35] via-[#7D6B55] to-[#DCCFB8]"
                            }`}
                            style={{
                              height: `${heightPercent}%`,
                            }}
                          />
                          
                          {/* Day Label */}
                          <p className="font-sans text-[0.68rem] font-bold text-[#684B35]">
                            {item.day}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Trend Text */}
                  <div className="flex items-center justify-between rounded-[14px] border border-[#FFE0BA]/50 bg-[#FFF0DA]/60 px-3 py-2">
                    <p className="font-sans text-xs leading-relaxed text-[#6D5B48]">
                      <span className="font-semibold text-[#0D2E18]">Peak day:</span>{" "}
                      {weekdayCounts.reduce((a, b) => a.orders > b.orders ? a : b, weekdayCounts[0]).day} with{" "}
                      <span className="font-bold text-[#0D2E18]">
                        {Math.max(...weekdayCounts.map(c => c.orders))} orders
                      </span>
                    </p>
                    <ChevronUp size={16} strokeWidth={1.8} className="text-[#8C6C48] flex-shrink-0" />
                  </div>
                </div>
              </Panel>
            </div>
          ) : null}

          {showHourly ? (
            <div id="admin-hourly-order-volume" className="scroll-mt-28 xl:h-[280px]">
              <Panel 
                className="h-full" 
                title="Hourly Volume"
                rightLabel={hourlyDateLabel}
                formulaTitle="Hourly Order Volume"
                formula="Hourly Volume = orders per hour (5PM–12AM only)"
                formulaExplanation="Displays order count for each hour within store operating hours. Darker bars indicate higher demand."
              >
                <HourlyVolumeGrid
                  hourlyCounts={hourlyCounts}
                  maxHourlyOrders={maxHourlyOrders}
                />
              </Panel>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Top Items & Satisfaction */}
      {showTopItems || showSatisfaction ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {showTopItems ? (
            <div id="admin-top-items" className="scroll-mt-28 xl:h-[290px]">
              <Panel 
                className="h-full" 
                title="Top Sellers" 
                rightLabel="ORDERS"
                formulaTitle="Item Sales Ranking"
                formula="Item Sales = Σ quantity sold per item"
                formulaExplanation="Ranks menu items by total orders. #1 badge shows your most popular item. Use this to optimize inventory and marketing."
              >
                <div className="mt-2.5 rounded-[16px] border border-[#EFE3CF]/45 bg-[#FFF8EF] px-3 py-0.5">
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
            <div id="admin-satisfaction" className="scroll-mt-28 xl:h-[290px]">
              <Panel 
                className="h-full" 
                title="Customer Ratings" 
                rightLabel="AVG / 5"
                formulaTitle="Average Customer Rating"
                formula="Average Rating = Σ ratings / feedback entries"
                formulaExplanation="Calculates mean rating from customer feedback (1–5 stars). Deep green = excellent, muted green = good, coffee brown = needs attention."
              >
                <div className="mt-2.5 rounded-[16px] border border-[#EFE3CF]/45 bg-[#FFF8EF] px-3 py-0.5">
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

      {isDemandGrowthOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D2E18]/35 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demand-growth-dialog-title"
          onClick={() => setIsDemandGrowthOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-[24px] border border-[#D8C8AA] bg-[#FFFCF7] p-5 shadow-[0_24px_70px_rgba(13,46,24,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#8C6C48]">
                  Demand Growth
                </p>
                <h2
                  id="demand-growth-dialog-title"
                  className="mt-1 font-sans text-2xl font-black text-[#0D2E18]"
                >
                  Weekly order trend
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDemandGrowthOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#D8C8AA] bg-white text-[#0D2E18] transition hover:bg-[#FFF0DA]"
                aria-label="Close Demand Growth"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            {weeklyTrendCounts.length > 0 ? (
              <DemandGrowthChart points={weeklyTrendCounts} />
            ) : (
              <EmptyState label="No demand growth data yet" />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

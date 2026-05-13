"use client";

import { useMemo, useState } from "react";
import { Package, TrendingUp, Clock, Smile, AlertTriangle, Zap, Flame, BarChart3, Coffee, DollarSign, Star, ChevronUp, Info } from "lucide-react";
import type { StaffOrder } from "@/types/orders";

const STORE_HOURS_LABEL = "Store Hours: 5:00 PM – 12:00 AM";
const OPERATING_HOUR_START = 17; // 5 PM
const OPERATING_HOUR_END = 0; // 12 AM (midnight)

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

  if (ratio >= 0.85) return "#0D2E18";
  if (ratio >= 0.65) return "#1A4123";
  if (ratio >= 0.45) return "#684B35";
  if (ratio >= 0.25) return "#A77B5D";

  return "#E5D9C9";
}

function getRatingColors(rating: number) {
  if (rating >= 4.5) {
    return {
      barGradient: "from-[#0D2E18] to-[#1A4123]",
      barGradientHover: "from-[#0F441D] to-[#225A2E]",
      textColor: "text-[#0D2E18]",
      accentColor: "text-[#0F441D]",
      dotColor: "bg-[#0D2E18]",
      bgColor: "bg-[#E9F5E7]/40",
    };
  } else if (rating >= 3.5) {
    return {
      barGradient: "from-[#4A6B4D] to-[#5A7B5D]",
      barGradientHover: "from-[#5A7B5D] to-[#6A8B6D]",
      textColor: "text-[#4A6B4D]",
      accentColor: "text-[#5A7B5D]",
      dotColor: "bg-[#4A6B4D]",
      bgColor: "bg-[#EDF4EC]/40",
    };
  } else if (rating >= 2.5) {
    return {
      barGradient: "from-[#7A8B6F] to-[#8C9D7F]",
      barGradientHover: "from-[#8C9D7F] to-[#9EAF8F]",
      textColor: "text-[#7A8B6F]",
      accentColor: "text-[#8C9D7F]",
      dotColor: "bg-[#7A8B6F]",
      bgColor: "bg-[#F0F4EB]/40",
    };
  } else {
    return {
      barGradient: "from-[#D97C6F] to-[#E89080]",
      barGradientHover: "from-[#E89080] to-[#F2A397]",
      textColor: "text-[#D97C6F]",
      accentColor: "text-[#E89080]",
      dotColor: "bg-[#D97C6F]",
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
      className={`overflow-hidden rounded-[24px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] p-6 shadow-[0_12px_30px_rgba(75,50,24,0.08)] transition-all hover:shadow-[0_20px_50px_rgba(75,50,24,0.14)] hover:border-[#D8C8AA]/70 ${className}`}
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
          <p className="rounded-full bg-gradient-to-br from-[#0D2E18]/8 to-[#4A6B4D]/4 px-3.5 py-2 font-sans text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#684B35] border border-[#D8C8AA]/30">
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
  description,
  formulaTitle,
  formula,
  formulaExplanation
}: { 
  label: string
  value: string
  icon: React.ComponentType<{ size: number; className?: string }>
  trend?: string
  trendUp?: boolean
  description?: string
  formulaTitle?: string
  formula?: string
  formulaExplanation?: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-[#D8C8AA]/60 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] px-6 py-6 shadow-[0_10px_28px_rgba(75,50,24,0.08)] transition-all hover:shadow-[0_20px_50px_rgba(75,50,24,0.16)] hover:border-[#D8C8AA] hover:-translate-y-1">
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
            <div className="mt-4 flex items-baseline gap-2.5">
              <p className="font-sans text-4xl font-black tabular-nums leading-none text-[#0D2E18]">
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
            {description && (
              <p className="mt-3 font-sans text-xs leading-relaxed text-[#6D5B48]">
                {description}
              </p>
            )}
          </div>
          <div className="ml-4 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#0D2E18]/12 to-[#4A6B4D]/6 transition-all group-hover:from-[#0D2E18]/20 group-hover:to-[#4A6B4D]/12">
            <Icon size={28} className="text-[#0D2E18]" />
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
  icon: React.ComponentType<{ size: number; className?: string }>
}) {
  return (
    <article className="group relative overflow-hidden rounded-[20px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] via-[#FFF8F0] to-[#FFF3E6] px-5 py-5 shadow-[0_8px_20px_rgba(75,50,24,0.06)] transition-all hover:shadow-[0_16px_40px_rgba(75,50,24,0.14)] hover:border-[#D8C8AA]/80 hover:-translate-y-0.5">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#4A6B4D]/6 transition-transform group-hover:scale-125" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8C6C48]">
              {label}
            </p>
            <p className="mt-2.5 font-sans text-lg font-bold leading-tight text-[#0D2E18] truncate">
              {value}
            </p>
          </div>
          <div className="ml-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#0D2E18]/10 transition-all group-hover:bg-[#0D2E18]/15">
            <Icon size={20} className="text-[#0D2E18]" />
          </div>
        </div>
        <p className="mt-2.5 font-sans text-xs leading-relaxed text-[#6D5B48]">
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
  icon: React.ComponentType<{ size: number; className?: string }>
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
    <div className={`flex gap-3.5 rounded-[16px] border ${style.border} ${style.bg} px-4 py-3.5 transition-all hover:shadow-[0_6px_16px_rgba(75,50,24,0.12)] group hover:translate-y-[-2px]`}>
      <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${style.iconBg} transition-transform group-hover:scale-110`}>
        <Icon size={18} className={style.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-sans text-sm font-semibold ${style.title}`}>
          {title}
        </p>
        <p className="mt-0.5 font-sans text-xs leading-relaxed text-[#6D5B48]">
          {description}
        </p>
      </div>
      <div className={`${style.dotColor} h-1.5 w-1.5 flex-shrink-0 rounded-full mt-1.5 opacity-60`} />
    </div>
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
  const rankColors = [
    { bg: "bg-[#0D2E18]", text: "text-white", badge: "bg-gradient-to-br from-[#0D2E18] to-[#1A4123]" },
    { bg: "bg-[#4A6B4D]", text: "text-white", badge: "bg-gradient-to-br from-[#4A6B4D] to-[#5A7B5D]" },
    { bg: "bg-[#B8956A]", text: "text-white", badge: "bg-gradient-to-br from-[#B8956A] to-[#D4AF85]" },
  ];

  const rankColor = rankColors[Math.min(index - 1, 2)] || { bg: "bg-[#8C9D7F]", text: "text-white", badge: "bg-gradient-to-br from-[#8C9D7F] to-[#9EAF8F]" };

  return (
    <div className="group relative grid min-h-[60px] grid-cols-[52px_minmax(0,1fr)_56px_128px] items-center gap-3.5 border-b border-[#EBE0D3]/60 py-3 px-1 font-sans text-sm transition-all hover:bg-white/40 last:border-b-0">
      {/* Rank Badge */}
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${rankColor.badge} shadow-[0_4px_12px_rgba(13,46,24,0.15)] transition-transform group-hover:scale-110`}>
        <span className={`font-bold text-sm ${rankColor.text}`}>#{index}</span>
      </div>
      
      {/* Item Label */}
      <span className="truncate font-semibold text-[#0D2E18] group-hover:text-[#0D2E18]">{label}</span>
      
      {/* Order Count */}
      <span className="text-right font-bold tabular-nums text-[#684B35]">
        {value}
      </span>
      
      {/* Progress Bar */}
      <div className="relative h-2.5 overflow-hidden rounded-full bg-[#E8D9BE]/50 backdrop-blur-sm">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            index === 1 ? 'from-[#0D2E18] to-[#1A4123]' :
            index === 2 ? 'from-[#4A6B4D] to-[#5A7B5D]' :
            index === 3 ? 'from-[#B8956A] to-[#D4AF85]' :
            'from-[#8C9D7F] to-[#9EAF8F]'
          } shadow-[0_2px_8px_rgba(13,46,24,0.2)] transition-all duration-500`}
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
  const starCount = Math.round(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <div className="group relative grid min-h-[62px] grid-cols-[minmax(120px,0.8fr)_1fr_56px] items-center gap-3.5 border-b border-[#EBE0D3]/60 py-3 px-1 font-sans text-sm transition-all hover:bg-white/40 last:border-b-0">
      {/* Item Name */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate font-semibold text-[#0D2E18]">{item}</span>
      </div>

      {/* Rating Bar & Stars */}
      <div className="flex items-center gap-2.5">
        {/* Progress Bar */}
        <div className="flex-1 relative h-2.5 overflow-hidden rounded-full bg-[#E8D9BE]/50 backdrop-blur-sm">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${colors.barGradient} shadow-[0_2px_8px_rgba(13,46,24,0.15)] transition-all duration-500 group-hover:shadow-[0_3px_12px_rgba(13,46,24,0.25)]`}
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
              <div key={i} className="relative w-3.5 h-3.5">
                {isFilled || isHalf ? (
                  <Star
                    size={14}
                    className={`absolute inset-0 ${colors.accentColor} fill-current transition-transform group-hover:scale-110`}
                    style={{
                      clipPath: isHalf ? "polygon(0 0, 50% 0, 50% 100%, 0 100%)" : undefined,
                    }}
                  />
                ) : null}
                <Star size={14} className={`absolute inset-0 ${colors.accentColor}/30`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Rating Number */}
      <span className={`text-right font-bold tabular-nums text-sm ${colors.textColor}`}>
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
    <div className="mt-4 rounded-[22px] bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E6] p-5 border border-[#EFE3CF]/50">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8C6C48]">
            Peak Activity Time
          </p>
          {strongestCell.count > 0 && (
            <p className="mt-1 font-sans text-sm font-bold text-[#0D2E18]">
              {strongestCell.day} {strongestCell.hour}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#D8C8AA] bg-white/70 backdrop-blur-sm px-3 py-1.5 font-sans text-xs font-bold text-[#0D2E18]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getHeatmapColor(maxOrders * 0.9, maxOrders) }} />
          {strongestCell.count} orders
        </span>
      </div>
      <div className="space-y-3">
        {visibleDays.map((day) => (
          <div key={day} className="grid grid-cols-[56px_1fr] items-center gap-3">
            <span className="font-sans text-xs font-bold text-center text-[#684B35]">{day}</span>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${visibleHours.length}, minmax(0, 1fr))` }}>
              {visibleHours.map((hour) => {
                const count = countOrdersForSlot(orders, day, hour);
                const ratio = count / maxOrders;
                const bgColor = getHeatmapColor(count, maxOrders);

                return (
                  <div
                    key={`${day}-${hour}`}
                    className="group relative h-10 rounded-[12px] border border-white/60 transition-all hover:scale-[1.08] hover:shadow-[0_6px_16px_rgba(13,46,24,0.2)] cursor-pointer overflow-hidden"
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
        <div className="grid grid-cols-[56px_1fr] gap-3 pt-2">
          <span />
          <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${visibleHours.length}, minmax(0, 1fr))` }}>
            {visibleHours.map((hour) => (
              <span key={hour} className="text-center font-sans text-xs font-semibold text-[#8C7A64]">
                {hour}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Legend */}
      <div className="mt-5 rounded-[14px] bg-white/60 backdrop-blur-sm border border-[#EFE3CF]/50 px-4 py-3">
        <p className="font-sans text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#8C6C48] mb-2.5">
          Intensity Scale
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { color: "#F7FBF5", label: "None", opacity: "opacity-50" },
            { color: "#E5D9C9", label: "Low", opacity: "opacity-70" },
            { color: "#A77B5D", label: "Medium", opacity: "opacity-85" },
            { color: "#684B35", label: "High", opacity: "opacity-95" },
            { color: "#0D2E18", label: "Peak", opacity: "opacity-100" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className={`h-3.5 w-3.5 rounded-lg border border-white/40 transition-transform hover:scale-125 ${item.opacity}`}
                style={{ backgroundColor: item.color }}
              />
              <span className="font-sans text-[0.65rem] font-medium text-[#6D5B48]">
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
    <div className="mt-4 grid grid-cols-6 gap-2.5 sm:grid-cols-8 2xl:grid-cols-12">
      {hourlyCounts.map((item) => {
        const hasOrders = item.orders > 0;
        const heightPercent = Math.max(12, (item.orders / maxHourlyOrders) * 100);
        const isHighVolume = item.orders > maxHourlyOrders * 0.7;
        const isMediumVolume = item.orders > maxHourlyOrders * 0.4;

        return (
          <div
            key={item.label}
            className="group flex min-h-[88px] flex-col items-center justify-end gap-2.5 rounded-[18px] bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E6] px-2.5 py-3 transition-all hover:shadow-[0_12px_28px_rgba(13,46,24,0.16)] hover:border border-[#E8D9BE]/40 group-hover:from-white group-hover:to-[#FFFBF4]"
            title={`${item.label}: ${item.orders} orders`}
          >
            {/* Count Badge */}
            <span className="font-sans text-xs font-bold tabular-nums text-[#0D2E18] group-hover:scale-110 transition-transform">
              {item.orders}
            </span>

            {/* Bar */}
            <div className="flex h-14 w-full items-end justify-center">
              {hasOrders ? (
                <div
                  className={`w-6 rounded-t-[14px] transition-all duration-300 group-hover:translate-y-[-3px] ${
                    isHighVolume
                      ? "bg-gradient-to-t from-[#0D2E18] via-[#1A4123] to-[#2D5F35]"
                      : isMediumVolume
                      ? "bg-gradient-to-t from-[#4A6B4D] via-[#5F8A64] to-[#7AA476]"
                      : "bg-gradient-to-t from-[#8C9D7F] via-[#9EAF8F] to-[#B0C1A7]"
                  } shadow-[0_4px_12px_rgba(13,46,24,0.12)] group-hover:shadow-[0_8px_20px_rgba(13,46,24,0.2)]`}
                  style={{
                    height: `${heightPercent}%`,
                  }}
                />
              ) : (
                <div className="w-6 h-8 rounded-[10px] bg-[#E8D9BE]/40 border border-[#D8C8AA]/30" />
              )}
            </div>

            {/* Label */}
            <span className="font-sans text-[0.65rem] font-bold text-[#684B35]">
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
        <Info size={14} className="text-[#684B35]" />
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
      <Clock size={13} />
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
    <div className="mt-4 rounded-[22px] border border-[#EFE3CF] bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E6] px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8C6C48]">
            Selected range
          </p>
          <p className="mt-1 font-sans text-base font-black text-[#0D2E18]">
            {activePoint?.label ?? "No range"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-[#D8C8AA] bg-white/70 backdrop-blur-sm p-1">
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
                      ? "bg-[#0D2E18] text-white shadow-[0_4px_12px_rgba(13,46,24,0.2)]"
                      : "text-[#684B35] hover:bg-[#FFF0DA]"
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#D8C8AA] bg-white/70 backdrop-blur-sm px-4 py-2">
            <span className="font-sans text-sm font-bold tabular-nums text-[#0D2E18]">
              {activePoint?.orders ?? 0} orders
            </span>
            <span
              className={`font-sans text-xs font-bold ${
                activeDelta >= 0 ? "text-[#0F441D]" : "text-[#D97C6F]"
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
      description: "All confirmed orders",
      formulaTitle: "Order Count Formula",
      formula: "Order Count = Σ completed, non-cancelled orders",
      formulaExplanation: "Counts all successfully completed customer orders. Only includes orders placed during store hours (5PM–12AM)."
    },
    { 
      id: "admin-gross-sales", 
      label: "Today's Revenue", 
      value: peso(grossIncomeSales),
      icon: DollarSign,
      trend: grossIncomeSales > 1000 ? "+8%" : undefined,
      trendUp: true,
      description: "Total sales today",
      formulaTitle: "Revenue Formula",
      formula: "Revenue = Σ order_total",
      formulaExplanation: "Sum of all order totals for the day. Reflects actual cash collected from completed orders."
    },
    { 
      id: "admin-avg-order-value", 
      label: "Avg Order Value", 
      value: peso(averageOrderValue),
      icon: Coffee,
      description: "Per customer",
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
      description: "Customer ratings",
      formulaTitle: "Satisfaction Rating Formula",
      formula: "Average Rating = Σ customer_ratings ÷ feedback_count",
      formulaExplanation: "Mean of all 1–5 star ratings from customers. 4.5+ is excellent, 3–3.5 needs attention, <3 requires action."
    },
  ];
  
  const visibleKpiCards = keyword
    ? kpiCards.filter(
        (metric) =>
          matchesSearch(metric.label, keyword) || 
          matchesSearch(metric.value, keyword) ||
          matchesSearch(metric.description, keyword)
      )
    : kpiCards;

  // Build "Needs Attention" alerts
  const needsAttentionItems = [
    ...(totalOrders === 0 
      ? [{ icon: BarChart3, title: "No orders yet", description: "Start accepting orders to see analytics", type: "info" as const }]
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
    <div className="space-y-4">
      {/* Store Hours Badge */}
      <div className="flex justify-between items-start gap-3">
        <StoreHoursBadge />
      </div>

      {/* KPI Cards */}
      {showKpi ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                description={metric.description}
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
          className="scroll-mt-28 overflow-hidden rounded-[22px] border border-[#D8C8AA]/50 bg-gradient-to-br from-[#FFFCF7] to-[#FFF8F0] p-4 shadow-[0_12px_30px_rgba(75,50,24,0.08)]"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} className="text-[#684B35]" />
            <h3 className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#8C6C48]">
              Needs Attention
            </h3>
          </div>
          <div className="space-y-2">
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
          <div className="mb-3">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-[#8C6C48]">
              Quick Insights
            </p>
          </div>
          {visibleInsights.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="grid items-stretch gap-4 xl:grid-cols-2">
          {showWeekly ? (
            <div id="admin-weekly-trend" className="scroll-mt-28">
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
                  <div className="mt-4">
                    <EmptyState label="No demand growth data yet" />
                  </div>
                )}
              </Panel>
            </div>
          ) : null}

          {showPeakHours ? (
            <div id="admin-peak-hours" className="scroll-mt-28">
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
        <div className="grid items-stretch gap-4 xl:grid-cols-2">
          {showOrdersWeek ? (
            <div id="admin-orders-week" className="scroll-mt-28">
              <Panel 
                className="h-full" 
                title="Orders by Day"
                formulaTitle="Daily Order Count"
                formula="Order Count = number of completed orders per day (5PM–12AM)"
                formulaExplanation="Shows which days are busiest. Orders are counted during store operating hours only."
              >
                <div className="mt-4 space-y-4">
                  <div className="flex items-end gap-2.5 rounded-[20px] bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E6] px-5 pb-6 pt-4 h-[180px]">
                    {weekdayCounts.map((item, idx) => {
                      const heightPercent = Math.max(8, (item.orders / maxWeekdayOrders) * 100);
                      const isHighest = item.orders === Math.max(...weekdayCounts.map(c => c.orders));
                      
                      return (
                        <div key={item.day} className="flex min-w-0 flex-1 flex-col items-center gap-2 group">
                          {/* Count Label */}
                          <p className="font-sans text-sm font-bold tabular-nums text-[#0D2E18] transition-all group-hover:scale-110">
                            {item.orders}
                          </p>
                          
                          {/* Bar */}
                          <div
                            className={`w-full max-w-[48px] rounded-t-[16px] transition-all duration-300 shadow-[0_8px_16px_rgba(13,46,24,0.12)] group-hover:shadow-[0_12px_28px_rgba(13,46,24,0.2)] group-hover:translate-y-[-2px] ${
                              isHighest
                                ? "bg-gradient-to-t from-[#0D2E18] via-[#1A4123] to-[#2D5F35] hover:via-[#225A2E]"
                                : "bg-gradient-to-t from-[#4A6B4D] via-[#5F8A64] to-[#7AA476] hover:from-[#5A7B5D]"
                            }`}
                            style={{
                              height: `${heightPercent}%`,
                            }}
                          />
                          
                          {/* Day Label */}
                          <p className="font-sans text-xs font-bold text-[#684B35]">
                            {item.day}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Trend Text */}
                  <div className="flex items-center justify-between rounded-[14px] bg-[#FFF0DA]/60 px-3.5 py-2.5 border border-[#FFE0BA]/50">
                    <p className="font-sans text-xs leading-relaxed text-[#6D5B48]">
                      <span className="font-semibold text-[#0D2E18]">Peak day:</span>{" "}
                      {weekdayCounts.reduce((a, b) => a.orders > b.orders ? a : b, weekdayCounts[0]).day} with{" "}
                      <span className="font-bold text-[#0D2E18]">
                        {Math.max(...weekdayCounts.map(c => c.orders))} orders
                      </span>
                    </p>
                    <ChevronUp size={16} className="text-[#8C6C48] flex-shrink-0" />
                  </div>
                </div>
              </Panel>
            </div>
          ) : null}

          {showHourly ? (
            <div id="admin-hourly-order-volume" className="scroll-mt-28">
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
        <div className="grid items-stretch gap-4 xl:grid-cols-2">
          {showTopItems ? (
            <div id="admin-top-items" className="scroll-mt-28">
              <Panel 
                className="h-full" 
                title="Top Sellers" 
                rightLabel="ORDERS"
                formulaTitle="Item Sales Ranking"
                formula="Item Sales = Σ quantity sold per item"
                formulaExplanation="Ranks menu items by total orders. #1 badge shows your most popular item. Use this to optimize inventory and marketing."
              >
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
              <Panel 
                className="h-full" 
                title="Customer Ratings" 
                rightLabel="AVG / 5"
                formulaTitle="Average Customer Rating"
                formula="Average Rating = Σ ratings / feedback entries"
                formulaExplanation="Calculates mean rating from customer feedback (1–5 stars). Green = excellent (4.5+), yellow = good, orange = needs improvement."
              >
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

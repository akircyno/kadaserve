"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
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
} from "lucide-react";

const STORE_HOURS_LABEL = "Store Hours: 5:00 PM – 12:00 AM";
type OverviewIcon = React.ComponentType<{
  size: number;
  className?: string;
  strokeWidth?: number;
}>;
type OrderTypeDistributionItem = {
  label: string;
  count: number;
};

function peso(value: number) {
  return `\u20B1${Math.round(value).toLocaleString("en-PH")}`;
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
  id,
  rightLabel,
  title,
  formulaTitle,
  formula,
  formulaExplanation,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  rightLabel?: string;
  title: string;
  formulaTitle?: string;
  formula?: string;
  formulaExplanation?: string;
}) {
  return (
    <section
      id={id}
      className={`overflow-hidden rounded-[18px] border border-[#D8C8AA]/55 bg-[#FFFCF7] p-4 shadow-[0_6px_16px_rgba(75,50,24,0.04)] transition-all hover:border-[#D8C8AA]/80 ${className}`}
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
  formulaExplanation,
  meterValue,
}: { 
  label: string
  value: string
  icon: OverviewIcon
  trend?: string
  trendUp?: boolean
  formulaTitle?: string
  formula?: string
  formulaExplanation?: string
  meterValue?: number
}) {
  return (
    <div className="group relative flex h-full min-h-[118px] flex-col justify-between overflow-hidden rounded-[18px] border border-[#D8C8AA]/60 bg-[#FFFCF7] px-5 py-5 shadow-[0_6px_16px_rgba(75,50,24,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#D8C8AA] hover:shadow-[0_12px_26px_rgba(75,50,24,0.08)]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Icon size={15} strokeWidth={1.9} className="text-[#0D2E18]" />
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
            {typeof meterValue === "number" ? (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E8D9BE]/70">
                <div
                  className="h-full rounded-full bg-[#0D2E18] transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, (meterValue / 5) * 100))}%` }}
                />
              </div>
            ) : (
              <div className="mt-3 h-1.5" aria-hidden="true" />
            )}
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
    <article className="grid gap-2 rounded-[14px] border border-[#EFE3CF] bg-[#FFF8EF] px-3 py-2.5 transition hover:border-[#D8C8AA] sm:grid-cols-[minmax(130px,0.72fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 items-center gap-2">
        <Icon size={15} strokeWidth={1.9} className="shrink-0 text-[#0D2E18]" />
        <p className="truncate font-sans text-xs font-black text-[#0D2E18]">
          {label}: <span className="font-black">{value}</span>
        </p>
      </div>
      <p className="min-w-0 truncate font-sans text-xs font-semibold text-[#6D5B48]">
        {detail}
      </p>
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
    <div className={`group flex gap-2.5 rounded-[13px] border ${style.border} ${style.bg} px-3 py-2 transition-all hover:border-[#D8C8AA]`}>
      <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${style.iconBg}`}>
        <Icon size={13} strokeWidth={1.9} className={style.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-sans text-xs font-bold ${style.title}`}>
          {title}
        </p>
        <p className="mt-0.5 font-sans text-[0.65rem] leading-relaxed text-[#6D5B48]">
          {description}
        </p>
      </div>
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

function HourlyDemandCurve({
  expanded = false,
  hourlyCounts,
  maxHourlyOrders,
}: {
  expanded?: boolean;
  hourlyCounts: Array<{ label: string; orders: number }>;
  maxHourlyOrders: number;
}) {
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, hourlyCounts.findIndex((item) => item.orders === maxHourlyOrders))
  );
  const width = expanded ? 920 : 800;
  const height = expanded ? 260 : 218;
  const padding = {
    bottom: expanded ? 46 : 42,
    left: 44,
    right: 30,
    top: expanded ? 26 : 22,
  };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const coordinates = hourlyCounts.map((point, index) => {
    const x =
      hourlyCounts.length === 1
        ? width / 2
        : padding.left + (innerWidth * index) / (hourlyCounts.length - 1);
    const y =
      padding.top +
      innerHeight -
      (point.orders / Math.max(1, maxHourlyOrders)) * innerHeight;

    return { ...point, x, y };
  });
  const safeActiveIndex = Math.min(
    Math.max(0, activeIndex),
    Math.max(0, coordinates.length - 1)
  );
  const activePoint = coordinates[safeActiveIndex] ?? coordinates[0];
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    coordinates.length > 0
      ? `${linePath} L ${coordinates.at(-1)?.x ?? padding.left} ${
          padding.top + innerHeight
        } L ${coordinates[0].x} ${padding.top + innerHeight} Z`
      : "";
  const yTicks = Array.from(new Set([maxHourlyOrders, Math.round(maxHourlyOrders / 2), 0]));

  return (
    <div className="mt-3 rounded-[18px] border border-[#EFE3CF]/60 bg-white px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#8C6C48]">
          {activePoint?.label ?? "Hour"}
        </span>
        <span className="rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-1 font-sans text-xs font-black text-[#0D2E18]">
          {activePoint?.orders ?? 0} orders
        </span>
      </div>

      <svg
        aria-label="Hourly demand curve"
        className={`${expanded ? "h-[300px]" : "h-[230px]"} w-full overflow-visible`}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {yTicks.map((tick) => {
          const y =
            padding.top +
            innerHeight -
            (tick / Math.max(1, maxHourlyOrders)) * innerHeight;

          return (
            <g key={tick}>
              <line
                stroke="#E8D9BE"
                strokeDasharray="7 10"
                strokeWidth="1"
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
              />
              <text
                fill="#8C6C48"
                fontSize="12"
                fontWeight="800"
                textAnchor="end"
                x={padding.left - 12}
                y={y + 4}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {areaPath ? <path d={areaPath} fill="rgba(13,46,24,0.08)" /> : null}
        {linePath ? (
          <path
            d={linePath}
            fill="none"
            stroke="#0D2E18"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5"
          />
        ) : null}

        {coordinates.map((point, index) => (
          <g key={point.label}>
            <line
              x1={point.x}
              x2={point.x}
              y1={point.y}
              y2={padding.top + innerHeight}
              stroke={index === safeActiveIndex ? "#D8C8AA" : "transparent"}
              strokeDasharray="6 8"
              strokeWidth="2"
            />
            <circle
              className="cursor-pointer transition"
              cx={point.x}
              cy={point.y}
              fill={index === safeActiveIndex ? "#FFF8EF" : "#FFFCF7"}
              onFocus={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
              r={index === safeActiveIndex ? 8 : 6}
              stroke="#0D2E18"
              strokeWidth={index === safeActiveIndex ? 5 : 3}
              tabIndex={0}
            />
            <text
              fill="#684B35"
              fontSize={expanded ? "13" : "11"}
              fontWeight="900"
              textAnchor="middle"
              x={point.x}
              y={height - 10}
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="kada-admin-content-enter w-full rounded-[18px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-8 text-center font-sans text-sm text-[#8C7A64]">
      {label}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={`h-[118px] rounded-[18px] border border-[#D8C8AA]/55 bg-[#FFFCF7] p-5 ${
              index === 3
                ? "kada-admin-card-right-enter"
                : "kada-admin-card-top-enter"
            }`}
            style={{ animationDelay: `${380 + index * 70}ms` }}
          >
            <div className="kada-admin-skeleton h-4 w-28 rounded-full" />
            <div className="kada-admin-skeleton mt-5 h-8 w-24 rounded-full" />
            <div className="kada-admin-skeleton mt-4 h-2 w-full rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="kada-admin-content-enter h-[360px] rounded-[18px] border border-[#D8C8AA]/55 bg-[#FFFCF7] p-4"
            style={{ animationDelay: `${560 + index * 90}ms` }}
          >
            <div className="kada-admin-skeleton h-5 w-36 rounded-full" />
            <div className="kada-admin-skeleton mt-6 h-[260px] rounded-[18px]" />
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="kada-admin-content-enter h-[180px] rounded-[18px] border border-[#D8C8AA]/55 bg-[#FFFCF7] p-4"
            style={{ animationDelay: `${720 + index * 90}ms` }}
          >
            <div className="kada-admin-skeleton h-5 w-32 rounded-full" />
            <div className="mt-5 space-y-3">
              <div className="kada-admin-skeleton h-9 rounded-[14px]" />
              <div className="kada-admin-skeleton h-9 rounded-[14px]" />
              <div className="kada-admin-skeleton h-9 rounded-[14px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrdersByDayBarChart({
  weekdayCounts,
}: {
  weekdayCounts: Array<{ day: string; orders: number }>;
}) {
  const maxOrders = Math.max(1, ...weekdayCounts.map((item) => item.orders));
  const totalOrders = weekdayCounts.reduce((sum, item) => sum + item.orders, 0);
  const averageOrders = weekdayCounts.length ? totalOrders / weekdayCounts.length : 0;
  const averageTop = 100 - Math.min(100, (averageOrders / maxOrders) * 100);
  const peakDay = weekdayCounts.reduce(
    (best, item) => (item.orders > best.orders ? item : best),
    weekdayCounts[0] ?? { day: "N/A", orders: 0 }
  );

  return (
    <div className="mt-3 space-y-3">
      <div className="relative h-[132px] overflow-hidden rounded-[16px] border border-[#EFE3CF]/60 bg-gradient-to-b from-[#FFF8F0] to-[#FFF3E6] px-4 pb-7 pt-5">
        <div className="pointer-events-none absolute inset-x-4 bottom-7 top-5">
          <div
            className="absolute left-0 right-0 border-t border-dashed border-[#9C7B55]/55"
            style={{ top: `${averageTop}%` }}
          >
            <span className="absolute -right-1 -translate-y-1/2 rounded-full border border-[#DCCFB8] bg-[#FFFCF7] px-2 py-0.5 font-sans text-[0.62rem] font-bold text-[#684B35] shadow-sm">
              Avg {averageOrders.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="relative z-10 flex h-full items-end gap-2">
          {weekdayCounts.map((item) => {
            const hasOrders = item.orders > 0;
            const isPeak = hasOrders && item.orders === peakDay.orders;
            const heightPercent = hasOrders
              ? Math.max(12, (item.orders / maxOrders) * 100)
              : 5;

            return (
              <div
                key={item.day}
                className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                title={`${item.day}: ${item.orders} orders`}
              >
                <p className="font-sans text-[0.7rem] font-black tabular-nums text-[#0D2E18] transition-transform group-hover:scale-110">
                  {item.orders}
                </p>
                <div
                  className={`w-full max-w-[42px] rounded-t-[12px] transition-all duration-300 group-hover:-translate-y-1 ${
                    isPeak
                      ? "bg-gradient-to-t from-[#0D2E18] via-[#0F441D] to-[#2E6A3A] shadow-[0_10px_22px_rgba(13,46,24,0.24)]"
                      : hasOrders
                        ? "bg-gradient-to-t from-[#684B35] via-[#8C7A64] to-[#DCCFB8] shadow-[0_8px_16px_rgba(104,75,53,0.16)]"
                        : "border border-[#DCCFB8] bg-[#FFF8EF]"
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
                <p className="font-sans text-[0.66rem] font-bold text-[#684B35]">
                  {item.day}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-[14px] border border-[#DCCFB8]/70 bg-[#FFF8EF] px-3 py-1.5">
          <p className="font-sans text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#8C6C48]">
            Peak Day
          </p>
          <p className="mt-1 font-sans text-sm font-black text-[#0D2E18]">
            {peakDay.orders > 0 ? `${peakDay.day} - ${peakDay.orders}` : "No orders"}
          </p>
        </div>
        <div className="rounded-[14px] border border-[#DCCFB8]/70 bg-[#FFF8EF] px-3 py-1.5">
          <p className="font-sans text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#8C6C48]">
            Daily Avg
          </p>
          <p className="mt-1 font-sans text-sm font-black text-[#0D2E18]">
            {averageOrders.toFixed(1)} orders
          </p>
        </div>
      </div>
    </div>
  );
}

function OrderTypeDistributionDonut({
  items,
}: {
  items: OrderTypeDistributionItem[];
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const colors: Record<string, string> = {
    Delivery: "#0D2E18",
    Pickup: "#8C6C48",
    "Walk-in": "#D0AC91",
  };
  const getColor = (label: string) => colors[label] ?? "#D0AC91";
  const segments = items.reduce<
    Array<{ dash: number; item: OrderTypeDistributionItem; offset: number }>
  >((accumulator, item) => {
    if (item.count === 0 || total === 0) return accumulator;

    const dash = (item.count / total) * circumference;
    const offset = accumulator.reduce((sum, segment) => sum + segment.dash, 0);

    return [...accumulator, { dash, item, offset }];
  }, []);

  if (total === 0) {
    return (
      <div className="mt-3 flex h-[188px] items-center">
        <EmptyState label="No order type data yet" />
      </div>
    );
  }

  return (
    <div className="mt-3 grid h-[188px] items-center gap-3 sm:grid-cols-[0.86fr_1.14fr]">
      <div className="flex justify-center">
        <div className="relative h-[126px] w-[126px]">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              fill="none"
              r={radius}
              stroke="#EFE3CF"
              strokeWidth="18"
            />
            {segments.map(({ dash, item, offset }) => (
              <circle
                key={item.label}
                cx="70"
                cy="70"
                fill="none"
                r={radius}
                stroke={getColor(item.label)}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                strokeWidth="18"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full">
            <p className="font-sans text-2xl font-black text-[#0D2E18]">{total}</p>
            <p className="font-sans text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#8C6C48]">
              Orders
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const percentage = total ? Math.round((item.count / total) * 100) : 0;

          return (
            <div
              key={item.label}
              className="rounded-[14px] border border-[#EFE3CF] bg-[#FFF8EF] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: getColor(item.label) }}
                  />
                  <span className="truncate font-sans text-xs font-black text-[#0D2E18]">
                    {item.label}
                  </span>
                </div>
                <span className="font-sans text-xs font-black tabular-nums text-[#684B35]">
                  {percentage}%
                </span>
              </div>
              <p className="mt-1 font-sans text-[0.68rem] font-semibold text-[#8C7A64]">
                {item.count} orders
              </p>
            </div>
          );
        })}
      </div>
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
  return (
    <span
      aria-label={`${title}. ${formula}. ${explanation}`}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0D2E18]/10 text-[#684B35]"
      title={`${title}: ${formula}. ${explanation}`}
    >
      <Info size={12} strokeWidth={1.9} />
    </span>
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
  monthlyRevenue,
  hourlyDateLabel,
  hourlyCounts,
  itemRanking,
  maxHourlyOrders,
  maxItemOrders,
  weeklyTrendCounts,
  weeklyTrendLabel,
  orderTypeDistribution,
  totalOrders,
  totalOrdersLabel = "Total Orders",
  search,
  weekdayCounts,
  isLoading = false,
  isRefreshing = false,
}: {
  averageRating: number;
  averageOrderValue: number;
  feedbackCount: number;
  monthlyRevenue: number;
  hourlyDateLabel: string;
  hourlyCounts: Array<{ label: string; orders: number }>;
  itemRanking: Array<{ item: string; orders: number; revenue: number; rating: number }>;
  maxHourlyOrders: number;
  maxItemOrders: number;
  weeklyTrendCounts: Array<{ label: string; orders: number }>;
  weeklyTrendLabel: string;
  orderTypeDistribution: OrderTypeDistributionItem[];
  totalOrders: number;
  totalOrdersLabel?: string;
  search?: string;
  weekdayCounts: Array<{ day: string; orders: number }>;
  isLoading?: boolean;
  isRefreshing?: boolean;
}) {
  const keyword = search?.trim().toLowerCase() ?? "";
  const [isDemandGrowthOpen, setIsDemandGrowthOpen] = useState(false);
  const [isHourlyDemandOpen, setIsHourlyDemandOpen] = useState(false);
  
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
      ? "No data"
      : averageRating >= 4.5
      ? "Strong ✓"
      : averageRating >= 4
      ? "Healthy"
      : "Needs review";
  
  // Build KPI cards with trend information
  const kpiCards = [
    {
      id: "admin-total-orders",
      label: "Monthly Orders",
      value: totalOrders.toString(),
      icon: Package,
      trend: totalOrders > 10 ? "+12%" : undefined,
      trendUp: true,
      formulaTitle: "Order Count Formula",
      formula: "Monthly Orders = valid orders this month",
      formulaExplanation: `Counts ${totalOrdersLabel.toLowerCase()} that are not cancelled or expired.`
    },
    {
      id: "admin-gross-sales",
      label: "Monthly Revenue",
      value: peso(monthlyRevenue),
      icon: PhilippinePeso,
      trend: monthlyRevenue > 1000 ? "+8%" : undefined,
      trendUp: true,
      formulaTitle: "Revenue Formula",
      formula: "Monthly Revenue = paid valid orders this month",
      formulaExplanation: "Adds paid orders this month. Cancelled, expired, and unpaid orders are not counted."
    },
    { 
      id: "admin-avg-order-value", 
      label: "Avg Order Value", 
      value: peso(averageOrderValue),
      icon: Coffee,
      formulaTitle: "Average Order Value Formula",
      formula: "Average Order Value = paid revenue ÷ paid orders",
      formulaExplanation: "Uses only paid valid orders, so unpaid, cancelled, and expired orders do not affect the average."
    },
    { 
      id: "admin-average-rating", 
      label: "Satisfaction", 
      value: averageRating ? `${averageRating.toFixed(1)}/5` : "N/A",
      icon: Star,
      trend: feedbackCount > 0 ? `${feedbackCount} reviews` : undefined,
      trendUp: averageRating >= 4,
      meterValue: averageRating,
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
        ? `${topItem.orders} orders. Good item to recommend.`
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
  const showOrderTypeDistribution =
    !keyword ||
    matchesSearch("Monthly Order Types", keyword) ||
    orderTypeDistribution.some((item) => matchesSearch(item.label, keyword));
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
    matchesSearch("Orders by Hour", keyword) ||
    hourlyCounts.some((item) => matchesSearch(item.label, keyword));
  const showWeekly =
    !keyword ||
    matchesSearch("Weekly Trend", keyword) ||
    matchesSearch("Weekly Trend", keyword) ||
    weeklyTrendCounts.some((item) => matchesSearch(item.label, keyword));
  const hasDashboardResults =
    showKpi ||
    showInsights ||
    showNeedsAttention ||
    showOrdersWeek ||
    showOrderTypeDistribution ||
    showTopItems ||
    showSatisfaction ||
    showHourly ||
    showWeekly;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="kada-admin-content-enter flex justify-between items-start gap-3">
          <StoreHoursBadge />
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${isRefreshing ? "kada-admin-refreshing" : ""}`}>
      {/* Store Hours Badge */}
      <div
        className="kada-admin-content-enter flex justify-between items-start gap-3"
        style={{ animationDelay: "520ms" }}
      >
        <StoreHoursBadge />
      </div>

      {/* KPI Cards */}
      {showKpi ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleKpiCards.map((metric, index) => (
            <div
              key={metric.label}
              id={metric.id}
              className={`h-full scroll-mt-28 ${
                metric.id === "admin-average-rating"
                  ? "kada-admin-card-right-enter"
                  : "kada-admin-card-top-enter"
              }`}
              style={{ animationDelay: `${380 + index * 70}ms` }}
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
                meterValue={metric.meterValue}
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* Charts Grid */}
      {showWeekly || showHourly ? (
        <div
          className="kada-admin-content-enter grid gap-3 xl:grid-cols-2"
          style={{ animationDelay: "560ms" }}
        >
          {showWeekly ? (
            <div
              id="admin-weekly-trend"
              className="scroll-mt-28 xl:h-[360px]"
              role="button"
              tabIndex={0}
              title="Open Weekly Trend"
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
                title="Weekly Trend"
                rightLabel={weeklyTrendLabel}
                formulaTitle="Weekly Trend"
                formula="Order Count = Σ orders per time period"
                formulaExplanation="Shows order changes by week."
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

          {showHourly ? (
            <div
              id="admin-hourly-demand-curve"
              className="scroll-mt-28 xl:h-[360px]"
              role="button"
              tabIndex={0}
              title="Open Orders by Hour"
              onClick={() => setIsHourlyDemandOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setIsHourlyDemandOpen(true);
                }
              }}
            >
              <Panel 
                className="h-full" 
                title="Orders by Hour"
                rightLabel={hourlyDateLabel}
                formulaTitle="Orders by Hour"
                formula="Orders by Hour = order count for each hour"
                formulaExplanation="Shows which hours get more orders."
              >
                <HourlyDemandCurve
                  hourlyCounts={hourlyCounts}
                  maxHourlyOrders={maxHourlyOrders}
                />
              </Panel>
            </div>
          ) : null}
        </div>
      ) : null}

      {showInsights || showNeedsAttention ? (
        <div
          className="kada-admin-content-enter grid items-stretch gap-3 xl:grid-cols-2"
          style={{ animationDelay: "680ms" }}
        >
          {showInsights ? (
            <Panel
              id="admin-decision-support"
              className="scroll-mt-28 h-full"
              title="Insights"
            >
              {visibleInsights.length > 0 ? (
                <div className="mt-3 grid gap-2">
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
                <div className="mt-3">
                  <EmptyState label="No insights match this search" />
                </div>
              )}
            </Panel>
          ) : null}

          {showNeedsAttention ? (
            <Panel
              id="admin-needs-attention"
              className="scroll-mt-28 h-full"
              title="Needs Attention"
            >
              <div className="mt-3 space-y-2">
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
            </Panel>
          ) : null}
        </div>
      ) : null}

      {/* Monthly Orders by Day and Order Types */}
      {showOrdersWeek || showOrderTypeDistribution ? (
        <div
          className="kada-admin-content-enter grid gap-3 xl:grid-cols-2"
          style={{ animationDelay: "780ms" }}
        >
          {showOrdersWeek ? (
            <div id="admin-orders-week" className="scroll-mt-28 xl:h-[280px]">
              <Panel 
                className="h-full" 
                title="Monthly Orders by Day"
                formulaTitle="Orders by Day"
                formula="Orders by Day = monthly orders grouped by day"
                formulaExplanation="Shows which days get more orders this month."
              >
                <div className="mt-2.5 space-y-2.5">
                  <OrdersByDayBarChart weekdayCounts={weekdayCounts} />
                </div>
              </Panel>
            </div>
          ) : null}

          {showOrderTypeDistribution ? (
            <div
              id="admin-order-type-distribution"
              className="scroll-mt-28 xl:h-[280px]"
            >
              <Panel
                className="h-full"
                title="Monthly Order Types"
                formulaTitle="Order Types"
                formula="Order Type = delivery, pickup, or walk-in"
                formulaExplanation="Shows how customers ordered this month."
              >
                <OrderTypeDistributionDonut items={orderTypeDistribution} />
              </Panel>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Top Items & Satisfaction */}
      {showTopItems || showSatisfaction ? (
        <div
          className="kada-admin-content-enter grid gap-3 xl:grid-cols-2"
          style={{ animationDelay: "880ms" }}
        >
          {showTopItems ? (
            <div id="admin-top-items" className="scroll-mt-28 xl:h-[290px]">
              <Panel
                className="h-full"
                title="Monthly Top Sellers"
                rightLabel="ORDERS"
                formulaTitle="Top Sellers"
                formula="Item Sales = Σ quantity sold per item"
                formulaExplanation="Shows which menu items sold the most."
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
                formulaExplanation="Shows average customer rating from 1 to 5 stars."
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
            className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-[24px] border border-[#D8C8AA] bg-[#FFFCF7] p-6 shadow-[0_24px_70px_rgba(13,46,24,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#8C6C48]">
                  Weekly Trend
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
                aria-label="Close Weekly Trend"
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

      {isHourlyDemandOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D2E18]/35 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hourly-demand-dialog-title"
          onClick={() => setIsHourlyDemandOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-[24px] border border-[#D8C8AA] bg-[#FFFCF7] p-6 shadow-[0_24px_70px_rgba(13,46,24,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#8C6C48]">
                  Orders by Hour
                </p>
                <h2
                  id="hourly-demand-dialog-title"
                  className="mt-1 font-sans text-2xl font-black text-[#0D2E18]"
                >
                  Orders by hour
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsHourlyDemandOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#D8C8AA] bg-white text-[#0D2E18] transition hover:bg-[#FFF0DA]"
                aria-label="Close Orders by Hour"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <HourlyDemandCurve
              expanded
              hourlyCounts={hourlyCounts}
              maxHourlyOrders={maxHourlyOrders}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Flame,
  Info,
  Smile,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { buildItemActionInsights, type ItemActionInsightIcon } from "@/lib/item-action-insights";
import type { StoreOverrideStatus, StoreStatusPayload } from "@/lib/store-status";

type OverviewIcon = React.ComponentType<{
  size: number;
  className?: string;
  strokeWidth?: number;
}>;

const ITEM_ACTION_ICONS: Record<ItemActionInsightIcon, OverviewIcon> = {
  TrendingDown,
  Flame,
};

type OrderTypeDistributionItem = {
  label: string;
  count: number;
};

type StoreOverrideChoice = Extract<StoreOverrideStatus, "auto" | "open" | "closed">;

type DemandForecastResult = {
  forecast: Array<{ date: string; predictedOrders: number }>;
  diagnostics: {
    rSquared: number;
    rmse: number;
    mae: number;
    baselineRmse: number;
    baselineMae: number;
    durbinWatson: number;
    trainingDays: number;
    testDays: number;
  };
  coefficients: {
    intercept: number;
    trend: number;
    lagSameWeekday: number;
    dayOfWeek: Record<string, number>;
  };
  history: Array<{ date: string; orderCount: number }>;
} | null;

type ChartView = "chart" | "table";

// Chart colors. Orders, forecast and rating were checked as a colorblind-safe set on the card surface.
const COLORS = {
  orders: "#2E7A48",
  ordersHover: "#3A8C57",
  forecast: "#7A6BB8",
  rating: "#C47E2E",
  muted: "#DCCFB8",
  mutedHover: "#CBBB9F",
  stub: "#D5C7AE",
  grid: "#EFE7DA",
  axis: "#DCCFB9",
  surface: "#FFFCF7",
};

// Fixed order, so a channel keeps its color whatever the counts are.
const CHANNEL_COLORS: Record<string, string> = {
  Delivery: COLORS.orders,
  Pickup: COLORS.forecast,
  "Walk-in": COLORS.rating,
};

const FORECAST_HISTORY_DAYS = 21;
const SERVICE_OPEN_MINUTE = 17 * 60;
const SERVICE_CLOSE_MINUTE = 24 * 60;
const SERVICE_HOURS_SHORT = "Mon–Sat, 5 PM – 12 AM";
const MANILA_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_LABELS: Record<string, { short: string; long: string }> = {
  MON: { short: "Mon", long: "Monday" },
  TUES: { short: "Tue", long: "Tuesday" },
  WED: { short: "Wed", long: "Wednesday" },
  THURS: { short: "Thu", long: "Thursday" },
  FRI: { short: "Fri", long: "Friday" },
  SAT: { short: "Sat", long: "Saturday" },
  SUN: { short: "Sun", long: "Sunday" },
};

/* ---------- Formatting ---------- */

function peso(value: number) {
  return `₱${Math.round(value).toLocaleString("en-PH")}`;
}

function plural(count: number, word: string) {
  return `${count.toLocaleString("en-PH")} ${word}${count === 1 ? "" : "s"}`;
}

function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T00:00:00+08:00`));
}

function formatWeekdayShort(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
  }).format(new Date(`${dateKey}T00:00:00+08:00`));
}

// "5PM" -> "5 PM"
function formatHourLabel(label: string) {
  return label.replace(/^(\d{1,2})\s*(AM|PM)$/i, "$1 $2");
}

// "5PM" -> 17, "12AM" -> 0
function parseHourLabel(label: string) {
  const match = label.match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (!match) return null;
  const hour = Number(match[1]) % 12;
  return match[2].toUpperCase() === "PM" ? hour + 12 : hour;
}

function formatDuration(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;

  if (days) return `${days}d ${hours}h`;
  return hours ? `${hours}h ${String(rest).padStart(2, "0")}m` : `${rest}m`;
}

function formatTick(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/* ---------- Store hours (Asia/Manila) ---------- */

function getServiceClock(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const day = Math.max(0, MANILA_WEEKDAYS.indexOf(read("weekday")));
  const minutes = Number(read("hour")) * 60 + Number(read("minute"));
  const hour = Math.floor(minutes / 60);
  const isServiceDay = (weekday: number) => weekday >= 1 && weekday <= 6;

  if (isServiceDay(day) && minutes >= SERVICE_OPEN_MINUTE && minutes < SERVICE_CLOSE_MINUTE) {
    return { inHours: true, hour, minutesToChange: SERVICE_CLOSE_MINUTE - minutes, opensOn: null };
  }

  for (let offset = 0; offset <= 7; offset += 1) {
    const next = (day + offset) % 7;
    if (!isServiceDay(next) || (offset === 0 && minutes >= SERVICE_OPEN_MINUTE)) continue;

    return {
      inHours: false,
      hour,
      minutesToChange: offset * 1440 + SERVICE_OPEN_MINUTE - minutes,
      opensOn: offset === 0 ? "today" : offset === 1 ? "tomorrow" : WEEKDAY_NAMES[next],
    };
  }

  return { inHours: false, hour, minutesToChange: 0, opensOn: null };
}

/* ---------- Chart helpers ---------- */

// Round axis maximum with evenly spaced ticks.
function niceScale(max: number, integer = false) {
  const safeMax = Math.max(max, integer ? 1 : 0.1);
  const raw = safeMax / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => value >= raw) ?? magnitude * 10;
  if (integer) step = Math.max(1, Math.ceil(step));
  const top = Math.ceil(safeMax / step) * step;
  const ticks: number[] = [];

  for (let value = 0; value <= top + 1e-9; value += step) {
    ticks.push(Number(value.toFixed(4)));
  }

  return { top, ticks };
}

// Column with a rounded data-end and a square base.
function barPath(x: number, y: number, width: number, height: number, radius = 4) {
  const r = Math.min(radius, height, width / 2);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // ResizeObserver also reports the initial size, so charts draw at their real width.
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

/* ---------- Small pieces ---------- */

function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-data text-[11px] uppercase tracking-[0.07em] text-[#78837A] ${className}`}>
      {children}
    </p>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="w-full rounded-[14px] border border-dashed border-[#DCCFB8] bg-[#F6EEE2] px-4 py-8 text-center font-sans text-sm text-[#78837A]">
      {label}
    </div>
  );
}

type FormulaInfo = { title: string; formula: string; explanation: string };

function FormulaTooltip({
  title,
  formula,
  explanation,
  onDark = false,
}: FormulaInfo & { onDark?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const tooltipWidth = 288;
    const margin = 12;
    const left = Math.min(
      window.innerWidth - tooltipWidth - margin,
      Math.max(margin, rect.left + rect.width / 2 - tooltipWidth / 2)
    );

    setPosition({
      left,
      top: rect.bottom + 8,
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return;
      if (tooltipRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("mousedown", closeOnOutsideClick);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-label={`Show formula explanation for ${title}`}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 ${
          onDark
            ? "bg-[#FFF3DF]/10 text-[#FFF3DF]/70 hover:bg-[#FFF3DF]/20 hover:text-[#FFF3DF] focus-visible:ring-[#FFF3DF]/40"
            : "bg-[#102E1B]/[0.07] text-[#78837A] hover:bg-[#102E1B]/[0.12] hover:text-[#102E1B] focus-visible:ring-[#2E7A48]/30"
        }`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          updatePosition();
          setIsOpen((current) => !current);
        }}
        onFocus={updatePosition}
      >
        <Info size={12} strokeWidth={1.9} />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              className="fixed z-[9999] w-72 rounded-xl border border-[#EAE0CF] bg-[#FFFCF7] p-3 text-left font-sans shadow-[0_16px_34px_rgba(16,46,27,0.18)]"
              role="tooltip"
              style={{ left: position.left, top: position.top }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-xs font-bold text-[#102E1B]">{title}</p>
              <p className="mt-1 rounded-lg bg-[#F6EEE2] px-2 py-1.5 text-[0.7rem] font-semibold text-[#4A5A4E]">
                {formula}
              </p>
              <p className="mt-2 text-[0.72rem] leading-relaxed text-[#4A5A4E]">{explanation}</p>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function Card({
  id,
  title,
  sub,
  formula,
  tools,
  className = "",
  children,
}: {
  id?: string;
  title: string;
  sub?: ReactNode;
  formula?: FormulaInfo;
  tools?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`flex min-w-0 scroll-mt-28 flex-col gap-4 rounded-[18px] border border-[#EAE0CF] bg-[#FFFCF7] px-4 py-5 sm:px-[22px] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-sans text-base font-bold tracking-[-0.01em] text-[#102E1B]">{title}</h2>
            {formula ? <FormulaTooltip {...formula} /> : null}
          </div>
          {sub ? <p className="mt-0.5 font-sans text-[12.5px] text-[#78837A]">{sub}</p> : null}
        </div>
        {tools ? <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">{tools}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  onDark = false,
  disabled = false,
}: {
  label: string;
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  onDark?: boolean;
  disabled?: boolean;
}) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    if (!step) return;

    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    buttonsRef.current[next]?.focus();
    onChange(options[next].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex gap-0.5 rounded-full p-[3px] ${onDark ? "bg-[#FFF3DF]/10" : "bg-[#F6EEE2]"}`}
    >
      {options.map((option, index) => {
        const checked = option.value === value;

        return (
          <button
            key={String(option.value)}
            ref={(node) => {
              buttonsRef.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`whitespace-nowrap rounded-full font-sans font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
              onDark
                ? `px-4 py-[7px] text-[13px] focus-visible:outline-[#FFF3DF] ${
                    checked ? "bg-[#FFF3DF] text-[#083C1F]" : "text-[#FFF3DF]/70 hover:text-[#FFF3DF]"
                  }`
                : `px-3 py-[5px] text-[12.5px] focus-visible:outline-[#2E7A48] ${
                    checked
                      ? "bg-[#FFFCF7] text-[#102E1B] shadow-[0_1px_2px_rgba(16,46,27,0.14)]"
                      : "text-[#4A5A4E] hover:text-[#102E1B]"
                  }`
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: ChartView; onChange: (view: ChartView) => void }) {
  const isTable = view === "table";

  return (
    <button
      type="button"
      aria-pressed={isTable}
      onClick={() => onChange(isTable ? "chart" : "table")}
      className={`rounded-lg border px-2.5 py-1.5 font-data text-[11px] uppercase tracking-[0.05em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E7A48] ${
        isTable
          ? "border-[#EAE0CF] bg-[#F6EEE2] text-[#102E1B]"
          : "border-transparent text-[#4A5A4E] hover:bg-[#F6EEE2]"
      }`}
    >
      Table
    </button>
  );
}

function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: Array<Array<string | number>>;
}) {
  const cell = "border-b border-[#EAE0CF] px-1.5 py-2";

  return (
    <div className="max-h-[280px] overflow-auto">
      <table className="w-full border-collapse font-sans text-[13px] text-[#102E1B]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((label, index) => (
              <th
                key={label}
                scope="col"
                className={`${cell} font-data text-[11px] font-normal uppercase tracking-[0.05em] text-[#78837A] ${
                  index ? "text-right" : "text-left"
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])}>
              {row.map((value, index) =>
                index === 0 ? (
                  <th key={index} scope="row" className={`${cell} text-left font-medium`}>
                    {value}
                  </th>
                ) : (
                  <td key={index} className={`${cell} text-right tabular-nums`}>
                    {value}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TipRow = { value: string; label: string; color: string; dashed?: boolean };

// Values lead, labels follow. Positioned inside the chart's own (relative) wrapper.
function ChartTip({
  x,
  y,
  title,
  rows,
}: {
  x: number;
  y: number;
  title: string;
  rows: TipRow[];
}) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 min-w-[136px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-[10px] border border-[#EAE0CF] bg-white px-2.5 py-2 font-sans shadow-[0_10px_28px_-12px_rgba(16,46,27,0.35)]"
      style={{ left: x, top: y }}
    >
      <p className="font-data text-[11px] text-[#78837A]">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[12.5px]">
          <span
            className="w-3 border-t-2"
            style={{ borderColor: row.color, borderTopStyle: row.dashed ? "dashed" : "solid" }}
          />
          <strong className="text-sm font-bold text-[#102E1B]">{row.value}</strong>
          <span className="text-[#4A5A4E]">{row.label}</span>
        </p>
      ))}
    </div>
  );
}

function LegendLine({ color, dashed = false, children }: { color: string; dashed?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="w-4 border-t-2" style={{ borderColor: color, borderTopStyle: dashed ? "dashed" : "solid" }} />
      {children}
    </li>
  );
}

function Headline({ value, note }: { value: string; note: ReactNode }) {
  return (
    <p className="-mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-sans">
      <span className="text-[26px] font-bold tracking-[-0.025em] text-[#102E1B]">{value}</span>
      <span className="text-[13px] text-[#4A5A4E]">{note}</span>
    </p>
  );
}

/* ---------- Charts ---------- */

type ColumnItem = {
  key: string;
  label: string;
  shortLabel?: string;
  sub?: string;
  value: number;
  emphasis?: boolean;
  tipTitle: string;
  tipLabel: string;
};

function ColumnChart({ items, label, height = 210 }: { items: ColumnItem[]; label: string; height?: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const W = Math.max(280, width);
  const scale = width ? width / W : 1;
  const hasSub = items.some((item) => item.sub);
  const m = { t: 24, r: 6, b: hasSub ? 46 : 32, l: 34 };
  const innerWidth = W - m.l - m.r;
  const innerHeight = height - m.t - m.b;
  const { top, ticks } = niceScale(Math.max(1, ...items.map((item) => item.value)), true);
  const y = (value: number) => m.t + innerHeight - (value / top) * innerHeight;
  const band = innerWidth / Math.max(1, items.length);
  const barWidth = Math.min(24, band * 0.56);
  const activeItem = active === null ? null : items[active];

  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg
          viewBox={`0 0 ${W} ${height}`}
          className="block h-auto w-full overflow-visible font-sans"
          role="group"
          aria-label={label}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={m.l} x2={W - m.r} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? COLORS.axis : COLORS.grid} strokeWidth="1" />
              <text x={m.l - 10} y={y(tick) + 4} textAnchor="end" className="font-data" fontSize="11" fill="#78837A">
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {items.map((item, index) => {
            const cx = m.l + band * (index + 0.5);
            const x0 = cx - barWidth / 2;
            const isActive = active === index;
            const fill = item.emphasis
              ? isActive ? COLORS.ordersHover : COLORS.orders
              : isActive ? COLORS.mutedHover : COLORS.muted;
            const text = band < 96 && item.shortLabel ? item.shortLabel : item.label;

            return (
              <g key={item.key}>
                {item.value > 0 ? (
                  <path d={barPath(x0, y(item.value), barWidth, y(0) - y(item.value))} fill={fill} className="transition-[fill]" />
                ) : (
                  <rect x={x0} y={y(0) - 3} width={barWidth} height="3" rx="1.5" fill={COLORS.stub} />
                )}
                {item.emphasis && item.value > 0 ? (
                  <text x={cx} y={y(item.value) - 8} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#102E1B">
                    {item.value}
                  </text>
                ) : null}
                <text x={cx} y={m.t + innerHeight + 20} textAnchor="middle" fontSize="12" fill="#4A5A4E">
                  {text}
                </text>
                {item.sub ? (
                  <text
                    x={cx}
                    y={m.t + innerHeight + 36}
                    textAnchor="middle"
                    className="font-data uppercase"
                    fontSize="10"
                    letterSpacing="0.06em"
                    fill="#78837A"
                  >
                    {item.sub}
                  </text>
                ) : null}
                <rect
                  x={m.l + band * index}
                  y={m.t}
                  width={band}
                  height={innerHeight + 4}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${item.tipTitle}: ${item.value} ${item.tipLabel}`}
                  className="outline-none focus-visible:fill-[#2E7A48]/[0.06] focus-visible:stroke-[#2E7A48] focus-visible:stroke-[1.5]"
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ height }} />
      )}

      {activeItem && active !== null ? (
        <ChartTip
          x={clamp((m.l + band * (active + 0.5)) * scale, 70, Math.max(70, width - 70))}
          y={y(activeItem.value) * scale}
          title={activeItem.tipTitle}
          rows={[
            {
              value: String(activeItem.value),
              label: activeItem.tipLabel,
              color: activeItem.emphasis ? COLORS.orders : COLORS.muted,
            },
          ]}
        />
      ) : null}
    </div>
  );
}

type ForecastDay = {
  date: string;
  actual: number | null;
  predicted: number | null;
  low: number | null;
  high: number | null;
};

function buildForecastDays(
  history: Array<{ date: string; orderCount: number }>,
  forecast: Array<{ date: string; predictedOrders: number }>,
  margin: number
) {
  const days: ForecastDay[] = history.slice(-FORECAST_HISTORY_DAYS).map((point) => ({
    date: point.date,
    actual: point.orderCount,
    predicted: null,
    low: null,
    high: null,
  }));

  // Start the forecast at the last actual day so the two lines meet.
  const last = days.at(-1);
  if (last && forecast.length > 0) {
    last.predicted = last.actual;
    last.low = last.actual;
    last.high = last.actual;
  }

  for (const point of forecast) {
    days.push({
      date: point.date,
      actual: null,
      predicted: point.predictedOrders,
      low: Math.max(0, point.predictedOrders - margin),
      high: point.predictedOrders + margin,
    });
  }

  return days;
}

function ForecastChart({ days }: { days: ForecastDay[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const H = 240;
  const W = Math.max(300, width);
  const scale = width ? width / W : 1;
  const m = { t: 30, r: 16, b: 30, l: 34 };
  const innerWidth = W - m.l - m.r;
  const innerHeight = H - m.t - m.b;
  const { top, ticks } = niceScale(Math.max(...days.map((day) => Math.max(day.actual ?? 0, day.high ?? 0))));
  const x = (index: number) => m.l + (days.length > 1 ? (index / (days.length - 1)) * innerWidth : innerWidth / 2);
  const y = (value: number) => m.t + innerHeight - (value / top) * innerHeight;
  const lastActual = days.reduce((found, day, index) => (day.actual !== null ? index : found), -1);
  const firstForecast = days.findIndex((day, index) => index > lastActual && day.predicted !== null);

  const linePath = (key: "actual" | "predicted") => {
    const points = days.flatMap((day, index) => {
      const value = day[key];
      return value === null ? [] : [`${x(index)},${y(value)}`];
    });
    return points.length ? `M${points.join("L")}` : "";
  };
  const bandIndexes = days.flatMap((day, index) => (day.predicted === null ? [] : [index]));
  const bandPath =
    bandIndexes.length > 1
      ? `M${bandIndexes.map((index) => `${x(index)},${y(days[index].high ?? 0)}`).join("L")}L${[...bandIndexes]
          .reverse()
          .map((index) => `${x(index)},${y(days[index].low ?? 0)}`)
          .join("L")}Z`
      : "";

  const defaultIndex = firstForecast >= 0 ? firstForecast : Math.max(0, lastActual);
  const activeDay = active === null ? null : days[active];
  const tipRows: TipRow[] = [];
  if (activeDay && active !== null) {
    if (activeDay.actual !== null) {
      tipRows.push({ value: String(activeDay.actual), label: activeDay.actual === 1 ? "order" : "orders", color: COLORS.orders });
    }
    if (activeDay.predicted !== null && active > lastActual) {
      tipRows.push({
        value: activeDay.predicted.toFixed(1),
        label: `forecast (${(activeDay.low ?? 0).toFixed(1)}–${(activeDay.high ?? 0).toFixed(1)})`,
        color: COLORS.forecast,
        dashed: true,
      });
    }
  }
  const activeValue = activeDay ? activeDay.actual ?? activeDay.predicted ?? 0 : 0;

  const pickIndex = (clientX: number, svg: SVGSVGElement | null) => {
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const px = (clientX - box.left) * (W / box.width);
    return clamp(Math.round(((px - m.l) / innerWidth) * (days.length - 1)), 0, days.length - 1);
  };

  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full overflow-visible font-sans"
          role="group"
          aria-label="Daily orders, actual and forecast"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={m.l} x2={W - m.r} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? COLORS.axis : COLORS.grid} strokeWidth="1" />
              <text x={m.l - 10} y={y(tick) + 4} textAnchor="end" className="font-data" fontSize="11" fill="#78837A">
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {days.map((day, index) => {
            const isLast = index === days.length - 1;
            if (index % 7 !== 0 && !(isLast && index % 7 >= 4)) return null;

            return (
              <text
                key={day.date}
                x={x(index)}
                y={H - 8}
                textAnchor={isLast ? "end" : index === 0 ? "start" : "middle"}
                fontSize="12"
                fill="#4A5A4E"
              >
                {formatShortDate(day.date)}
              </text>
            );
          })}

          {bandPath ? <path d={bandPath} fill={COLORS.forecast} opacity="0.13" /> : null}

          {firstForecast > 0 ? (
            <g>
              <line x1={x(firstForecast)} x2={x(firstForecast)} y1={m.t - 6} y2={m.t + innerHeight} stroke="#78837A" strokeWidth="1" />
              <text
                x={x(firstForecast) + 6}
                y={m.t - 8}
                textAnchor="start"
                className="font-data uppercase"
                fontSize="10"
                letterSpacing="0.06em"
                fill="#4A5A4E"
              >
                Forecast
              </text>
            </g>
          ) : null}

          <path d={linePath("predicted")} fill="none" stroke={COLORS.forecast} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
          <path d={linePath("actual")} fill="none" stroke={COLORS.orders} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {lastActual >= 0 ? (
            <g>
              <circle
                cx={x(lastActual)}
                cy={y(days[lastActual].actual ?? 0)}
                r="4.5"
                fill={COLORS.orders}
                stroke={COLORS.surface}
                strokeWidth="2"
              />
              <text
                x={x(lastActual) - 10}
                y={y(days[lastActual].actual ?? 0) - 8}
                textAnchor="end"
                fontSize="12.5"
                fontWeight="700"
                fill="#102E1B"
              >
                {`${plural(days[lastActual].actual ?? 0, "order")} on ${formatWeekdayShort(days[lastActual].date)}`}
              </text>
            </g>
          ) : null}

          {activeDay && active !== null ? (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={m.t} y2={m.t + innerHeight} stroke="#4A5A4E" strokeWidth="1" />
              {activeDay.actual !== null ? (
                <circle cx={x(active)} cy={y(activeDay.actual)} r="4.5" fill={COLORS.orders} stroke={COLORS.surface} strokeWidth="2" />
              ) : null}
              {activeDay.predicted !== null && active > lastActual ? (
                <circle cx={x(active)} cy={y(activeDay.predicted)} r="4.5" fill={COLORS.forecast} stroke={COLORS.surface} strokeWidth="2" />
              ) : null}
            </g>
          ) : null}

          {/* Crosshair layer: snaps to the nearest day; arrow keys step through days */}
          <rect
            x={m.l}
            y={m.t}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            tabIndex={0}
            aria-label="Daily orders chart. Use the left and right arrow keys to read each day."
            className="outline-none focus-visible:stroke-[#2E7A48] focus-visible:stroke-[1.5]"
            onPointerMove={(event) => setActive(pickIndex(event.clientX, event.currentTarget.ownerSVGElement))}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(defaultIndex)}
            onBlur={() => setActive(null)}
            onKeyDown={(event) => {
              const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              if (step) {
                event.preventDefault();
                setActive((current) => clamp((current ?? defaultIndex) + step, 0, days.length - 1));
              } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                setActive(event.key === "Home" ? 0 : days.length - 1);
              }
            }}
          />
        </svg>
      ) : (
        <div style={{ height: H }} />
      )}

      {activeDay && active !== null && tipRows.length ? (
        <ChartTip
          x={clamp(x(active) * scale, 80, Math.max(80, width - 80))}
          y={y(activeValue) * scale}
          title={`${formatWeekdayShort(activeDay.date)}, ${formatShortDate(activeDay.date)}`}
          rows={tipRows}
        />
      ) : null}
    </div>
  );
}

/* ---------- Tonight's service ---------- */

function ServiceBand({
  hourlyCounts,
  hourlyDateLabel,
  maxHourlyOrders,
  storeStatus,
  storeOverrideValue,
  storeOverrideOptions,
  onStoreOverrideChange,
  isStoreStatusUpdating,
}: {
  hourlyCounts: Array<{ label: string; orders: number }>;
  hourlyDateLabel: string;
  maxHourlyOrders: number;
  storeStatus: StoreStatusPayload | null;
  storeOverrideValue: StoreOverrideChoice;
  storeOverrideOptions: Array<{ label: string; value: StoreOverrideChoice }>;
  onStoreOverrideChange?: (value: StoreOverrideChoice) => void;
  isStoreStatusUpdating: boolean;
}) {
  // The clock starts after mount so server and client render the same markup.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 30_000);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  const clock = now ? getServiceClock(now) : null;
  const effective = storeStatus?.effectiveStatus;
  const accepting = effective === "open";

  let title = "Checking store status";
  let detail = "Loading whether the store is taking orders.";
  if (storeStatus) {
    if (effective === "busy") {
      title = "Busy";
      detail = "New orders are paused for now. Switch to Open when the queue clears.";
    } else if (effective === "closed" && storeStatus.overrideStatus === "closed") {
      title = "Closed";
      detail = "Orders are paused. Switch to Auto to follow store hours.";
    } else if (effective === "open" && clock?.inHours) {
      title = "Open now";
      detail = `Closes at 12 AM, ${formatDuration(clock.minutesToChange)} from now.`;
    } else if (effective === "open") {
      title = "Open now";
      detail = `Opened manually, outside store hours (${SERVICE_HOURS_SHORT}).`;
    } else if (clock?.opensOn === "today") {
      title = "Opens at 5 PM";
      detail = `In ${formatDuration(clock.minutesToChange)}. Orders start automatically.`;
    } else if (clock?.opensOn) {
      title = "Closed";
      detail = `Opens ${clock.opensOn} at 5 PM, in ${formatDuration(clock.minutesToChange)}.`;
    } else {
      title = "Closed";
      detail = "Orders start automatically during store hours.";
    }
  }

  const pillText = accepting ? "Accepting orders" : effective === "busy" ? "Orders paused" : "Not accepting orders";
  const peak = hourlyCounts.reduce(
    (best, slot) => (slot.orders > best.orders ? slot : best),
    hourlyCounts[0] ?? { label: "", orders: 0 }
  );
  const expectedTotal = hourlyCounts.reduce((sum, slot) => sum + slot.orders, 0);
  const railMinWidth = hourlyCounts.length * 76 + Math.max(0, hourlyCounts.length - 1) * 12;

  return (
    <section
      id="admin-hourly-demand-curve"
      aria-labelledby="service-state"
      className="kada-admin-content-enter relative isolate grid scroll-mt-28 gap-x-11 gap-y-7 overflow-hidden rounded-3xl bg-[#0E4428] px-5 py-6 font-sans text-[#FFF3DF] sm:px-8 sm:py-7 2xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]"
      style={{ animationDelay: "380ms" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[70%] -right-[12%] -z-10 h-[140%] w-[70%] bg-[radial-gradient(closest-side,rgba(201,166,107,0.16),transparent)]"
      />

      {/* Side by side with the facts while the band is stacked; one column beside the rail on wide screens */}
      <div className="min-w-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,auto)] lg:items-end lg:gap-8 2xl:block">
        <div className="min-w-0">
          <p className="font-data text-[11.5px] uppercase tracking-[0.06em] text-[#FFF3DF]/60">Tonight&apos;s service</p>
          <h2
            id="service-state"
            className="mb-2 mt-3 text-balance text-[36px] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[42px]"
          >
            {title}
          </h2>
          <p className="max-w-[36ch] text-sm text-[#FFF3DF]/75" aria-live="polite">
            {detail}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Segmented
              label="Order taking"
              options={storeOverrideOptions}
              value={storeOverrideValue}
              onChange={(value) => onStoreOverrideChange?.(value)}
              onDark
              disabled={isStoreStatusUpdating || !onStoreOverrideChange}
            />
            <p
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                accepting ? "bg-[#8DD47A]/15 text-[#CFECC2]" : "bg-[#FFF3DF]/[0.08] text-[#FFF3DF]/70"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-[7px] w-[7px] rounded-full ${
                  accepting ? "bg-[#8DD47A] shadow-[0_0_0_3px_rgba(141,212,122,0.22)]" : "bg-[#FFF3DF]/40"
                }`}
              />
              {pillText}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-[#FFF3DF]/[0.12] pt-[18px] lg:mt-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 2xl:mt-6 2xl:border-l-0 2xl:border-t 2xl:pl-0 2xl:pt-[18px]">
          <div>
            <dt className="font-data text-[11px] uppercase tracking-[0.06em] text-[#FFF3DF]/55">Store hours</dt>
            <dd className="mt-1 whitespace-nowrap text-[15px] font-semibold" title={storeStatus?.hoursLabel}>
              5 PM – 12 AM
              <span className="block text-xs font-normal text-[#FFF3DF]/60">Monday to Saturday</span>
            </dd>
          </div>
          <div>
            <dt className="font-data text-[11px] uppercase tracking-[0.06em] text-[#FFF3DF]/55">Expected tonight</dt>
            <dd className="mt-1 text-[15px] font-semibold">About {plural(expectedTotal, "order")}</dd>
          </div>
        </dl>
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold">Expected orders by hour</h3>
            <FormulaTooltip
              onDark
              title="Orders by Hour"
              formula="Orders by Hour = order count for each hour"
              explanation="Each ticket is one hour of service, using the order pattern from the latest analytics day."
            />
          </div>
          <p className="font-data text-[11.5px] text-[#FFF3DF]/60">Based on {hourlyDateLabel}</p>
        </div>

        {/* The rail: each hour of service hangs like an order ticket */}
        <div className="-mx-5 mt-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
          <ol
            aria-label="Expected orders per hour tonight"
            className="relative grid w-full gap-3 before:absolute before:inset-x-0 before:top-[5px] before:h-[3px] before:rounded-sm before:bg-gradient-to-b before:from-[#DDBE88] before:to-[#A9864F] before:shadow-[0_1px_0_rgba(0,0,0,0.25)] before:content-['']"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, hourlyCounts.length)}, minmax(76px, 1fr))`,
              minWidth: railMinWidth,
            }}
          >
            {hourlyCounts.map((slot, index) => {
              const isPeak = slot === peak && peak.orders > 0;
              const isNow = Boolean(clock?.inHours && parseHourLabel(slot.label) === clock.hour);

              return (
                <li
                  key={slot.label}
                  className={`kada-ticket-hang relative flex flex-col gap-1.5 rounded-[3px_3px_10px_10px] bg-[#FFF7EA] px-3 pb-3 pt-[22px] text-[#102E1B] shadow-[0_12px_20px_-14px_rgba(0,0,0,0.55)] ${
                    isNow ? "ring-2 ring-[#8DD47A]" : ""
                  }`}
                  style={{ animationDelay: `${480 + index * 70}ms` }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute -top-px left-1/2 h-3.5 w-[22px] -translate-x-1/2 rounded-[3px_3px_6px_6px] bg-gradient-to-b from-[#E6CB98] to-[#B08D56]"
                  />
                  <span className="font-data text-xs text-[#4A5A4E]">{formatHourLabel(slot.label)}</span>
                  <span aria-hidden="true" className="flex h-16 items-end border-b border-[#E5D7C0]">
                    <span
                      className={`block min-h-[2px] w-6 rounded-t ${isPeak ? "bg-[#2E7A48]" : "bg-[#DCCFB8]"}`}
                      style={{ height: `${(slot.orders / Math.max(1, maxHourlyOrders)) * 100}%` }}
                    />
                  </span>
                  <span className="mt-0.5 text-2xl font-bold leading-none tracking-[-0.02em]">{slot.orders}</span>
                  <span className="-mt-[3px] text-xs text-[#78837A]">{slot.orders === 1 ? "order" : "orders"}</span>
                  {isPeak ? (
                    <span className="absolute right-2 top-5 rounded bg-[#083C1F] px-1.5 py-0.5 font-data text-[10px] uppercase tracking-[0.06em] text-[#FFF3DF]">
                      Peak
                    </span>
                  ) : null}
                  {isNow ? (
                    <span className="absolute bottom-3 right-2 rounded bg-[#DDF3D2] px-1.5 py-0.5 font-data text-[10px] uppercase tracking-[0.06em] text-[#1E5A33]">
                      Now
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#FFF3DF]/[0.07] px-3.5 py-3 text-sm text-[#FFF3DF]/85">
          <Clock size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-[#C9A66B]" />
          {peak.orders > 0 ? (
            <span>
              <strong className="font-semibold text-[#FFF3DF]">Rush around {formatHourLabel(peak.label)}</strong>
              {` — about ${plural(peak.orders, "order")}. Prep ingredients and line up staff before then.`}
            </span>
          ) : (
            <span>No hourly orders recorded yet. Tonight&apos;s pattern shows up here after the first full service.</span>
          )}
        </p>
      </div>
    </section>
  );
}

/* ---------- Loading ---------- */

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="kada-admin-content-enter h-[300px] rounded-3xl bg-[#0E4428] p-7">
        <div className="h-3.5 w-32 animate-pulse rounded-full bg-[#FFF3DF]/10" />
        <div className="mt-5 h-10 w-56 animate-pulse rounded-full bg-[#FFF3DF]/10" />
        <div className="mt-8 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-[10px] bg-[#FFF3DF]/[0.08]" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="kada-admin-card-top-enter h-[118px] rounded-[18px] border border-[#EAE0CF] bg-[#FFFCF7] p-5"
            style={{ animationDelay: `${380 + index * 70}ms` }}
          >
            <div className="kada-admin-skeleton h-3.5 w-24 rounded-full" />
            <div className="kada-admin-skeleton mt-5 h-8 w-20 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {[300, 300].map((height, index) => (
          <div
            key={index}
            className="kada-admin-content-enter rounded-[18px] border border-[#EAE0CF] bg-[#FFFCF7] p-5"
            style={{ height, animationDelay: `${560 + index * 90}ms` }}
          >
            <div className="kada-admin-skeleton h-5 w-36 rounded-full" />
            <div className="kada-admin-skeleton mt-6 h-[200px] rounded-[14px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */

const DEFAULT_STORE_OVERRIDE_OPTIONS: Array<{ label: string; value: StoreOverrideChoice }> = [
  { label: "Auto", value: "auto" },
  { label: "Open", value: "open" },
  { label: "Closed", value: "closed" },
];

function getStatBorders(index: number) {
  return [
    "border-[#EAE0CF]",
    index % 2 === 1 ? "border-l" : "",
    index >= 2 ? "border-t lg:border-t-0" : "",
    index > 0 ? "lg:border-l" : "",
  ].join(" ");
}

export function DashboardView({
  averageRating,
  averageOrderValue,
  feedbackCount,
  monthlyRevenue,
  hourlyDateLabel,
  hourlyCounts,
  itemRanking,
  hasRealRatingData,
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
  demandForecast = null,
  storeStatus = null,
  storeOverrideValue = "auto",
  storeOverrideOptions = DEFAULT_STORE_OVERRIDE_OPTIONS,
  onStoreOverrideChange,
  isStoreStatusUpdating = false,
}: {
  averageRating: number;
  averageOrderValue: number;
  feedbackCount: number;
  monthlyRevenue: number;
  hourlyDateLabel: string;
  hourlyCounts: Array<{ label: string; orders: number }>;
  itemRanking: Array<{ item: string; orders: number; revenue: number; rating: number }>;
  hasRealRatingData: boolean;
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
  demandForecast?: DemandForecastResult;
  storeStatus?: StoreStatusPayload | null;
  storeOverrideValue?: StoreOverrideChoice;
  storeOverrideOptions?: Array<{ label: string; value: StoreOverrideChoice }>;
  onStoreOverrideChange?: (value: StoreOverrideChoice) => void;
  isStoreStatusUpdating?: boolean;
}) {
  const keyword = search?.trim().toLowerCase() ?? "";
  const [menuSort, setMenuSort] = useState<"orders" | "rating">("orders");
  const [weeklyRange, setWeeklyRange] = useState<4 | 8>(4);
  const [views, setViews] = useState<Record<"forecast" | "weekly" | "weekday", ChartView>>({
    forecast: "chart",
    weekly: "chart",
    weekday: "chart",
  });
  const setView = (key: keyof typeof views) => (view: ChartView) =>
    setViews((current) => ({ ...current, [key]: view }));

  const periodLabel = totalOrdersLabel.replace(/\s*Orders$/i, "") || "This period";
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
      ? "Strong"
      : averageRating >= 4
      ? "Healthy"
      : "Needs review";

  /* KPI strip */
  const kpis: Array<{
    id: string;
    label: string;
    value: string;
    unit?: string;
    meter?: number;
    foot: ReactNode;
    formula: FormulaInfo;
  }> = [
    {
      id: "admin-total-orders",
      label: totalOrdersLabel,
      value: totalOrders.toLocaleString("en-PH"),
      foot:
        weeklyTrendCounts.length >= 2 ? (
          <>
            <span className="inline-flex items-center gap-0.5 font-semibold text-[#102E1B]">
              {trendDelta >= 0 ? (
                <ArrowUpRight size={15} strokeWidth={2.2} className="text-[#2E7A48]" />
              ) : (
                <ArrowDownRight size={15} strokeWidth={2.2} className="text-[#B4442A]" />
              )}
              {Math.abs(Math.round(trendDelta))}%
            </span>
            vs last week
          </>
        ) : (
          "Valid orders"
        ),
      formula: {
        title: "Order Count Formula",
        formula: "Orders = valid orders in this period",
        explanation: `Counts ${totalOrdersLabel.toLowerCase()} that are not cancelled or expired. The change compares the latest week with the week before.`,
      },
    },
    {
      id: "admin-gross-sales",
      label: "Revenue",
      value: peso(monthlyRevenue),
      foot: "From paid, valid orders",
      formula: {
        title: "Revenue Formula",
        formula: "Revenue = paid valid orders in this period",
        explanation: "Adds paid orders. Cancelled, expired, and unpaid orders are not counted.",
      },
    },
    {
      id: "admin-avg-order-value",
      label: "Avg order value",
      value: peso(averageOrderValue),
      foot: "Per paid order",
      formula: {
        title: "Average Order Value Formula",
        formula: "Average Order Value = paid revenue / paid orders",
        explanation: "Uses only paid valid orders, so unpaid, cancelled, and expired orders do not affect the average.",
      },
    },
    {
      id: "admin-average-rating",
      label: "Customer rating",
      value: averageRating ? averageRating.toFixed(1) : "N/A",
      unit: averageRating ? "/ 5" : undefined,
      meter: averageRating ? averageRating / 5 : undefined,
      foot:
        feedbackCount > 0 ? (
          <>
            {plural(feedbackCount, "review")},
            <span className="inline-flex items-center gap-1 font-semibold text-[#102E1B]">
              {satisfactionLabel === "Needs review" ? (
                <AlertTriangle size={13} strokeWidth={2.2} className="text-[#B4442A]" />
              ) : (
                <Smile size={13} strokeWidth={2.2} className="text-[#2E7A48]" />
              )}
              {satisfactionLabel.toLowerCase()}
            </span>
          </>
        ) : (
          "No reviews yet"
        ),
      formula: {
        title: "Satisfaction Rating Formula",
        formula: "Average Rating = sum of customer ratings / feedback count",
        explanation: "Mean of all 1-5 star ratings from customers. 4.5+ is excellent, 3-3.5 needs attention, below 3 requires action.",
      },
    },
  ];
  const visibleKpis = keyword
    ? kpis.filter((kpi) => matchesSearch(kpi.label, keyword) || matchesSearch(kpi.value, keyword))
    : kpis;

  /* Needs attention: same rules as before. Peak demand now lives in the service band. */
  const ratedItems = hasRealRatingData ? itemRanking.filter((item) => item.rating > 0) : [];
  const lowestRated = [...ratedItems.slice(0, 5)].sort((a, b) => a.rating - b.rating).slice(0, 3);
  const attentionItems: Array<{
    icon: OverviewIcon;
    tone: "warning" | "info" | "action";
    kind: string;
    title: string;
    description: string;
  }> = [
    ...(totalOrders === 0
      ? [{ icon: TrendingUp, tone: "info" as const, kind: "Heads up", title: "No orders yet", description: "Start accepting orders to see analytics." }]
      : []),
    ...(topItem && hasRealRatingData && topItem.rating > 0 && topItem.rating < 3.5
      ? [{ icon: AlertTriangle, tone: "warning" as const, kind: "Needs review", title: `${topItem.item} rating dropped`, description: `Rating: ${topItem.rating.toFixed(1)}/5. Check quality or preparation.` }]
      : []),
    ...(trendDelta < -20
      ? [{ icon: TrendingDown, tone: "warning" as const, kind: "Needs review", title: "Order volume declined", description: `Week-over-week: ${trendLabel}. Review pricing or marketing.` }]
      : []),
    ...(satisfactionLabel === "Needs review"
      ? [
          {
            icon: Smile,
            tone: "warning" as const,
            kind: "Needs review",
            title: `Customer rating is ${averageRating.toFixed(1)} out of 5`,
            description: lowestRated.length
              ? `Lowest rated: ${lowestRated.map((item) => `${item.item} (${item.rating.toFixed(1)})`).join(", ")}. Start with their recent feedback.`
              : "Review recent feedback to find what to improve.",
          },
        ]
      : []),
    ...buildItemActionInsights(
      itemRanking,
      hasRealRatingData,
      itemRanking.reduce((sum, row) => sum + row.orders, 0)
    ).map((insight) => ({
      icon: ITEM_ACTION_ICONS[insight.icon],
      tone: "action" as const,
      kind: "Suggested action",
      title: insight.title,
      description: insight.description,
    })),
  ];
  const visibleAttention = attentionItems.filter(
    (item) => !keyword || matchesSearch(item.title, keyword) || matchesSearch(item.description, keyword)
  );

  /* Menu performance */
  const visibleItemRanking = keyword
    ? itemRanking.filter((item) => matchesSearch(item.item, keyword))
    : itemRanking;
  const topSellers = visibleItemRanking.slice(0, 5);
  // Stable sort: ties keep the ranking order.
  const menuRows =
    menuSort === "rating" && hasRealRatingData
      ? [...topSellers].sort((a, b) => b.rating - a.rating)
      : topSellers;

  /* Weekly orders */
  const visibleWeeks = weeklyTrendCounts.slice(-weeklyRange);
  const weekItems: ColumnItem[] = visibleWeeks.map((week, index) => ({
    key: week.label,
    label: week.label.replaceAll(" - ", " – "),
    shortLabel: week.label.split(" - ")[0],
    value: week.orders,
    emphasis: index === visibleWeeks.length - 1,
    tipTitle: `Week of ${week.label}`,
    tipLabel: week.orders === 1 ? "order" : "orders",
  }));
  const weekDifference = latestWeek - previousWeek;

  /* Orders by weekday */
  const peakWeekday = weekdayCounts.reduce(
    (best, item) => (item.orders > best.orders ? item : best),
    weekdayCounts[0] ?? { day: "", orders: 0 }
  );
  // The store opens Monday to Saturday, so Sunday only counts if it actually had orders.
  const openWeekdays = weekdayCounts.filter((item) => item.day !== "SUN" || item.orders > 0);
  const weekdayTotal = weekdayCounts.reduce((sum, item) => sum + item.orders, 0);
  const weekdayAverage = openWeekdays.length ? weekdayTotal / openWeekdays.length : 0;
  const weekdayItems: ColumnItem[] = weekdayCounts.map((item) => {
    const names = WEEKDAY_LABELS[item.day] ?? { short: item.day, long: item.day };
    return {
      key: item.day,
      label: names.short,
      sub: item.day === "SUN" && item.orders === 0 ? "Closed" : undefined,
      value: item.orders,
      emphasis: item.orders > 0 && item === peakWeekday,
      tipTitle: names.long,
      tipLabel: item.orders === 1 ? "order" : "orders",
    };
  });

  /* Order channels */
  const channelTotal = orderTypeDistribution.reduce((sum, item) => sum + item.count, 0);
  const topChannel = orderTypeDistribution.reduce(
    (best, item) => (item.count > best.count ? item : best),
    orderTypeDistribution[0] ?? { label: "", count: 0 }
  );
  const channelsEven = orderTypeDistribution.every((item) => item.count === topChannel.count);
  const channelNote = !channelTotal
    ? "No orders yet"
    : channelsEven
    ? `Split evenly across ${orderTypeDistribution.length} channels`
    : `${topChannel.label} leads with ${Math.round((topChannel.count / channelTotal) * 100)}%`;

  /* Demand forecast */
  const forecastDays = demandForecast
    ? buildForecastDays(demandForecast.history, demandForecast.forecast, demandForecast.diagnostics.rmse)
    : [];
  const forecastTotal = demandForecast
    ? demandForecast.forecast.reduce((sum, point) => sum + point.predictedOrders, 0)
    : 0;
  const shownHistoryDays = demandForecast ? Math.min(FORECAST_HISTORY_DAYS, demandForecast.history.length) : 0;

  /* Search scoping (matches the header's search suggestions) */
  const showService =
    !keyword ||
    ["Orders by Hour", "Tonight", "Store", "Peak"].some((label) => matchesSearch(label, keyword)) ||
    hourlyCounts.some((item) => matchesSearch(item.label, keyword));
  const showKpi = !keyword || visibleKpis.length > 0;
  const showAttention =
    !keyword ||
    ["Insights", "attention", "alert", "Admin Snapshot", "Demand Help", "Customer Help"].some((label) =>
      matchesSearch(label, keyword)
    ) ||
    visibleAttention.length > 0;
  const showMenu =
    !keyword ||
    ["Top Items", "Satisfaction", "Menu"].some((label) => matchesSearch(label, keyword)) ||
    visibleItemRanking.length > 0;
  const showWeekday =
    !keyword ||
    matchesSearch("Orders - Week", keyword) ||
    matchesSearch("weekday", keyword) ||
    weekdayCounts.some((item) => matchesSearch(item.day, keyword));
  const showChannels =
    !keyword ||
    matchesSearch("Monthly Order Types", keyword) ||
    matchesSearch("channels", keyword) ||
    orderTypeDistribution.some((item) => matchesSearch(item.label, keyword));
  const showWeekly =
    !keyword ||
    matchesSearch("Weekly Trend", keyword) ||
    weeklyTrendCounts.some((item) => matchesSearch(item.label, keyword));
  const showForecast = !keyword || matchesSearch("Demand Forecast", keyword);
  const hasDashboardResults =
    showService || showKpi || showAttention || showMenu || showWeekday || showChannels || showWeekly || showForecast;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className={`space-y-5 font-sans ${isRefreshing ? "kada-admin-refreshing" : ""}`}>
      {showService ? (
        <ServiceBand
          hourlyCounts={hourlyCounts}
          hourlyDateLabel={hourlyDateLabel}
          maxHourlyOrders={maxHourlyOrders}
          storeStatus={storeStatus}
          storeOverrideValue={storeOverrideValue}
          storeOverrideOptions={storeOverrideOptions}
          onStoreOverrideChange={onStoreOverrideChange}
          isStoreStatusUpdating={isStoreStatusUpdating}
        />
      ) : null}

      {showKpi ? (
        <section
          aria-label={`${periodLabel} at a glance`}
          className="kada-admin-card-top-enter grid grid-cols-2 rounded-[18px] border border-[#EAE0CF] bg-[#FFFCF7] lg:grid-cols-4"
          style={{ animationDelay: "460ms" }}
        >
          {visibleKpis.map((kpi, index) => (
            <div
              key={kpi.id}
              id={kpi.id}
              className={`flex min-w-0 scroll-mt-28 flex-col gap-1.5 px-4 py-4 sm:px-[22px] sm:py-[18px] ${getStatBorders(index)}`}
            >
              <div className="flex items-start gap-2">
                <Eyebrow className="min-w-0 pt-0.5">{kpi.label}</Eyebrow>
                <FormulaTooltip {...kpi.formula} />
              </div>
              <p className="my-0.5 text-[28px] font-bold leading-[1.05] tracking-[-0.03em] text-[#102E1B] sm:text-[34px]">
                {kpi.value}
                {kpi.unit ? (
                  <small className="ml-1 text-base font-medium tracking-normal text-[#78837A]">{kpi.unit}</small>
                ) : null}
              </p>
              {typeof kpi.meter === "number" ? (
                <div aria-hidden="true" className="my-0.5 h-1.5 overflow-hidden rounded-full bg-[#F1E7D6]">
                  <div className="h-full rounded-full bg-[#C47E2E]" style={{ width: `${clamp(kpi.meter, 0, 1) * 100}%` }} />
                </div>
              ) : null}
              <p className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-[#4A5A4E]">{kpi.foot}</p>
            </div>
          ))}
        </section>
      ) : null}

      {/* Two independent columns so short cards never stretch.
          Below xl they merge into one column, ordered by what needs action first. */}
      <div
        className="kada-admin-content-enter flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
        style={{ animationDelay: "560ms" }}
      >
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5 xl:[&>*:last-child]:flex-1">
          {showMenu ? (
            <Card
              id="admin-top-items"
              className="order-2 xl:order-none"
              title="Menu performance"
              sub={hasRealRatingData ? "Top sellers with their average rating" : "Top sellers. Ratings show once customers leave feedback."}
              formula={{
                title: "Top Sellers and Ratings",
                formula: "Item Sales = quantity sold per item; Rating = average 1-5 stars per item",
                explanation: "Shows which menu items sell the most and how customers rate them. Below avg means under the store's overall rating.",
              }}
              tools={
                hasRealRatingData ? (
                  <Segmented
                    label="Sort drinks"
                    options={[
                      { label: "Most ordered", value: "orders" as const },
                      { label: "Highest rated", value: "rating" as const },
                    ]}
                    value={menuSort}
                    onChange={setMenuSort}
                  />
                ) : null
              }
            >
              <div id="admin-satisfaction" className="scroll-mt-28 overflow-x-auto">
                <table className="w-full border-collapse text-sm text-[#102E1B]">
                  <thead>
                    <tr className="font-data text-[11px] uppercase tracking-[0.06em] text-[#78837A]">
                      <th scope="col" className="hidden w-[30px] border-b border-[#EAE0CF] pb-2.5 text-left font-normal sm:table-cell">#</th>
                      <th scope="col" className="border-b border-[#EAE0CF] px-1.5 pb-2.5 text-left font-normal sm:px-2.5">Item</th>
                      <th scope="col" className="border-b border-[#EAE0CF] px-1.5 pb-2.5 text-left font-normal sm:px-2.5">Orders</th>
                      <th scope="col" className="border-b border-[#EAE0CF] px-1.5 pb-2.5 text-left font-normal sm:px-2.5">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuRows.map((item, index) => {
                      const hasRating = hasRealRatingData && item.rating > 0;
                      const isBelowAverage = hasRating && averageRating > 0 && item.rating < averageRating;

                      return (
                        <tr key={item.item} className="border-b border-[#EAE0CF] last:border-b-0">
                          <td className="hidden py-3 font-data text-[#78837A] tabular-nums sm:table-cell">{index + 1}</td>
                          <td className="px-1.5 py-3 font-semibold sm:whitespace-nowrap sm:px-2.5">{item.item}</td>
                          <td className="px-1.5 py-3 sm:px-2.5">
                            <div className="flex items-center gap-2 sm:gap-2.5">
                              <span className="min-w-[2.6ch] text-right font-semibold tabular-nums">{item.orders}</span>
                              <span aria-hidden="true" className="h-2 min-w-[32px] max-w-[200px] flex-1 rounded-full bg-[#F1E7D6]">
                                <span
                                  className="block h-full rounded-full bg-[#2E7A48]"
                                  style={{ width: `${clamp(item.orders / Math.max(1, maxItemOrders), 0, 1) * 100}%` }}
                                />
                              </span>
                            </div>
                          </td>
                          <td className="px-1.5 py-3 sm:px-2.5">
                            {hasRating ? (
                              <div className="flex items-center gap-2 sm:gap-2.5">
                                <span className="min-w-[2.6ch] text-right font-semibold tabular-nums">{item.rating.toFixed(1)}</span>
                                <span aria-hidden="true" className="hidden h-2 min-w-[40px] max-w-[160px] flex-1 rounded-full bg-[#F1E7D6] sm:block">
                                  <span
                                    className="block h-full rounded-full bg-[#C47E2E]"
                                    style={{ width: `${clamp(item.rating / 5, 0, 1) * 100}%` }}
                                  />
                                </span>
                                {isBelowAverage ? (
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-[#FBEED6] px-[7px] py-0.5 text-[11.5px] font-semibold text-[#8F5C0E]">
                                    <ArrowDownRight size={12} strokeWidth={2.2} />
                                    Below avg
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-[#78837A]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {menuRows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[#78837A]">
                    {keyword ? "No items match this search." : "No item sales yet."}
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}

          {showForecast ? (
            <Card
              id="admin-demand-forecast"
              className="order-3 xl:order-none"
              title="Demand forecast"
              sub={
                demandForecast
                  ? `Daily orders, last ${shownHistoryDays} days and next ${demandForecast.forecast.length}`
                  : "Daily orders, with a forecast for the week ahead"
              }
              formula={{
                title: "What This Chart Means",
                formula: "Predicts your orders for the next 7 days, using your past order history.",
                explanation: demandForecast
                  ? `The dashed line is the prediction. The shaded area shows how much the real number could go up or down — wider shading means less certainty. (Model accuracy: explains ${Math.round(demandForecast.diagnostics.rSquared * 100)}% of past order changes, typically off by about ${Math.round(demandForecast.diagnostics.rmse)} orders. Based on ${demandForecast.diagnostics.trainingDays} days of history.)`
                  : "Not enough order history yet to make a prediction.",
              }}
              tools={
                demandForecast ? (
                  <>
                    <ul aria-label="Legend" className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[12.5px] text-[#4A5A4E]">
                      <LegendLine color={COLORS.orders}>Actual</LegendLine>
                      <LegendLine color={COLORS.forecast} dashed>
                        Forecast
                      </LegendLine>
                      <li className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-[3px] opacity-25" style={{ backgroundColor: COLORS.forecast }} />
                        Likely range (±{demandForecast.diagnostics.rmse.toFixed(1)})
                      </li>
                    </ul>
                    <ViewToggle view={views.forecast} onChange={setView("forecast")} />
                  </>
                ) : null
              }
            >
              {demandForecast ? (
                <>
                  <Headline
                    value={`~${forecastTotal.toFixed(1)} orders`}
                    note={`expected over the next ${demandForecast.forecast.length} days`}
                  />
                  {views.forecast === "table" ? (
                    <DataTable
                      caption="Daily orders, actual and forecast"
                      head={["Day", "Actual", "Forecast", "Likely range"]}
                      rows={forecastDays.map((day) => {
                        const isForecast = day.actual === null && day.predicted !== null;
                        return [
                          `${formatWeekdayShort(day.date)}, ${formatShortDate(day.date)}`,
                          day.actual ?? "—",
                          isForecast ? (day.predicted ?? 0).toFixed(1) : "—",
                          isForecast ? `${(day.low ?? 0).toFixed(1)}–${(day.high ?? 0).toFixed(1)}` : "—",
                        ];
                      })}
                    />
                  ) : (
                    <ForecastChart days={forecastDays} />
                  )}
                </>
              ) : (
                <EmptyState label="Not enough order history yet for a demand forecast." />
              )}
            </Card>
          ) : null}

          {showWeekly ? (
            <Card
              id="admin-weekly-trend"
              className="order-5 xl:order-none"
              title="Weekly orders"
              sub={weeklyTrendCounts.length ? `Week of ${weeklyTrendLabel} highlighted` : "Orders per week"}
              formula={{
                title: "Weekly Trend",
                formula: "Order Count = sum of orders per week",
                explanation: "Shows order changes by week. The latest week is highlighted.",
              }}
              tools={
                weeklyTrendCounts.length ? (
                  <>
                    <Segmented
                      label="Weeks shown"
                      options={[
                        { label: "4 wks", value: 4 as const },
                        { label: "8 wks", value: 8 as const },
                      ]}
                      value={weeklyRange}
                      onChange={setWeeklyRange}
                    />
                    <ViewToggle view={views.weekly} onChange={setView("weekly")} />
                  </>
                ) : null
              }
            >
              {weeklyTrendCounts.length ? (
                <>
                  <Headline
                    value={plural(latestWeek, "order")}
                    note={
                      weeklyTrendCounts.length >= 2
                        ? `${weekDifference >= 0 ? "+" : "−"}${Math.abs(weekDifference)} vs the week before`
                        : "First week on record"
                    }
                  />
                  {views.weekly === "table" ? (
                    <DataTable
                      caption="Orders per week"
                      head={["Week", "Orders"]}
                      rows={weekItems.map((item) => [item.label, item.value])}
                    />
                  ) : (
                    <ColumnChart items={weekItems} label="Orders per week" />
                  )}
                </>
              ) : (
                <EmptyState label="No weekly order data yet" />
              )}
            </Card>
          ) : null}
        </div>

        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5 xl:[&>*:last-child]:flex-1">
          {showAttention ? (
            <Card
              id="admin-decision-support"
              className="order-1 xl:order-none"
              title="Needs attention"
              sub="From ratings and sales in this period"
              tools={
                <span className="min-w-[26px] rounded-full bg-[#FBE6DF] px-2.5 py-0.5 text-center font-data text-xs text-[#B4442A]">
                  {visibleAttention.length}
                </span>
              }
            >
              {visibleAttention.length ? (
                <ul className="flex flex-col">
                  {visibleAttention.map((item) => {
                    const Icon = item.icon;
                    const toneClass =
                      item.tone === "warning"
                        ? "bg-[#FBE6DF] text-[#B4442A]"
                        : item.tone === "action"
                        ? "bg-[#FBEED6] text-[#8F5C0E]"
                        : "bg-[#E7F1E6] text-[#2E7A48]";

                    return (
                      <li
                        key={item.title}
                        className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-0.5 border-t border-[#EAE0CF] py-3.5 first:border-t-0 first:pt-0.5"
                      >
                        <span className={`row-span-3 grid h-[34px] w-[34px] place-items-center rounded-[10px] ${toneClass}`}>
                          <Icon size={16} strokeWidth={2} />
                        </span>
                        <span className="font-data text-[10.5px] uppercase tracking-[0.06em] text-[#78837A]">{item.kind}</span>
                        <p className="text-[14.5px] font-bold text-[#102E1B]">{item.title}</p>
                        <p className="text-[13.5px] text-[#4A5A4E]">{item.description}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-[#78837A]">
                  {keyword ? "Nothing here matches this search." : "Nothing needs attention right now."}
                </p>
              )}
            </Card>
          ) : null}

          {showChannels ? (
            <Card
              id="admin-order-type-distribution"
              className="order-6 xl:order-none"
              title="Order channels"
              sub={periodLabel}
              formula={{
                title: "Order Types",
                formula: "Order Type = delivery, pickup, or walk-in",
                explanation: "Shows how customers ordered in this period.",
              }}
            >
              <Headline value={plural(channelTotal, "order")} note={channelNote} />
              {channelTotal > 0 ? (
                <div className="flex h-3.5 gap-0.5">
                  {orderTypeDistribution
                    .filter((item) => item.count > 0)
                    .map((item) => (
                      <span
                        key={item.label}
                        role="img"
                        aria-label={`${item.label}: ${plural(item.count, "order")}`}
                        title={`${item.label}: ${plural(item.count, "order")}`}
                        className="min-w-1.5 transition first:rounded-l last:rounded-r hover:brightness-110"
                        style={{ flex: `${item.count} 1 0`, backgroundColor: CHANNEL_COLORS[item.label] ?? COLORS.muted }}
                      />
                    ))}
                </div>
              ) : null}
              <ul className="flex flex-col">
                {orderTypeDistribution.map((item) => {
                  const percentage = channelTotal ? Math.round((item.count / channelTotal) * 100) : 0;

                  return (
                    <li
                      key={item.label}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 border-t border-[#EAE0CF] py-[11px] first:border-t-0"
                    >
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-[3px]"
                        style={{ backgroundColor: CHANNEL_COLORS[item.label] ?? COLORS.muted }}
                      />
                      <span className="text-sm font-semibold text-[#102E1B]">{item.label}</span>
                      <span className="text-sm font-semibold tabular-nums text-[#102E1B]">{plural(item.count, "order")}</span>
                      <span className="min-w-[4ch] text-right font-data text-xs text-[#78837A]">{percentage}%</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          {showWeekday ? (
            <Card
              id="admin-orders-week"
              className="order-4 xl:order-none"
              title="Orders by weekday"
              sub={periodLabel}
              formula={{
                title: "Orders by Day",
                formula: "Orders by Day = orders in this period grouped by weekday",
                explanation: "Shows which days get more orders. The store is closed on Sundays.",
              }}
              tools={<ViewToggle view={views.weekday} onChange={setView("weekday")} />}
            >
              {views.weekday === "table" ? (
                <DataTable
                  caption="Orders per weekday"
                  head={["Day", "Orders"]}
                  rows={weekdayItems.map((item) => [item.tipTitle, item.value])}
                />
              ) : (
                <ColumnChart items={weekdayItems} label="Orders per weekday" />
              )}
              <dl className="mt-auto grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#F6EEE2] px-3.5 py-3">
                  <dt className="font-data text-[11px] uppercase tracking-[0.06em] text-[#78837A]">Busiest day</dt>
                  <dd className="mt-1 text-base font-bold text-[#102E1B]">
                    {peakWeekday.orders > 0 ? (
                      <>
                        {WEEKDAY_LABELS[peakWeekday.day]?.short ?? peakWeekday.day}{" "}
                        <span className="text-[13px] font-normal text-[#4A5A4E]">{plural(peakWeekday.orders, "order")}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="rounded-xl bg-[#F6EEE2] px-3.5 py-3">
                  <dt className="font-data text-[11px] uppercase tracking-[0.06em] text-[#78837A]">Daily average</dt>
                  <dd className="mt-1 text-base font-bold text-[#102E1B]">
                    {weekdayAverage.toFixed(1)}{" "}
                    <span className="text-[13px] font-normal text-[#4A5A4E]">orders per open day</span>
                  </dd>
                </div>
              </dl>
            </Card>
          ) : null}
        </div>
      </div>

      {!hasDashboardResults ? <EmptyState label="No dashboard results match this search" /> : null}
    </div>
  );
}

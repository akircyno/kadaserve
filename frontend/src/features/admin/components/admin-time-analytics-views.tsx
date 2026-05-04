"use client";

import type { StaffOrder } from "@/types/orders";

const weekDays = ["MON", "TUES", "WED", "THURS", "FRI", "SAT", "SUN"];
const peakHourLabels = ["5P", "6P", "7P", "8P", "9P", "10P", "11P", "12A"];

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

function getDetectedPeakWindows(orders: StaffOrder[]) {
  return weekDays
    .map((day) => {
      const slots = peakHourLabels.map((hour) => ({
        hour,
        orders: countOrdersForSlot(orders, day, hour),
      }));
      const peakSlot = slots.reduce(
        (best, current) => (current.orders > best.orders ? current : best),
        slots[0] ?? { hour: "N/A", orders: 0 }
      );

      return {
        day,
        orders: peakSlot.orders,
        window: peakSlot.hour === "N/A" ? "No data" : `${peakSlot.hour} peak`,
      };
    })
    .filter((window) => window.orders > 0)
    .sort((first, second) => second.orders - first.orders)
    .slice(0, 5);
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

function Heatmap({ orders }: { orders: StaffOrder[] }) {
  const maxOrders = Math.max(
    1,
    ...weekDays.flatMap((day) =>
      peakHourLabels.map((hour) => countOrdersForSlot(orders, day, hour))
    )
  );

  return (
    <div className="mt-4 space-y-3">
      {weekDays.map((day, dayIndex) => (
        <div key={day} className="grid grid-cols-[48px_1fr] items-center gap-3">
          <span className="font-sans text-sm">{day}</span>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${peakHourLabels.length}, minmax(0, 1fr))` }}>
            {peakHourLabels.map((hour) => {
              const count = countOrdersForSlot(orders, day, hour);

              return (
                <div
                  key={`${day}-${hour}-${dayIndex}`}
                  aria-label={`${day} ${hour}: ${count} orders`}
                  className="h-6 rounded-[6px]"
                  style={{ backgroundColor: getHeatmapColor(count, maxOrders) }}
                  title={`${day} ${hour}: ${count} orders`}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="ml-[60px] grid gap-3" style={{ gridTemplateColumns: `repeat(${peakHourLabels.length}, minmax(0, 1fr))` }}>
        {peakHourLabels.map((hour) => (
          <span key={hour} className="text-center font-sans text-sm text-[#8C7A64]">
            {hour}
          </span>
        ))}
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

export function TimeSeriesView({
  hourlyCounts,
  maxHourlyOrders,
}: {
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
    <div className="space-y-5">
      <div className="rounded-[18px] border border-[#DCCFB8] bg-white px-5 py-4 shadow-[0_10px_24px_rgba(13,46,24,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
            5:00 PM - 12:00 AM
          </p>
          <span className="rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-1.5 font-sans text-xs font-bold text-[#684B35]">
            {total} total orders
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Peak" value={`${peak.orders} orders`} />
        <MiniStat label="Low" value={`${low} orders`} />
        <MiniStat label="Avg" value={`${avg} orders`} />
        <MiniStat label="Total" value={`${total} orders`} />
      </div>

      <Panel title="Hourly Order Volume" rightLabel={peak.label}>
        <div className="mt-5 rounded-[16px] border border-[#EFE3CF] bg-[#FFF8EF] px-4 py-5">
          <div className="flex min-w-0 items-end gap-3 overflow-x-auto pb-2 sm:gap-4">
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
                <div className="flex h-[118px] items-end">
                  <div
                    className="w-10 rounded-t-[10px] sm:w-12"
                    style={{
                      backgroundColor:
                        item.orders === 0 ? "rgba(13,46,24,0.18)" : "#0D2E18",
                      height: `${Math.max(10, (item.orders / maxHourlyOrders) * 104)}px`,
                    }}
                  />
                </div>
                <p className="font-sans text-sm font-semibold text-[#0D2E18]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Data Table" rightLabel="Orders / trend">
        <div className="mt-4 overflow-x-auto rounded-[16px] border border-[#EFE3CF] bg-white">
          <div className="min-w-[420px]">
            <div className="grid grid-cols-3 gap-4 bg-[#FFF8EF] px-4 py-3 font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#8C7A64]">
              <span>Period</span>
              <span>Orders</span>
              <span>Trend</span>
            </div>
            <div>
              {hourlyCounts.slice(0, 8).map((item, index, list) => {
                const previous = list[index - 1]?.orders ?? item.orders;
                return (
                  <div
                    key={item.label}
                    className="grid grid-cols-3 gap-4 border-t border-[#EFE3CF] px-4 py-3 font-sans text-sm text-[#0D2E18]"
                  >
                    <span className="font-semibold">{item.label}</span>
                    <span className="font-semibold tabular-nums">
                      {item.orders}
                    </span>
                    <span className="font-semibold text-[#684B35]">
                      {item.orders >= previous ? "Up" : "Down"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function PeakHoursView({ orders }: { orders: StaffOrder[] }) {
  const detectedPeakWindows = getDetectedPeakWindows(orders);

  return (
    <div className="space-y-5">
      <Panel title="Hourly Order Volume">
        <Heatmap orders={orders} />
      </Panel>
      <Panel title="Detected Peak Windows">
        <div className="grid gap-5 p-4 md:grid-cols-5">
          {detectedPeakWindows.map((peak) => (
            <div key={peak.day} className="rounded-[14px] bg-[#F7FBF5] p-4 font-sans text-sm">
              <p className="font-bold">{peak.day === "TUES" ? "Tuesday" : peak.day}</p>
              <p className="mt-2 font-bold text-[#0D2E18]">{peak.window}</p>
              <p className="mt-2 text-[#684B35]">{peak.orders} orders</p>
            </div>
          ))}
          {detectedPeakWindows.length === 0 ? (
            <div className="md:col-span-5">
              <EmptyState label="Waiting for order data" />
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

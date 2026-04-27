"use client";

import type { StaffOrder } from "@/types/orders";

const weekDays = ["MON", "TUES", "WED", "THURS", "FRI", "SAT", "SUN"];
const peakHourLabels = ["6A", "7A", "8A", "9A", "10A", "11A", "12P", "1P", "2P", "3P"];

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
    <div className="rounded-[12px] bg-[#F7FBF5] p-5 text-center">
      <p className="font-sans text-sm text-[#684B35]">{label}</p>
      <p className="mt-2 font-sans text-lg font-bold">{value}</p>
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
      <h1 className="font-sans text-3xl font-bold uppercase tracking-[0.06em]">
        Time Series Analytics
      </h1>
      <Panel title="Hourly Order Volume">
        <div className="mt-36 flex items-end gap-4 overflow-x-auto pb-2">
          {hourlyCounts.map((item) => (
            <div key={item.label} className="flex min-w-[62px] flex-col items-center gap-2">
              <p className="font-sans text-sm text-[#0D2E18]">{item.orders}</p>
              <div
                className="w-12 rounded-full bg-[#0D2E18]"
                style={{
                  height: `${Math.max(10, (item.orders / maxHourlyOrders) * 60)}px`,
                }}
              />
              <p className="font-sans text-sm text-[#0D2E18]">{item.label}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Statistics">
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <MiniStat label="Peak" value={`${peak.orders} orders`} />
            <MiniStat label="Low" value={`${low} orders`} />
            <MiniStat label="Avg" value={`${avg} orders`} />
            <MiniStat label="Total" value={`${total} orders`} />
          </div>
        </Panel>
        <Panel title="Data Table">
          <div className="mt-4 grid grid-cols-3 gap-4 px-4 font-sans text-sm font-bold text-[#684B35]">
            <span>Period</span>
            <span>Orders</span>
            <span>Trend</span>
          </div>
          <div className="mt-3 space-y-3 px-4 pb-4">
            {hourlyCounts.slice(0, 8).map((item, index, list) => {
              const previous = list[index - 1]?.orders ?? item.orders;
              return (
                <div key={item.label} className="grid grid-cols-3 gap-4 font-sans text-sm">
                  <span>{item.label}</span>
                  <span>{item.orders}</span>
                  <span>{item.orders >= previous ? "Up" : "Down"}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function PeakHoursView({ orders }: { orders: StaffOrder[] }) {
  const detectedPeakWindows = getDetectedPeakWindows(orders);

  return (
    <div className="space-y-5">
      <h1 className="font-sans text-3xl font-bold">Peak Hours</h1>
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

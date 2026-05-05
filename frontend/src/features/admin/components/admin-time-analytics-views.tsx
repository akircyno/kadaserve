"use client";

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
  const rowsBySlot = new Map(
    peakHourWindows.map((row) => [
      `${Number(row.day_of_week)}:${Number(row.hour_start)}`,
      row,
    ])
  );
  const maxOrders = Math.max(
    1,
    ...peakHourWindows.map((row) => Number(row.avg_order_count ?? 0))
  );

  return (
    <div className="mt-4 overflow-x-auto pb-2">
      <div className="min-w-[1680px] space-y-3">
        {weekDays.map((day) => (
          <div key={day.label} className="grid grid-cols-[48px_1fr] items-center gap-3">
            <span className="font-sans text-sm">{day.label}</span>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
            >
              {peakHourNumbers.map((hour) => {
                const row = rowsBySlot.get(`${day.value}:${hour}`);
                const avgOrderCount = Number(row?.avg_order_count ?? 0);
                const label = `${day.label} ${formatHourNumber(hour)}: ${formatOrderCount(
                  avgOrderCount
                )} avg orders`;

                return (
                  <div
                    key={`${day.label}-${hour}`}
                    aria-label={label}
                    className="h-6 rounded-[6px]"
                    style={{
                      backgroundColor: getHeatmapColor(avgOrderCount, maxOrders),
                    }}
                    title={label}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div
          className="ml-[60px] grid gap-2"
          style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
        >
          {peakHourNumbers.map((hour) => (
            <span key={hour} className="text-center font-sans text-xs text-[#8C7A64]">
              {formatHourNumber(hour)}
            </span>
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
    <div className="space-y-5">
      <div className="rounded-[18px] border border-[#DCCFB8] bg-white px-5 py-4 shadow-[0_10px_24px_rgba(13,46,24,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
            12:00 AM - 11:00 PM
          </p>
          <span className="rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-1.5 font-sans text-xs font-bold text-[#684B35]">
            {dateLabel} - {total} total orders
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
              {hourlyCounts.map((item, index, list) => {
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
      <Panel title="Hourly Order Volume">
        <Heatmap peakHourWindows={peakHourWindows} />
      </Panel>
      <Panel title="Detected Peak Windows">
        <div className="grid gap-5 p-4 md:grid-cols-5">
          {detectedPeakWindows.map((peak) => (
            <div
              key={`${peak.day_of_week}-${peak.hour_start}`}
              className="rounded-[14px] bg-[#F7FBF5] p-4 font-sans text-sm"
            >
              <p className="font-bold">{getDayLabel(Number(peak.day_of_week))}</p>
              <p className="mt-2 font-bold text-[#0D2E18]">
                {formatHourNumber(Number(peak.hour_start))} peak
              </p>
              <p className="mt-2 text-[#684B35]">
                {formatOrderCount(Number(peak.avg_order_count ?? 0))} avg orders
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[#8C7A64]">
                {peak.intensity}
              </p>
            </div>
          ))}
          {detectedPeakWindows.length === 0 ? (
            <div className="md:col-span-5">
              <EmptyState label="Waiting for peak-hour data" />
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

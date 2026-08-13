const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function peso(value: number): string {
  return `₱${Math.round(value).toLocaleString("en-PH")}`;
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
}

function formatPeakWindowLabel(window: { day_of_week: number; hour_start: number; hour_end: number }): string {
  const dayName = DAY_NAMES[window.day_of_week] ?? "Unknown";
  return `${dayName} ${formatHourLabel(window.hour_start)}–${formatHourLabel(window.hour_end)}`;
}

export function buildAdminAnalyticsSummaryHtml(params: {
  periodLabel: string;
  generatedAt?: Date;
  hasRealRatingData: boolean;
  kpis: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    averageRating: number;
  };
  weeklyTrend: Array<{ label: string; orders: number }>;
  topSellers: Array<{ item: string; orders: number; revenue: number; rating: number }>;
  peakHourWindows: Array<{
    day_of_week: number;
    hour_start: number;
    hour_end: number;
    avg_order_count: number;
    intensity: string;
  }>;
  demandForecast: {
    forecast: Array<{ date: string; predictedOrders: number }>;
    diagnostics: { rSquared: number; rmse: number };
  } | null;
}): string {
  const { periodLabel, generatedAt = new Date(), hasRealRatingData, kpis, weeklyTrend, topSellers, peakHourWindows, demandForecast } = params;

  const generatedLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(generatedAt);

  const topPeakWindows = [...peakHourWindows]
    .sort((a, b) => b.avg_order_count - a.avg_order_count)
    .slice(0, 3);

  const forecastTotal = demandForecast
    ? demandForecast.forecast.reduce((sum, point) => sum + point.predictedOrders, 0)
    : 0;

  return `
    <!doctype html>
    <html>
      <head>
        <title>KadaServe Analytics Summary</title>
        <style>
          body { color: #0D2E18; font-family: Arial, Helvetica, sans-serif; margin: 32px; }
          .brand { color: #0D2E18; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin-bottom: 4px; }
          .summary { border-bottom: 2px solid #684B35; margin-bottom: 20px; padding-bottom: 14px; }
          .summary h1 { font-size: 20px; margin: 0 0 8px; }
          .summary p { color: #684B35; font-size: 13px; margin: 0; }
          .stats { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 20px; }
          .stat { background: #FFF8EF; border: 1px solid #E7D7BC; border-radius: 8px; min-width: 140px; padding: 10px 14px; }
          .stat .label { color: #684B35; font-size: 11px; text-transform: uppercase; }
          .stat .value { font-size: 18px; font-weight: 700; }
          section { margin-bottom: 24px; }
          section h2 { border-bottom: 1px solid #E7D7BC; font-size: 15px; padding-bottom: 6px; }
          table { border-collapse: collapse; font-size: 11px; width: 100%; }
          th { background: #FFF0DA; color: #0D2E18; text-align: left; }
          th, td { border-bottom: 1px solid #E7D7BC; padding: 9px 7px; vertical-align: top; }
          .money { font-weight: 700; text-align: right; white-space: nowrap; }
          .empty { color: #8C7A64; padding: 12px 0; text-align: center; }
          @media print { body { margin: 18px; } }
        </style>
      </head>
      <body>
        <div class="brand">KadaServe</div>
        <section class="summary">
          <h1>Analytics Summary</h1>
          <p>Generated ${escapeHtml(generatedLabel)}</p>
        </section>

        <section>
          <h2>Orders &amp; Revenue &mdash; ${escapeHtml(periodLabel)}</h2>
          <div class="stats">
            <div class="stat"><div class="label">Total Orders</div><div class="value">${kpis.totalOrders}</div></div>
            <div class="stat"><div class="label">Revenue</div><div class="value">${escapeHtml(peso(kpis.totalRevenue))}</div></div>
            <div class="stat"><div class="label">Avg Order Value</div><div class="value">${escapeHtml(peso(kpis.averageOrderValue))}</div></div>
          </div>
        </section>

        <section>
          <h2>Satisfaction &mdash; All Feedback</h2>
          <div class="stats">
            <div class="stat"><div class="label">Average Rating</div><div class="value">${kpis.averageRating.toFixed(1)}/5</div></div>
          </div>
        </section>

        <section>
          <h2>Weekly Trend (Last 8 Weeks)</h2>
          ${
            weeklyTrend.length === 0
              ? `<p class="empty">Not enough data yet</p>`
              : `
          <table>
            <thead><tr><th>Week</th><th>Orders</th></tr></thead>
            <tbody>
              ${weeklyTrend
                .map((point) => `<tr><td>${escapeHtml(point.label)}</td><td>${point.orders}</td></tr>`)
                .join("")}
            </tbody>
          </table>
          `
          }
        </section>

        <section>
          <h2>Top Sellers (All Time)</h2>
          ${
            topSellers.length === 0
              ? `<p class="empty">Not enough data yet</p>`
              : `
          <table>
            <thead><tr><th>Item</th><th>Orders</th><th>Revenue</th><th>Rating</th></tr></thead>
            <tbody>
              ${topSellers
                .slice(0, 10)
                .map(
                  (item) => `
                    <tr>
                      <td>${escapeHtml(item.item)}</td>
                      <td>${item.orders}</td>
                      <td class="money">${escapeHtml(peso(item.revenue))}</td>
                      <td>${hasRealRatingData && item.rating > 0 ? item.rating.toFixed(1) : "—"}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
          `
          }
        </section>

        <section>
          <h2>Peak Hours (Last 30 Days)</h2>
          ${
            topPeakWindows.length === 0
              ? `<p class="empty">Not enough data yet</p>`
              : `
          <table>
            <thead><tr><th>Window</th><th>Avg Orders</th><th>Intensity</th></tr></thead>
            <tbody>
              ${topPeakWindows
                .map(
                  (window) => `
                    <tr>
                      <td>${escapeHtml(formatPeakWindowLabel(window))}</td>
                      <td>${Number(window.avg_order_count ?? 0).toFixed(1)}</td>
                      <td>${escapeHtml(window.intensity)}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
          `
          }
        </section>

        <section>
          <h2>Demand Forecast</h2>
          ${
            demandForecast
              ? `<p>Next ${demandForecast.forecast.length} days: <strong>${Math.round(forecastTotal)} predicted orders</strong> (R² ${demandForecast.diagnostics.rSquared.toFixed(3)}, RMSE ${demandForecast.diagnostics.rmse.toFixed(2)}).</p>`
              : `<p class="empty">Not enough order history yet for a forecast</p>`
          }
        </section>

        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
    </html>
  `;
}

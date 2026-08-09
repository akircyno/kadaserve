# Admin AI Analytics & Presentation — Design

Status: Implemented (2026-08-05)
Origin: Thesis defense panel revisions — "Integrate AI for Analytics" and "Presentation of Analytics improvements" (Admin page)

## Context

KadaServe's admin analytics today (`frontend/src/app/api/admin/analytics/*`) are entirely
deterministic aggregation and rule-based thresholds — no statistical or ML model anywhere in
the codebase. The thesis panel asked for real AI/statistical modeling in the analytics, plus
improved presentation. This spec covers both together since they land on the same dashboard
surface and were bundled as one sub-project (see decomposition discussion in-session).

This is the first of three sub-projects derived from the panel's revision list:
- **A. AI Analytics + Presentation (this doc)**
- B. AI Recommendations (customer page) — separate spec, not started
- C. Reports Generation (staff + admin) — separate spec, not started
- (Online Payment — parked, blocked on manager's PayMongo account)

## Data reality check

Live Supabase data as of 2026-08-05: 133 total orders (87 completed/delivered), 152
order_items, 40 feedback rows, 21 customer profiles, 15 menu items, spanning 2026-04-30 to
2026-05-31 (~1 month). This matches the thesis's own Chapter 2.4 estimate ("~50-100
transaction records"). This is a small dataset and directly shapes technique choice below —
anything requiring real training data (embeddings, neural nets) would overfit and would also
contradict the thesis's own Chapter 1 Scope & Limitations, which explicitly favors lightweight
methods over complex ML at this scale, citing Fahrudin & Wisna (2022).

## Goals

1. Add a genuine statistical forecasting model for order demand, replacing "AI-labeled but
   actually just aggregation" with an actual fitted model that produces real diagnostics.
2. Reformulate peak-hour intensity classification from fixed-ratio thresholds to a proper
   statistical method (mean + k·σ).
3. Visually present the above using the project's already-installed but unused `recharts`
   dependency, replacing the hand-rolled CSS bar chart for the weekly/daily trend.
4. Fix a found presentation bug: the admin dashboard defaults to the literal current calendar
   month, which is empty (no orders since 2026-05-31), producing a confusing "0 orders, +92%"
   empty state. Default should fall back to the most recent period that has data.

## Non-goals

- Not touching the recommendation engine (`frontend/src/lib/recommendations.ts`) — that's
  Sub-project B.
- Not building report export — that's Sub-project C (note: admin already has PDF/CSV export
  on the Orders view, found during this session; Sub-project C will extend it, not build from
  scratch).
- Not adding a chat/LLM layer over analytics. Considered and explicitly rejected for this pass
  (see approaches discussion) — risks looking like a wrapper rather than real modeling, when
  presented as "the AI" to a panel.

## Technique: Multiple Linear Regression as dynamic regression

Confirmed via research (see Sources) that MLR is standard, named practice for time series
("time series regression"), used alongside ARIMA/exponential smoothing for short-term
demand/load forecasting with calendar predictors. The one real objection — plain regression
assumes independent observations, which time series violates — is closed by including the
target's own recent history as a regressor, i.e. a **dynamic regression / ARDL-style model**,
not naive OLS on trend alone.

This also directly matches Schmidt et al. (2022), already cited in the thesis's Chapter 1 RRL:
"simple linear models applied consistently... perform better than naive forecasting methods in
short-term restaurant demand prediction."

### Regressors

- 6 day-of-week dummy variables (Sunday = baseline)
- Linear time-trend index (day number since first observation)
- Lag term: same-weekday order count from the previous week (closes the autocorrelation
  objection)

### Validation

- Chronological train/test split (never random — order matters for time series)
- RMSE and MAE on the test set, compared against a naive baseline (repeat same-weekday-last-week)
- Durbin-Watson statistic on residuals, reported as a diagnostic (standard practice per
  MATLAB Econometrics Toolbox guidance — see Sources)

### Guardrails

- Minimum history refined to a precise number, not an approximation: the lag-7 regressor
  consumes the first 7 days of any series (no prior-week value exists for them), so the
  minimum viable series length is **21 days** (7 warm-up + 14 modelable rows, enough for a
  meaningful chronological train/test split). Below that, or if the design matrix is singular
  (e.g. degenerate/constant data), skip forecasting and show an honest empty state ("Not
  enough order history yet for a forecast") — consistent with existing empty-state patterns
  already in the dashboard (e.g. "No orders yet"). Real data today (32 days, 2026-04-30 to
  2026-05-31) clears this threshold.

## Architecture

New files, kept small and single-purpose, following the codebase's actual (flat) lib
convention — `frontend/src/lib/analytics-ranking.ts`, `admin-order-totals.ts`, etc. are all
flat, not nested — so these live alongside them rather than under a new `analytics/` subfolder:

- `frontend/src/lib/linear-regression.ts` — generic OLS solver via closed-form
  normal equations (Gaussian elimination on XᵀX). No new npm dependency. Pure function(s),
  independently testable with synthetic data of known coefficients.
- `frontend/src/lib/demand-forecast.ts` — domain logic: builds the feature matrix
  from daily order aggregates, calls the solver, computes diagnostics, produces the 7-day
  forecast. Depends on `linear-regression.ts` only.
- `frontend/src/lib/peak-hour-intensity.ts` — extracted statistical classification
  (`mean + k·σ`), pulled out of `peak-hours/route.ts` into its own zero-dependency file so it's
  independently testable (route files import `next/server`, which complicates the test
  harness described below).

New API route:

- `frontend/src/app/api/admin/analytics/demand-forecast/route.ts` — admin-gated (same
  `assertAdminAccess` pattern as `peak-hours/route.ts` and `daily/route.ts`). Reads live from
  `orders` and recomputes daily counts on each request, the same way `peak-hours/route.ts`'s
  `GET` does — rather than depending on the persisted `analytics_daily` table, which is only
  refreshed when an admin explicitly triggers its `POST` and could be stale. Returns the 7-day
  forecast, diagnostics, coefficients, and the last 30 days of history (for the chart) as JSON.

Modified:

- `frontend/src/app/api/admin/analytics/peak-hours/route.ts` — replaces the local
  `getIntensity` (fixed ratio thresholds, `≥0.8·max`) with `classifyIntensity` imported from
  the new `peak-hour-intensity.ts`: `high` = count ≥ μ + 1σ, `medium` = μ ≤ count < μ + 1σ,
  `low` = count < μ, where μ/σ are the mean/standard deviation of that window's own order
  counts. Keeps the existing three-tier output shape so no downstream UI changes are needed
  beyond the reclassification itself.
- `frontend/src/features/admin/components/admin-overview-view.tsx` — add a new
  `DemandForecastChart` component, a hand-rolled SVG line chart following the exact pattern
  already established by `HourlyDemandCurve` in this same file (coordinate mapping, path
  building, brand colors). **Correction from the original spec**: closer reading found the
  codebase already has a working, well-styled native SVG chart component for exactly this
  purpose — pulling in `recharts` (installed but otherwise unused) would mean re-theming it to
  match brand colors for no real benefit over extending the existing pattern, and would be the
  one inconsistent chart in the dashboard. Shows historical daily orders (solid line) +
  forecasted next 7 days (dashed continuation) with a shaded ±RMSE band. Added as a new `Panel`
  reusing the existing `formula`/`formulaExplanation` tooltip pattern already used for KPI
  tiles, to show model diagnostics inline.
- `frontend/src/features/admin/components/admin-dashboard.tsx:546` — root cause found:
  `const dashboardTimeFilter = "month" as const;` is a hardcoded literal (not even a
  `useState`), always meaning the literal current calendar month regardless of data. Fix:
  compute it — if any valid order falls in the current calendar month, keep `"month"`;
  otherwise fall back to `"custom"` with `customStartDate`/`customEndDate` set to the first/last
  day of the month containing the most recent order. This reuses the `"custom"` time-filter
  path that `getAdminReportOrders`/`isWithinAdminTimeFilter` already support
  (`frontend/src/lib/admin-order-totals.ts`) — no new filtering logic needed.

## Testing

Project has no Jest/Vitest; existing convention is a standalone verify script
(`test:nutrition` → `scripts/verify-nutrition.mjs`), which transpiles a single self-contained
`.ts` file at runtime via the TypeScript compiler API and dynamic-imports it as a `data:` URL.
That trick only works for files with zero imports of their own — `demand-forecast.ts` imports
from `linear-regression.ts`, so its harness instead transpiles both to temp `.mjs` files (in an
OS temp dir, cleaned up after) and imports the dependent file by path, patching the relative
import specifier to include the `.mjs` extension Node's ESM resolver requires.

- `scripts/verify-analytics.mjs` — one script covering both new lib modules (matches this
  spec's single sub-project scope rather than one script per file):
  - Feeds synthetic data with known coefficients into the OLS solver, asserts they're
    recovered within tolerance.
  - Sanity-checks the Durbin-Watson calculation against a known reference value.
  - Checks `generateDemandForecast` guardrail behavior (series shorter than 21 days →
    returns `null`, not a crash).
  - Checks `classifyIntensity` (from `peak-hour-intensity.ts`) against hand-computed
    mean/σ thresholds.
- New `package.json` script: `"test:analytics": "node scripts/verify-analytics.mjs"`.

## Risks / open questions

- With ~1 month of daily data, the model has limited history to fit against. Diagnostics
  (R², RMSE) should be displayed honestly rather than oversold — this is itself defensible
  content for the thesis ("here are the model's actual limitations, measured, not assumed").
- If live order data resumes (currently stalled since 2026-05-31), forecast quality will
  improve; no code changes needed for that, just more historical rows accumulating.

## Sources

- [Time Series Regression VII: Forecasting - MATLAB & Simulink](https://www.mathworks.com/help/econ/time-series-regression-vii-forecasting.html)
- [Time Series Modeling: Why ARIMA Models Beat Linear Regression for Temporal Data - Statistical Horizons](https://statisticalhorizons.com/time-series-modeling-why-arima-models-beat-linear-regression-for-temporal-data/)
- [A Beginner's Guide to Time Series Forecasting Using Linear Regression - DEV Community](https://dev.to/aionlinecourse/a-beginners-guide-to-time-series-forecasting-using-linear-regression-2m07)
- [Restaurant Sales and Customer Demand Forecasting: Literature Survey](https://eudl.eu/pdf/10.1007/978-3-319-33681-7_40)
- Schmidt et al. (2022), already cited in thesis Chapter 1 RRL — "Machine Learning-Based Restaurant Sales Forecasting"

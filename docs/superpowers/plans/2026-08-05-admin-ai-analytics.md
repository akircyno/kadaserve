# Admin AI Analytics & Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real, defensible statistical forecasting model (dynamic linear regression) to KadaServe's admin analytics, reformulate peak-hour detection from fixed-ratio thresholds to statistical anomaly detection, fix a found empty-state presentation bug, and visualize the forecast using the codebase's existing native SVG chart pattern.

**Architecture:** Two new zero/low-dependency pure-function lib modules (`linear-regression.ts`, `demand-forecast.ts`) plus an extracted `peak-hour-intensity.ts`, a new admin API route that recomputes daily order counts live and fits the model, and UI wiring in the existing admin dashboard components. No new npm dependencies.

**Tech Stack:** TypeScript, Next.js API routes, Supabase (read-only queries against `orders`), plain SVG for charting (no charting library).

## Global Constraints

- No new npm dependencies — the OLS solver is hand-rolled (small enough, and this project deliberately avoids heavy ML tooling per its own thesis scope).
- No Jest/Vitest in this project — tests are a standalone script run via `node`, following the existing `scripts/verify-nutrition.mjs` convention.
- All new/modified admin API routes must use the exact `assertAdminAccess()` pattern already used in `peak-hours/route.ts` and `daily/route.ts` (require `role === "admin"`, not just `staff`).
- Follow the codebase's flat `frontend/src/lib/*.ts` convention — no new subfolders.
- Match existing visual style exactly: colors `#0D2E18` (dark green), `#684B35` (brown), `#FFFCF7`/`#FFF8EF` (cream backgrounds) — copy from `HourlyDemandCurve` in `admin-overview-view.tsx`, don't invent new colors.

---

### Task 1: OLS solver (`linear-regression.ts`) + verification harness

**Files:**
- Create: `frontend/src/lib/linear-regression.ts`
- Create: `frontend/scripts/verify-analytics.mjs`
- Modify: `frontend/package.json` (add `test:analytics` script)

**Interfaces:**
- Produces: `fitOls(designMatrix: number[][], target: number[]): { coefficients: number[]; residuals: number[]; fittedValues: number[] }`, `predictOls(coefficients: number[], row: number[]): number`, `calculateRSquared(target: number[], fittedValues: number[]): number`, `calculateRmse(actual: number[], predicted: number[]): number`, `calculateMae(actual: number[], predicted: number[]): number`, `calculateDurbinWatson(residuals: number[]): number`. These are consumed by Task 2's `demand-forecast.ts`.

- [ ] **Step 1: Write `linear-regression.ts`**

```typescript
// frontend/src/lib/linear-regression.ts

export type OlsFit = {
  coefficients: number[];
  residuals: number[];
  fittedValues: number[];
};

function multiplyTransposeBySelf(x: number[][]): number[][] {
  const cols = x[0]?.length ?? 0;
  const result: number[][] = Array.from({ length: cols }, () => new Array(cols).fill(0));

  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      let sum = 0;
      for (let row = 0; row < x.length; row += 1) {
        sum += x[row][i] * x[row][j];
      }
      result[i][j] = sum;
    }
  }

  return result;
}

function multiplyTransposeByVector(x: number[][], y: number[]): number[] {
  const cols = x[0]?.length ?? 0;
  const result = new Array(cols).fill(0);

  for (let i = 0; i < cols; i += 1) {
    let sum = 0;
    for (let row = 0; row < x.length; row += 1) {
      sum += x[row][i] * y[row];
    }
    result[i] = sum;
  }

  return result;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const n = matrix.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < n; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row;
      }
    }
    [augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]];

    const pivotValue = augmented[pivot][pivot];
    if (Math.abs(pivotValue) < 1e-10) {
      throw new Error("Matrix is singular and cannot be solved.");
    }

    for (let row = pivot + 1; row < n; row += 1) {
      const factor = augmented[row][pivot] / pivotValue;
      for (let col = pivot; col <= n; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col];
      }
    }
  }

  const solution = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = augmented[row][n];
    for (let col = row + 1; col < n; col += 1) {
      sum -= augmented[row][col] * solution[col];
    }
    solution[row] = sum / augmented[row][row];
  }

  return solution;
}

export function fitOls(designMatrix: number[][], target: number[]): OlsFit {
  if (designMatrix.length !== target.length) {
    throw new Error("Design matrix row count must match target length.");
  }
  if (designMatrix.length === 0) {
    throw new Error("Cannot fit a model with zero observations.");
  }

  const xtx = multiplyTransposeBySelf(designMatrix);
  const xty = multiplyTransposeByVector(designMatrix, target);
  const coefficients = solveLinearSystem(xtx, xty);

  const fittedValues = designMatrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * coefficients[index], 0)
  );
  const residuals = target.map((value, index) => value - fittedValues[index]);

  return { coefficients, residuals, fittedValues };
}

export function predictOls(coefficients: number[], row: number[]): number {
  return row.reduce((sum, value, index) => sum + value * coefficients[index], 0);
}

export function calculateRSquared(target: number[], fittedValues: number[]): number {
  const mean = target.reduce((sum, value) => sum + value, 0) / target.length;
  const totalSumOfSquares = target.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const residualSumOfSquares = target.reduce(
    (sum, value, index) => sum + (value - fittedValues[index]) ** 2,
    0
  );

  if (totalSumOfSquares === 0) {
    return residualSumOfSquares === 0 ? 1 : 0;
  }

  return 1 - residualSumOfSquares / totalSumOfSquares;
}

export function calculateRmse(actual: number[], predicted: number[]): number {
  const sumSquaredError = actual.reduce(
    (sum, value, index) => sum + (value - predicted[index]) ** 2,
    0
  );
  return Math.sqrt(sumSquaredError / actual.length);
}

export function calculateMae(actual: number[], predicted: number[]): number {
  const sumAbsoluteError = actual.reduce(
    (sum, value, index) => sum + Math.abs(value - predicted[index]),
    0
  );
  return sumAbsoluteError / actual.length;
}

export function calculateDurbinWatson(residuals: number[]): number {
  if (residuals.length < 2) {
    return NaN;
  }

  let numerator = 0;
  for (let i = 1; i < residuals.length; i += 1) {
    numerator += (residuals[i] - residuals[i - 1]) ** 2;
  }

  const denominator = residuals.reduce((sum, value) => sum + value ** 2, 0);

  if (denominator === 0) {
    return NaN;
  }

  return numerator / denominator;
}
```

- [ ] **Step 2: Write the failing verification script**

```javascript
// frontend/scripts/verify-analytics.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

async function importDataUrlModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const transpiled = transpile(source);
  const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled)}`;
  return import(moduleUrl);
}

console.log("Testing linear-regression.ts...");

const {
  fitOls,
  predictOls,
  calculateRSquared,
  calculateRmse,
  calculateMae,
  calculateDurbinWatson,
} = await importDataUrlModule("../src/lib/linear-regression.ts");

// Known-answer test: y = 2 + 3*x1 - 1*x2, exact fit, zero noise.
{
  const designMatrix = [
    [1, 0, 0],
    [1, 1, 0],
    [1, 0, 1],
    [1, 1, 1],
    [1, 2, 1],
  ];
  const target = designMatrix.map(([, x1, x2]) => 2 + 3 * x1 - 1 * x2);
  const fit = fitOls(designMatrix, target);

  assert.ok(Math.abs(fit.coefficients[0] - 2) < 1e-6, `intercept expected 2, got ${fit.coefficients[0]}`);
  assert.ok(Math.abs(fit.coefficients[1] - 3) < 1e-6, `x1 coef expected 3, got ${fit.coefficients[1]}`);
  assert.ok(Math.abs(fit.coefficients[2] - (-1)) < 1e-6, `x2 coef expected -1, got ${fit.coefficients[2]}`);
  fit.residuals.forEach((residual) => assert.ok(Math.abs(residual) < 1e-6, `expected ~0 residual, got ${residual}`));
  console.log("  PASS: fitOls recovers known coefficients exactly");
}

// predictOls sanity check
{
  const prediction = predictOls([2, 3, -1], [1, 4, 5]);
  assert.equal(prediction, 2 + 3 * 4 - 1 * 5);
  console.log("  PASS: predictOls computes dot product correctly");
}

// R-squared: perfect fit => 1
{
  const rSquared = calculateRSquared([1, 2, 3, 4], [1, 2, 3, 4]);
  assert.equal(rSquared, 1);
  console.log("  PASS: calculateRSquared is 1 for a perfect fit");
}

// RMSE / MAE known values
{
  const actual = [10, 20, 30];
  const predicted = [12, 18, 33];
  // errors: 2, -2, 3 => squared: 4,4,9 => mean 5.6667 => sqrt ~2.3805
  const rmse = calculateRmse(actual, predicted);
  const mae = calculateMae(actual, predicted);
  assert.ok(Math.abs(rmse - Math.sqrt(17 / 3)) < 1e-6, `rmse got ${rmse}`);
  assert.ok(Math.abs(mae - 7 / 3) < 1e-6, `mae got ${mae}`);
  console.log("  PASS: calculateRmse and calculateMae match hand-computed values");
}

// Durbin-Watson: alternating residuals => DW close to 4 (negative autocorrelation)
{
  const dw = calculateDurbinWatson([1, -1, 1, -1, 1, -1]);
  assert.ok(dw > 3.5, `expected DW near 4 for alternating residuals, got ${dw}`);
  console.log("  PASS: calculateDurbinWatson detects negative autocorrelation");
}

console.log("\nAll linear-regression.ts checks passed.");
```

- [ ] **Step 3: Run it to confirm it fails (file doesn't exist yet if done out of order) or passes (if Step 1 already applied)**

Run: `cd frontend && node scripts/verify-analytics.mjs`
Expected: `All linear-regression.ts checks passed.` (Steps 1 and 2 are written together above since this is a from-scratch module; there is no meaningful "red" state to observe separately here — confirm by temporarily commenting out the `fitOls` export and re-running to see it throw `is not a function`, then restore it.)

- [ ] **Step 4: Confirm it passes for real**

Run: `cd frontend && node scripts/verify-analytics.mjs`
Expected: exits 0, prints `All linear-regression.ts checks passed.`

- [ ] **Step 5: Add the `test:analytics` script to `frontend/package.json`**

In the `"scripts"` block (next to the existing `"test:nutrition": "node scripts/verify-nutrition.mjs"`), add:

```json
    "test:analytics": "node scripts/verify-analytics.mjs",
```

- [ ] **Step 6: Run via npm to confirm the script wiring works**

Run: `cd frontend && npm run test:analytics`
Expected: same pass output as Step 4, invoked through npm.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/linear-regression.ts frontend/scripts/verify-analytics.mjs frontend/package.json
git commit -m "feat: add OLS linear regression solver with verification harness"
```

---

### Task 2: Demand forecast domain logic (`demand-forecast.ts`)

**Files:**
- Create: `frontend/src/lib/demand-forecast.ts`
- Modify: `frontend/scripts/verify-analytics.mjs`

**Interfaces:**
- Consumes: `fitOls`, `predictOls`, `calculateRSquared`, `calculateRmse`, `calculateMae`, `calculateDurbinWatson` from `frontend/src/lib/linear-regression.ts` (Task 1), via relative import `from "./linear-regression"`.
- Produces: `type DailyOrderCount = { date: string; orderCount: number }`, `MIN_HISTORY_DAYS = 21`, `fillDailySeries(sparseCounts: Map<string, number>, startDate: string, endDate: string): DailyOrderCount[]`, `addDays(dateKey: string, days: number): string`, `generateDemandForecast(series: DailyOrderCount[]): DemandForecastResult | null` where `DemandForecastResult = { forecast: Array<{ date: string; predictedOrders: number }>; diagnostics: { rSquared: number; rmse: number; mae: number; baselineRmse: number; baselineMae: number; durbinWatson: number; trainingDays: number; testDays: number }; coefficients: { intercept: number; trend: number; lagSameWeekday: number; dayOfWeek: Record<string, number> } }`. Consumed by Task 4's API route and Task 6's verification extension.

- [ ] **Step 1: Write `demand-forecast.ts`**

```typescript
// frontend/src/lib/demand-forecast.ts
import {
  calculateDurbinWatson,
  calculateMae,
  calculateRmse,
  calculateRSquared,
  fitOls,
  predictOls,
} from "./linear-regression";

export type DailyOrderCount = {
  date: string; // YYYY-MM-DD
  orderCount: number;
};

export type DemandForecastResult = {
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
};

// Lag-7 regressor consumes the first 7 days of any series (no prior-week value
// exists for them), so the minimum viable series is 7 warm-up + 14 modelable
// rows = 21 days, enough for a meaningful chronological train/test split.
export const MIN_HISTORY_DAYS = 21;
const FORECAST_HORIZON_DAYS = 7;
const MIN_TRAIN_TEST_ROWS = 14;
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function fillDailySeries(
  sparseCounts: Map<string, number>,
  startDate: string,
  endDate: string
): DailyOrderCount[] {
  const series: DailyOrderCount[] = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    series.push({ date: cursor, orderCount: sparseCounts.get(cursor) ?? 0 });
    cursor = addDays(cursor, 1);
  }

  return series;
}

function getDayOfWeekIndex(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00+08:00`).getDay();
}

function buildFeatureRow(dateKey: string, trendIndex: number, lagValue: number): number[] {
  const dayOfWeek = getDayOfWeekIndex(dateKey);
  const dummies = [1, 2, 3, 4, 5, 6].map((day) => (dayOfWeek === day ? 1 : 0));
  return [1, ...dummies, trendIndex, lagValue];
}

function buildDesignMatrix(series: DailyOrderCount[]) {
  const rows: number[][] = [];
  const targets: number[] = [];

  for (let i = 7; i < series.length; i += 1) {
    const current = series[i];
    const lag = series[i - 7].orderCount;
    rows.push(buildFeatureRow(current.date, i, lag));
    targets.push(current.orderCount);
  }

  return { rows, targets };
}

export function generateDemandForecast(series: DailyOrderCount[]): DemandForecastResult | null {
  if (series.length < MIN_HISTORY_DAYS) {
    return null;
  }

  const { rows, targets } = buildDesignMatrix(series);

  if (rows.length < MIN_TRAIN_TEST_ROWS) {
    return null;
  }

  const testSize = Math.max(3, Math.round(rows.length * 0.2));
  const trainRows = rows.slice(0, rows.length - testSize);
  const trainTargets = targets.slice(0, targets.length - testSize);
  const testRows = rows.slice(rows.length - testSize);
  const testTargets = targets.slice(targets.length - testSize);

  let trainFit;
  let fullFit;
  try {
    trainFit = fitOls(trainRows, trainTargets);
    fullFit = fitOls(rows, targets);
  } catch {
    return null;
  }

  const testPredictions = testRows.map((row) => predictOls(trainFit.coefficients, row));
  // Naive baseline: predict this weekday's count as the same weekday last week
  // (the lag column, last entry in each feature row).
  const baselinePredictions = testRows.map((row) => row[row.length - 1]);

  const rSquared = calculateRSquared(trainTargets, trainFit.fittedValues);
  const rmse = calculateRmse(testTargets, testPredictions);
  const mae = calculateMae(testTargets, testPredictions);
  const baselineRmse = calculateRmse(testTargets, baselinePredictions);
  const baselineMae = calculateMae(testTargets, baselinePredictions);
  const durbinWatson = calculateDurbinWatson(trainFit.residuals);

  const lagLookup = new Map(series.map((point) => [point.date, point.orderCount]));
  const lastDate = series[series.length - 1].date;
  const forecast: Array<{ date: string; predictedOrders: number }> = [];

  for (let step = 1; step <= FORECAST_HORIZON_DAYS; step += 1) {
    const nextDate = addDays(lastDate, step);
    const lagDate = addDays(nextDate, -7);
    const lagValue = lagLookup.get(lagDate) ?? 0;
    const trendIndex = series.length - 1 + step;
    const row = buildFeatureRow(nextDate, trendIndex, lagValue);
    const predictedOrders = Math.max(0, predictOls(fullFit.coefficients, row));

    forecast.push({ date: nextDate, predictedOrders: Number(predictedOrders.toFixed(2)) });
  }

  return {
    forecast,
    diagnostics: {
      rSquared: Number(rSquared.toFixed(3)),
      rmse: Number(rmse.toFixed(2)),
      mae: Number(mae.toFixed(2)),
      baselineRmse: Number(baselineRmse.toFixed(2)),
      baselineMae: Number(baselineMae.toFixed(2)),
      durbinWatson: Number(durbinWatson.toFixed(2)),
      trainingDays: trainRows.length,
      testDays: testRows.length,
    },
    coefficients: {
      intercept: Number(fullFit.coefficients[0].toFixed(3)),
      dayOfWeek: {
        Monday: Number(fullFit.coefficients[1].toFixed(3)),
        Tuesday: Number(fullFit.coefficients[2].toFixed(3)),
        Wednesday: Number(fullFit.coefficients[3].toFixed(3)),
        Thursday: Number(fullFit.coefficients[4].toFixed(3)),
        Friday: Number(fullFit.coefficients[5].toFixed(3)),
        Saturday: Number(fullFit.coefficients[6].toFixed(3)),
      },
      trend: Number(fullFit.coefficients[7].toFixed(3)),
      lagSameWeekday: Number(fullFit.coefficients[8].toFixed(3)),
    },
  };
}
```

- [ ] **Step 2: Extend `verify-analytics.mjs` to test it (failing state first)**

First, update the top-of-file imports (added in Task 1, Step 2) to add the four new ones this section needs — change:

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
```

to:

```javascript
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
```

Then append this block to `frontend/scripts/verify-analytics.mjs`, before the final `console.log("\nAll linear-regression.ts checks passed.")` line — rename that final line to `console.log("\nAll checks passed.")` since the script now covers more than one module, and insert the new section above it:

```javascript
console.log("\nTesting demand-forecast.ts...");

// demand-forecast.ts imports from ./linear-regression, so the plain data-URL
// trick (which has no filesystem context to resolve relative imports) can't
// be used directly. Transpile both to temp .mjs files on disk instead, so
// Node's real module resolution can follow the relative import.
const tempDir = await mkdtemp(path.join(tmpdir(), "kadaserve-verify-"));

try {
  const linearRegressionSource = await readFile(
    new URL("../src/lib/linear-regression.ts", import.meta.url),
    "utf8"
  );
  const demandForecastSource = await readFile(
    new URL("../src/lib/demand-forecast.ts", import.meta.url),
    "utf8"
  );

  const linearRegressionPath = path.join(tempDir, "linear-regression.mjs");
  const demandForecastPath = path.join(tempDir, "demand-forecast.mjs");

  await writeFile(linearRegressionPath, transpile(linearRegressionSource), "utf8");
  await writeFile(
    demandForecastPath,
    transpile(demandForecastSource).replace('"./linear-regression"', '"./linear-regression.mjs"'),
    "utf8"
  );

  const { fillDailySeries, addDays, generateDemandForecast, MIN_HISTORY_DAYS } = await import(
    pathToFileURL(demandForecastPath).href
  );

  // addDays basic correctness, including month rollover
  {
    assert.equal(addDays("2026-05-31", 1), "2026-06-01");
    assert.equal(addDays("2026-06-01", -1), "2026-05-31");
    console.log("  PASS: addDays handles month rollover both directions");
  }

  // fillDailySeries fills gaps with zero
  {
    const sparse = new Map([["2026-01-01", 5], ["2026-01-03", 2]]);
    const series = fillDailySeries(sparse, "2026-01-01", "2026-01-03");
    assert.deepEqual(
      series,
      [
        { date: "2026-01-01", orderCount: 5 },
        { date: "2026-01-02", orderCount: 0 },
        { date: "2026-01-03", orderCount: 2 },
      ]
    );
    console.log("  PASS: fillDailySeries zero-fills missing dates");
  }

  // Guardrail: too-short series returns null, not a crash
  {
    const shortSeries = Array.from({ length: MIN_HISTORY_DAYS - 1 }, (_, index) => ({
      date: addDays("2026-01-01", index),
      orderCount: 3,
    }));
    const result = generateDemandForecast(shortSeries);
    assert.equal(result, null);
    console.log("  PASS: generateDemandForecast returns null below MIN_HISTORY_DAYS");
  }

  // Realistic series (30 days, weekday pattern + mild trend) produces a
  // sane forecast and diagnostics, and beats or matches the naive baseline
  // on this clean synthetic signal.
  {
    const series = Array.from({ length: 30 }, (_, index) => {
      const date = addDays("2026-01-01", index);
      const dayOfWeek = new Date(`${date}T00:00:00+08:00`).getDay();
      const weekendBoost = dayOfWeek === 0 || dayOfWeek === 6 ? 5 : 0;
      const trend = index * 0.2;
      return { date, orderCount: Math.round(10 + weekendBoost + trend) };
    });

    const result = generateDemandForecast(series);

    assert.ok(result !== null, "expected a forecast result for a well-formed 30-day series");
    assert.equal(result.forecast.length, 7);
    result.forecast.forEach((point) => {
      assert.ok(point.predictedOrders >= 0, "forecast must not be negative");
    });
    assert.ok(
      result.diagnostics.rmse <= result.diagnostics.baselineRmse + 1,
      `expected model RMSE (${result.diagnostics.rmse}) to be competitive with naive baseline (${result.diagnostics.baselineRmse})`
    );
    console.log("  PASS: generateDemandForecast produces a sane 7-day forecast with non-negative values");
    console.log(`  INFO: model RMSE=${result.diagnostics.rmse}, baseline RMSE=${result.diagnostics.baselineRmse}, R2=${result.diagnostics.rSquared}, DW=${result.diagnostics.durbinWatson}`);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
```

Also change the module-level `import { readFile } from "node:fs/promises";` near the top of the file to `import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";` so it isn't imported twice.

- [ ] **Step 3: Run to verify it fails**

Run: `cd frontend && node scripts/verify-analytics.mjs`
Expected: FAIL — `Cannot find module '.../demand-forecast.ts'` (Step 1's file doesn't exist yet if you run steps in strict failing-first order; since both steps are provided together above, instead verify failure by temporarily renaming `demand-forecast.ts` to confirm the script surfaces a clear file-not-found error, then rename it back).

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && node scripts/verify-analytics.mjs`
Expected: exits 0, prints all PASS lines including the demand-forecast.ts section, ending in `All checks passed.`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/demand-forecast.ts frontend/scripts/verify-analytics.mjs
git commit -m "feat: add dynamic-regression demand forecasting module"
```

---

### Task 3: Extract statistical peak-hour intensity (`peak-hour-intensity.ts`)

**Files:**
- Create: `frontend/src/lib/peak-hour-intensity.ts`
- Modify: `frontend/src/app/api/admin/analytics/peak-hours/route.ts:137-157,192-203` (per current file contents — see Step 3 below for exact before/after)
- Modify: `frontend/scripts/verify-analytics.mjs`

**Interfaces:**
- Produces: `type PeakHourIntensity = "high" | "medium" | "low"`, `getMean(values: number[]): number`, `getStandardDeviation(values: number[], mean: number): number`, `classifyIntensity(orderCount: number, mean: number, standardDeviation: number): PeakHourIntensity`. Consumed by `peak-hours/route.ts`.

- [ ] **Step 1: Write `peak-hour-intensity.ts`**

```typescript
// frontend/src/lib/peak-hour-intensity.ts

export type PeakHourIntensity = "high" | "medium" | "low";

export function getMean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getStandardDeviation(values: number[], mean: number): number {
  if (values.length === 0) {
    return 0;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

export function classifyIntensity(
  orderCount: number,
  mean: number,
  standardDeviation: number
): PeakHourIntensity {
  if (orderCount <= 0) {
    return "low";
  }

  if (orderCount >= mean + standardDeviation) {
    return "high";
  }

  if (orderCount >= mean) {
    return "medium";
  }

  return "low";
}
```

- [ ] **Step 2: Extend `verify-analytics.mjs`**

Append before the final `console.log("\nAll checks passed.")` line:

```javascript
console.log("\nTesting peak-hour-intensity.ts...");

const { getMean, getStandardDeviation, classifyIntensity } = await importDataUrlModule(
  "../src/lib/peak-hour-intensity.ts"
);

{
  const values = [2, 4, 4, 4, 5, 5, 7, 9];
  const mean = getMean(values);
  const stdDev = getStandardDeviation(values, mean);

  assert.equal(mean, 5);
  assert.ok(Math.abs(stdDev - 2) < 1e-9, `expected stdDev 2, got ${stdDev}`);
  console.log("  PASS: getMean/getStandardDeviation match hand-computed population stats");

  assert.equal(classifyIntensity(0, mean, stdDev), "low");
  assert.equal(classifyIntensity(4, mean, stdDev), "low");
  assert.equal(classifyIntensity(5, mean, stdDev), "medium");
  assert.equal(classifyIntensity(7, mean, stdDev), "high");
  console.log("  PASS: classifyIntensity buckets correctly at mean and mean+stdDev boundaries");
}
```

- [ ] **Step 3: Run to verify it fails, then implement route.ts changes, then verify it passes**

Run: `cd frontend && node scripts/verify-analytics.mjs`
Expected at this point: FAIL — `peak-hour-intensity.ts` not found (if Step 1 hasn't been applied yet; both are given together above so confirm by temporarily renaming the file, then restore).

Now update `frontend/src/app/api/admin/analytics/peak-hours/route.ts`:

Add the import near the top (after the existing imports):

```typescript
import { classifyIntensity, getMean, getStandardDeviation } from "@/lib/peak-hour-intensity";
```

Delete the existing `getIntensity` function (currently lines 137-157):

```typescript
function getIntensity(orderCount: number, maxOrderCount: number) {
  if (orderCount <= 0) {
    return "low";
  }

  const ratio = orderCount / Math.max(1, maxOrderCount);

  if (ratio >= 0.8) {
    return "high";
  }

  if (ratio >= 0.5) {
    return "high";
  }

  if (ratio >= 0.25) {
    return "medium";
  }

  return "low";
}
```

In `buildPeakHourWindows`, replace this block:

```typescript
  const detectedAt = new Date().toISOString();
  const buckets = Array.from(monthlyBuckets.values());
  const maxOrderCount = Math.max(
    1,
    ...buckets.map((bucket) => bucket.totalOrderCount)
  );

  return buckets
    .map((bucket) => ({
      day_of_week: bucket.dayOfWeek,
      hour_start: bucket.hourStart,
      hour_end: (bucket.hourStart + 1) % 24,
      avg_order_count: Number(bucket.totalOrderCount.toFixed(2)),
      intensity: getIntensity(bucket.totalOrderCount, maxOrderCount),
      detected_at: detectedAt,
    }))
```

with:

```typescript
  const detectedAt = new Date().toISOString();
  const buckets = Array.from(monthlyBuckets.values());
  const bucketCounts = buckets.map((bucket) => bucket.totalOrderCount);
  const meanOrderCount = getMean(bucketCounts);
  const standardDeviation = getStandardDeviation(bucketCounts, meanOrderCount);

  return buckets
    .map((bucket) => ({
      day_of_week: bucket.dayOfWeek,
      hour_start: bucket.hourStart,
      hour_end: (bucket.hourStart + 1) % 24,
      avg_order_count: Number(bucket.totalOrderCount.toFixed(2)),
      intensity: classifyIntensity(bucket.totalOrderCount, meanOrderCount, standardDeviation),
      detected_at: detectedAt,
    }))
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && node scripts/verify-analytics.mjs`
Expected: all PASS lines including peak-hour-intensity.ts section.

- [ ] **Step 5: Typecheck the route change**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (confirms `getIntensity`'s only call site was the one just replaced, and the new import resolves).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/peak-hour-intensity.ts frontend/scripts/verify-analytics.mjs frontend/src/app/api/admin/analytics/peak-hours/route.ts
git commit -m "refactor: extract statistical peak-hour intensity classification"
```

---

### Task 4: Demand forecast API route

**Files:**
- Create: `frontend/src/app/api/admin/analytics/demand-forecast/route.ts`

**Interfaces:**
- Consumes: `fillDailySeries`, `generateDemandForecast`, `MIN_HISTORY_DAYS`, `type DailyOrderCount` from `@/lib/demand-forecast` (Task 2).
- Produces: `GET` handler returning JSON shape consumed by Task 6 (`admin-dashboard.tsx`): `{ forecast: Array<{date, predictedOrders}> | null; diagnostics?: {...}; coefficients?: {...}; history?: Array<{date, orderCount}>; reason?: string }` or `{ error: string }` on failure.

- [ ] **Step 1: Write the route**

```typescript
// frontend/src/app/api/admin/analytics/demand-forecast/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fillDailySeries, generateDemandForecast, MIN_HISTORY_DAYS } from "@/lib/demand-forecast";

type AnalyticsOrderRow = {
  ordered_at: string;
  status: string;
};

const ANALYTICS_TIME_ZONE = "Asia/Manila";

function formatDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

async function assertAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return { error: NextResponse.json({ error: profileError.message }, { status: 500 }) };
  }

  if (!profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase };
}

export async function GET() {
  try {
    const access = await assertAdminAccess();
    if ("error" in access) {
      return access.error;
    }

    const { supabase } = access;
    const { data: orders, error } = await supabase
      .from("orders")
      .select("ordered_at, status")
      .neq("status", "cancelled")
      .neq("status", "expired")
      .order("ordered_at", { ascending: true })
      .returns<AnalyticsOrderRow[]>();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ forecast: null, reason: "No order history yet." });
    }

    const dailyCounts = new Map<string, number>();
    orders.forEach((order) => {
      const dateKey = formatDateKey(order.ordered_at);
      dailyCounts.set(dateKey, (dailyCounts.get(dateKey) ?? 0) + 1);
    });

    const sortedDates = Array.from(dailyCounts.keys()).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];
    const series = fillDailySeries(dailyCounts, startDate, endDate);

    if (series.length < MIN_HISTORY_DAYS) {
      return NextResponse.json({
        forecast: null,
        reason: `Not enough order history yet for a forecast (need ${MIN_HISTORY_DAYS} days, have ${series.length}).`,
      });
    }

    const result = generateDemandForecast(series);

    if (!result) {
      return NextResponse.json({
        forecast: null,
        reason: "Could not fit a forecast model to the available data.",
      });
    }

    return NextResponse.json({
      forecast: result.forecast,
      diagnostics: result.diagnostics,
      coefficients: result.coefficients,
      history: series.slice(-30),
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while generating the demand forecast." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manually verify against the real dev server and real data**

Start the dev server (`npm run dev` in `frontend/`), log in as admin (`admin@kadaserve.ph`), then in the browser console or via curl with the session cookie:

```bash
curl -s http://localhost:3000/api/admin/analytics/demand-forecast -H "Cookie: <copy from browser devtools>"
```

Expected: JSON with a 7-entry `forecast` array, `diagnostics.trainingDays`/`testDays` summing to roughly 25 (real data is 32 days, minus 7 lag warm-up), and `history` with up to 30 entries. This is the same live-data check style already used earlier in this project's development (curl with an authenticated session) — no new tooling needed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/api/admin/analytics/demand-forecast/route.ts
git commit -m "feat: add admin demand-forecast API route"
```

---

### Task 5: Fix the hardcoded "this month" default (empty-state bug)

**Files:**
- Modify: `frontend/src/lib/admin-order-totals.ts:157-159` (`getAdminOrdersMetricLabel`)
- Modify: `frontend/src/features/admin/components/admin-dashboard.tsx:546-550` (`dashboardTimeFilter`, `dashboardOrders`)

**Interfaces:**
- Consumes: `getAdminReportOrders`, `getManilaDateOnly`, `getAdminReportRangeLabel` (existing, from `admin-order-totals.ts`).
- Produces: `getAdminOrdersMetricLabel(timeFilter, customStartDate?, customEndDate?)` (extended signature — same name, now takes two more optional args). `dashboardTimeFilter` in `admin-dashboard.tsx` becomes a computed `{ timeFilter, customStartDate, customEndDate }` object instead of a hardcoded literal — this shape is only used internally in that file, not exported.

- [ ] **Step 1: Extend `getAdminOrdersMetricLabel` to accept custom dates**

In `frontend/src/lib/admin-order-totals.ts`, replace:

```typescript
export function getAdminOrdersMetricLabel(timeFilter: AdminTimeFilter) {
  return `${getAdminReportRangeLabel(timeFilter)} Orders`;
}
```

with:

```typescript
export function getAdminOrdersMetricLabel(
  timeFilter: AdminTimeFilter,
  customStartDate?: string,
  customEndDate?: string
) {
  return `${getAdminReportRangeLabel(timeFilter, customStartDate, customEndDate)} Orders`;
}
```

- [ ] **Step 2: Compute a data-aware default in `admin-dashboard.tsx`**

Replace (currently lines 546-550):

```typescript
  const dashboardTimeFilter = "month" as const;
  const dashboardOrders = useMemo(
    () => getAdminReportOrders(validOrders, { timeFilter: dashboardTimeFilter }),
    [validOrders]
  );
```

with:

```typescript
  const dashboardRange = useMemo(() => {
    const currentMonthOrders = getAdminReportOrders(validOrders, { timeFilter: "month" });

    if (currentMonthOrders.length > 0) {
      return {
        timeFilter: "month" as const,
        customStartDate: undefined as string | undefined,
        customEndDate: undefined as string | undefined,
      };
    }

    const mostRecentOrder = [...validOrders].sort(
      (left, right) => new Date(right.ordered_at).getTime() - new Date(left.ordered_at).getTime()
    )[0];

    if (!mostRecentOrder) {
      return {
        timeFilter: "month" as const,
        customStartDate: undefined as string | undefined,
        customEndDate: undefined as string | undefined,
      };
    }

    const recentDate = getManilaDateOnly(new Date(mostRecentOrder.ordered_at));
    const firstDayOfMonth = new Date(recentDate.getFullYear(), recentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(recentDate.getFullYear(), recentDate.getMonth() + 1, 0);
    const toDateInput = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;

    return {
      timeFilter: "custom" as const,
      customStartDate: toDateInput(firstDayOfMonth),
      customEndDate: toDateInput(lastDayOfMonth),
    };
  }, [validOrders]);
  const dashboardOrders = useMemo(
    () =>
      getAdminReportOrders(validOrders, {
        timeFilter: dashboardRange.timeFilter,
        customStartDate: dashboardRange.customStartDate,
        customEndDate: dashboardRange.customEndDate,
      }),
    [validOrders, dashboardRange]
  );
```

- [ ] **Step 3: Import `getManilaDateOnly`**

In `frontend/src/features/admin/components/admin-dashboard.tsx`, update the existing import (currently lines 30-35):

```typescript
import {
  getAdminOrderTotals,
  getAdminOrdersMetricLabel,
  getAdminReportOrders,
  isValidAdminOrder,
} from "@/lib/admin-order-totals";
```

to:

```typescript
import {
  getAdminOrderTotals,
  getAdminOrdersMetricLabel,
  getAdminReportOrders,
  getManilaDateOnly,
  isValidAdminOrder,
} from "@/lib/admin-order-totals";
```

- [ ] **Step 4: Update the label call site to pass the custom dates**

Replace (currently line 862):

```typescript
  const dashboardTotalOrdersLabel = getAdminOrdersMetricLabel(dashboardTimeFilter);
```

with:

```typescript
  const dashboardTotalOrdersLabel = getAdminOrdersMetricLabel(
    dashboardRange.timeFilter,
    dashboardRange.customStartDate,
    dashboardRange.customEndDate
  );
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manually verify against real data**

Start the dev server, log in as admin. Since real order data ends 2026-05-31 and "today" is past that month, the Dashboard tab's KPI tiles should now show May 2026's real totals (48+ orders, nonzero revenue) instead of "0 orders" for the current empty month, and the header label should read "May 2026 Orders" instead of a generic empty state.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/admin-order-totals.ts frontend/src/features/admin/components/admin-dashboard.tsx
git commit -m "fix: default admin dashboard to most recent period with data"
```

---

### Task 6: Wire the demand-forecast fetch into `admin-dashboard.tsx`

**Files:**
- Modify: `frontend/src/features/admin/components/admin-dashboard.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/analytics/demand-forecast` (Task 4).
- Produces: `demandForecast` state of type `AdminAnalyticsDemandForecastResult | null`, passed as a new prop to `DashboardView` (consumed by Task 7).

- [ ] **Step 1: Add the result type**

Near the other `type AdminAnalytics*Row` declarations (after the `AdminAnalyticsItemRow` type, currently ending around line 248), add:

```typescript
type AdminAnalyticsDemandForecastResult = {
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
```

- [ ] **Step 2: Add state**

Near the other `useState` declarations for analytics (e.g. next to wherever `analyticsWeekly`'s `useState` is declared, around line 520), add:

```typescript
  const [demandForecast, setDemandForecast] = useState<AdminAnalyticsDemandForecastResult>(null);
```

- [ ] **Step 3: Add the fetch call**

In `loadAdminData`, add `"/api/admin/analytics/demand-forecast"` to the `Promise.all` fetch array (currently lines 1210-1226):

```typescript
      const [
        ordersResponse,
        menuResponse,
        feedbackResponse,
        analyticsHourlyResponse,
        analyticsWeeklyResponse,
        analyticsItemsResponse,
        peakHourWindowsResponse,
        demandForecastResponse,
      ] = await Promise.all([
        fetch("/api/staff/orders/list", { method: "GET" }),
        fetch("/api/admin/menu", { method: "GET" }),
        fetch("/api/feedback", { method: "GET" }),
        fetch("/api/admin/analytics/hourly", { method: "GET" }),
        fetch("/api/admin/analytics/weekly", { method: "GET" }),
        fetch("/api/admin/analytics/items", { method: "GET" }),
        fetch("/api/admin/analytics/peak-hours?range=month", { method: "GET" }),
        fetch("/api/admin/analytics/demand-forecast", { method: "GET" }),
      ]);
```

Add response parsing after the existing `peakHourWindowsResult` parsing (currently lines 1244-1247):

```typescript
      type DemandForecastResponseBody = NonNullable<AdminAnalyticsDemandForecastResult>;
      const demandForecastResult = (await demandForecastResponse.json()) as {
        forecast?: DemandForecastResponseBody["forecast"];
        diagnostics?: DemandForecastResponseBody["diagnostics"];
        coefficients?: DemandForecastResponseBody["coefficients"];
        history?: DemandForecastResponseBody["history"];
        reason?: string;
        error?: string;
      };
```

Add state assignment after the existing `setAnalyticsItems`/peak-hour-windows handling block (find where `analyticsItemsResponse.ok` is checked, currently around lines 1290-1294, and add this pattern immediately after it, before the function's closing):

```typescript
      if (
        demandForecastResponse.ok &&
        demandForecastResult.forecast &&
        demandForecastResult.diagnostics &&
        demandForecastResult.coefficients &&
        demandForecastResult.history
      ) {
        setDemandForecast({
          forecast: demandForecastResult.forecast,
          diagnostics: demandForecastResult.diagnostics,
          coefficients: demandForecastResult.coefficients,
          history: demandForecastResult.history,
        });
      } else {
        setDemandForecast(null);
      }
```

- [ ] **Step 4: Pass it to `DashboardView`**

In the `<DashboardView ... />` call (currently lines 1738-1757), add:

```typescript
                weekdayCounts={dashboardMetrics.weekdayCounts}
                demandForecast={demandForecast}
```

(insert the new line immediately after the existing `weekdayCounts` prop line).

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: errors about `demandForecast` not being an accepted prop on `DashboardView` — this is expected until Task 7 adds it. Confirm the error is exactly that (not something else, like a typo), then proceed to Task 7 before committing this task.

- [ ] **Step 6: Commit (after Task 7 makes typecheck pass — see Task 7 Step 4)**

This task's commit is combined with Task 7's, since `tsc` won't pass until both land together. Proceed directly to Task 7.

---

### Task 7: Demand forecast chart UI (`DemandForecastChart` in `admin-overview-view.tsx`)

**Files:**
- Modify: `frontend/src/features/admin/components/admin-overview-view.tsx`

**Interfaces:**
- Consumes: `demandForecast` prop of the same `AdminAnalyticsDemandForecastResult` shape defined in Task 6 (structurally — this file does not import that type name, it defines its own matching inline prop type, since `admin-overview-view.tsx` doesn't currently import types from `admin-dashboard.tsx` and shouldn't start now).
- Produces: new prop `demandForecast` on `DashboardView`.

- [ ] **Step 1: Add the `DemandForecastChart` component**

Add this new function immediately after `OrdersByDayBarChart` (which currently ends at line 726, right before the blank line leading into whatever comes next):

```typescript
function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T00:00:00+08:00`));
}

function DemandForecastChart({
  history,
  forecast,
  rmse,
}: {
  history: Array<{ date: string; orderCount: number }>;
  forecast: Array<{ date: string; predictedOrders: number }>;
  rmse: number;
}) {
  const width = 760;
  const height = 200;
  const padding = { top: 22, right: 30, bottom: 34, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const historyPoints = history.map((point) => ({ date: point.date, value: point.orderCount }));
  const forecastPoints = forecast.map((point) => ({ date: point.date, value: point.predictedOrders }));
  const allPoints = [...historyPoints, ...forecastPoints];
  const maxValue = Math.max(1, ...allPoints.map((point) => point.value + rmse));

  const toCoordinates = (points: typeof allPoints, startIndex: number) =>
    points.map((point, index) => {
      const globalIndex = startIndex + index;
      const x =
        allPoints.length === 1
          ? width / 2
          : padding.left + (innerWidth * globalIndex) / (allPoints.length - 1);
      const y = padding.top + innerHeight - (point.value / maxValue) * innerHeight;

      return { ...point, x, y };
    });

  const historyCoordinates = toCoordinates(historyPoints, 0);
  const forecastCoordinates = toCoordinates(forecastPoints, historyPoints.length);
  const bridgePoint = historyCoordinates.at(-1);
  const forecastLineCoordinates = bridgePoint ? [bridgePoint, ...forecastCoordinates] : forecastCoordinates;

  const buildLinePath = (points: Array<{ x: number; y: number }>) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  const historyLinePath = buildLinePath(historyCoordinates);
  const forecastLinePath = buildLinePath(forecastLineCoordinates);

  const toBandY = (value: number, offset: number) =>
    padding.top + innerHeight - (Math.min(maxValue, Math.max(0, value + offset)) / maxValue) * innerHeight;

  const bandPath =
    forecastLineCoordinates.length > 1
      ? [
          ...forecastLineCoordinates.map(
            (point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${toBandY(point.value, -rmse)}`
          ),
          ...[...forecastLineCoordinates].reverse().map((point) => `L ${point.x} ${toBandY(point.value, rmse)}`),
          "Z",
        ].join(" ")
      : "";

  const labelPoints = [...historyCoordinates, ...forecastCoordinates];
  const labelEvery = Math.max(1, Math.ceil(labelPoints.length / 8));

  return (
    <div className="mt-1 rounded-[14px] bg-[#FFFCF7] px-1 py-1">
      <svg
        aria-label="Demand forecast chart"
        className="h-[220px] w-full overflow-visible"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {bandPath ? <path d={bandPath} fill="rgba(104,75,53,0.14)" /> : null}
        {historyLinePath ? (
          <path
            d={historyLinePath}
            fill="none"
            stroke="#0D2E18"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        ) : null}
        {forecastLinePath ? (
          <path
            d={forecastLinePath}
            fill="none"
            stroke="#684B35"
            strokeDasharray="7 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        ) : null}
        {labelPoints.map((point, index) =>
          index % labelEvery === 0 ? (
            <text
              key={point.date}
              fill="#8C6C48"
              fontSize="11"
              fontWeight="800"
              textAnchor="middle"
              x={point.x}
              y={height - 10}
            >
              {formatShortDate(point.date)}
            </text>
          ) : null
        )}
      </svg>
      <div className="mt-1 flex items-center justify-center gap-4 font-sans text-[0.66rem] font-bold text-[#684B35]">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[#0D2E18]" /> Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full border-t-2 border-dashed border-[#684B35]" /> Forecast (±{rmse.toFixed(1)})
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the `demandForecast` prop to `DashboardView`**

In the `DashboardView` function signature (currently starting at line 1238), add `demandForecast` to both the destructured parameter list and its type:

```typescript
  weekdayCounts,
  isLoading = false,
  isRefreshing = false,
  demandForecast = null,
}: {
```

and to the type block:

```typescript
  weekdayCounts: Array<{ day: string; orders: number }>;
  isLoading?: boolean;
  isRefreshing?: boolean;
  demandForecast?: {
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
}) {
```

- [ ] **Step 3: Render the new panel**

Insert this new block immediately after the closing of the "Monthly Orders by Day and Hourly Demand" grid section (currently ending at line 1651 with `) : null}` followed by a blank line, right before the `{/* Top Items, Ratings, Insights, and Attention */}` comment at line 1653):

```tsx
      <div
        className="kada-admin-content-enter grid gap-3"
        style={{ animationDelay: "820ms" }}
      >
        <div id="admin-demand-forecast" className="scroll-mt-28">
          <Panel
            title="Demand Forecast"
            formulaTitle="Demand Forecast Formula"
            formula="Forecast = day-of-week + trend + same-weekday-last-week (multiple linear regression)"
            formulaExplanation={
              demandForecast
                ? `Model fit: R² ${demandForecast.diagnostics.rSquared}, RMSE ${demandForecast.diagnostics.rmse} orders (naive baseline RMSE ${demandForecast.diagnostics.baselineRmse}), Durbin-Watson ${demandForecast.diagnostics.durbinWatson}. Trained on ${demandForecast.diagnostics.trainingDays} days, tested on ${demandForecast.diagnostics.testDays}.`
                : "Not enough order history yet to fit a forecast."
            }
          >
            {demandForecast ? (
              <DemandForecastChart
                history={demandForecast.history}
                forecast={demandForecast.forecast}
                rmse={demandForecast.diagnostics.rmse}
              />
            ) : (
              <EmptyState label="Not enough order history yet for a demand forecast." />
            )}
          </Panel>
        </div>
      </div>
```

- [ ] **Step 4: Typecheck (this resolves Task 6's expected error too)**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. If there are errors, check that the `demandForecast` prop type here matches exactly the `AdminAnalyticsDemandForecastResult` shape added in Task 6, Step 1 — a mismatched field name (e.g. `predictedOrders` vs `predicted_orders`) is the most likely cause.

- [ ] **Step 5: Run the analytics verification script one more time (unaffected by this task, but confirms nothing else broke)**

Run: `cd frontend && npm run test:analytics`
Expected: all PASS lines, `All checks passed.`

- [ ] **Step 6: Manually verify in the browser**

Start the dev server, log in as admin, open the Dashboard tab. Scroll to the new "Demand Forecast" panel (between "Orders by Day"/"Orders by Hour" and "Top Sellers"). Expected, given real data (32 days, 2026-04-30 to 2026-05-31):
- A line chart with a solid dark-green historical line and a dashed brown 7-day forecast continuation, with a light shaded band around the forecast.
- Clicking the info icon next to "Demand Forecast" shows the R², RMSE, baseline RMSE, and Durbin-Watson stat in the tooltip.
- No console errors (check via browser devtools or the `read_console_messages` tool if working through the agent).

- [ ] **Step 7: Commit (Task 6 + Task 7 together, since they only typecheck as a pair)**

```bash
git add frontend/src/features/admin/components/admin-dashboard.tsx frontend/src/features/admin/components/admin-overview-view.tsx
git commit -m "feat: wire demand forecast into admin dashboard with SVG chart"
```

---

### Task 8: Final full verification pass

**Files:** none (verification only)

**Interfaces:** none — this task exercises everything built in Tasks 1-7 together.

- [ ] **Step 1: Full analytics verification script**

Run: `cd frontend && npm run test:analytics`
Expected: `All checks passed.`, zero non-zero exit code.

- [ ] **Step 2: Full project typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint the touched files**

Run: `cd frontend && npx eslint src/lib/linear-regression.ts src/lib/demand-forecast.ts src/lib/peak-hour-intensity.ts src/lib/admin-order-totals.ts src/app/api/admin/analytics/demand-forecast/route.ts src/app/api/admin/analytics/peak-hours/route.ts src/features/admin/components/admin-dashboard.tsx src/features/admin/components/admin-overview-view.tsx`
Expected: no errors.

- [ ] **Step 4: End-to-end browser walkthrough**

Start the dev server, log in as admin (`admin@kadaserve.ph`), and confirm all four pieces together:
1. Dashboard tab loads with May 2026 data by default (not an empty "0 orders" July state) — Task 5's fix.
2. The new "Demand Forecast" panel renders a chart with historical + forecasted data and a working diagnostics tooltip — Tasks 1, 2, 4, 6, 7.
3. Switch to the Demand tab, Peak Hours sub-view — confirm intensity labels (`high`/`medium`/`low`) still render sensibly (spot-check a couple of windows against the raw `avg_order_count` values shown) — Task 3.
4. No console errors anywhere in this walkthrough.

- [ ] **Step 5: Update the spec doc status line**

In `docs/superpowers/specs/2026-08-05-admin-ai-analytics-design.md`, change the `Status:` line from "Approved by user (2026-08-05), pending write-up review" to "Implemented (2026-08-05)".

- [ ] **Step 6: Final commit**

```bash
git add docs/superpowers/specs/2026-08-05-admin-ai-analytics-design.md
git commit -m "docs: mark admin AI analytics spec as implemented"
```



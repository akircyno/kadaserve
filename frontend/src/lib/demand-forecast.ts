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

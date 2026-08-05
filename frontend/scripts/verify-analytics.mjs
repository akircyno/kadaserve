import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
  // For perfectly alternating residuals, DW = 20/6 = 3.333...
  assert.ok(Math.abs(dw - 20 / 6) < 1e-6, `expected DW = 20/6 for alternating residuals, got ${dw}`);
  console.log("  PASS: calculateDurbinWatson detects negative autocorrelation");
}

// R-squared: zero-variance target (constant values) with perfect fit => 1
{
  const target = [5, 5, 5, 5];
  const fittedValues = [5, 5, 5, 5];
  const rSquared = calculateRSquared(target, fittedValues);
  assert.equal(rSquared, 1, `expected R² = 1 for constant target with perfect fit, got ${rSquared}`);
  assert.ok(!isNaN(rSquared), `expected R² to be a number, not NaN`);
  console.log("  PASS: calculateRSquared handles zero-variance target correctly");
}

// Error handling: singular design matrix (linearly dependent columns)
{
  const designMatrix = [
    [1, 0],  // column 2 is all zeros, making X^T*X singular
    [2, 0],
    [3, 0],
  ];
  const target = [1, 2, 3];
  assert.throws(
    () => fitOls(designMatrix, target),
    /singular/i,
    "expected fitOls to throw on singular design matrix"
  );
  console.log("  PASS: fitOls throws on singular design matrix");
}

// Error handling: mismatched dimensions
{
  const designMatrix = [
    [1, 0],
    [1, 1],
    [1, 2],
  ];
  const target = [1, 2];  // only 2 values but 3 rows in design matrix
  assert.throws(
    () => fitOls(designMatrix, target),
    /must match/i,
    "expected fitOls to throw on dimension mismatch"
  );
  console.log("  PASS: fitOls throws on mismatched dimensions");
}

// Error handling: empty design matrix
{
  const designMatrix = [];
  const target = [];
  assert.throws(
    () => fitOls(designMatrix, target),
    /zero observations/i,
    "expected fitOls to throw on empty inputs"
  );
  console.log("  PASS: fitOls throws on zero observations");
}

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

console.log("\nAll checks passed.");

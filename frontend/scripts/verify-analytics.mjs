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

console.log("\nAll linear-regression.ts checks passed.");

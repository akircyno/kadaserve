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

console.log("Testing item-action-insights.ts...");

const { buildItemActionInsights } = await importDataUrlModule(
  "../src/lib/item-action-insights.ts"
);

// Data guard: below MIN_TOTAL_ORDERS (20) returns nothing, even with a
// clearly struggling item.
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 4.5 },
      { item: "Struggler", orders: 1, rating: 4.5 },
    ],
    true,
    19
  );
  assert.deepEqual(result, []);
  console.log("  PASS: totalOrders below the minimum returns no insights");
}

// Low-demand boundary: item at exactly 50% of average (avg=10, item=5) is
// NOT flagged (strict <).
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 4.5 },
      { item: "Boundary", orders: 5, rating: 4.5 },
    ],
    true,
    20
  );
  assert.deepEqual(result, []);
  console.log("  PASS: item at exactly 50% of average is not flagged (strict boundary)");
}

// Low-demand, just below boundary: avg=9.5, Struggler=4 (ratio ~0.421) IS
// flagged. Rating 4.5 >= 4.0 -> the "customers who try it like it" bucket.
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 4.5 },
      { item: "Struggler", orders: 4, rating: 4.5 },
    ],
    true,
    20
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].icon, "TrendingDown");
  assert.equal(result[0].type, "info");
  assert.ok(result[0].description.includes("Struggler"));
  assert.ok(result[0].description.includes("bundle it with a bestseller"));
  console.log("  PASS: low demand + good real rating suggests feature/bundle/recommend");
}

// Low-demand + low rating (< 4.0) -> quality-review warning bucket.
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 4.5 },
      { item: "Struggler", orders: 4, rating: 3.2 },
    ],
    true,
    20
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "warning");
  assert.ok(result[0].description.includes("reviewing the recipe or quality"));
  console.log("  PASS: low demand + low real rating suggests a quality review (warning)");
}

// Low-demand + no real rating data at all -> "not enough feedback" bucket,
// regardless of whatever placeholder rating value is passed in.
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 0 },
      { item: "Struggler", orders: 4, rating: 0 },
    ],
    false,
    20
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "info");
  assert.ok(result[0].description.includes("Not enough feedback to diagnose"));
  console.log("  PASS: no real rating data suggests a promo to gather feedback");
}

// Regression test: the fabricated fallback rating formula in
// admin-dashboard.tsx produces values in the 3.8-4.8 range purely from order
// count (Math.min(4.8, 3.8 + orders / 20)) -- NOT real customer sentiment.
// With hasRealRatingData: false, a rating in that exact range must still
// produce the "not enough feedback" message, never the "customers like it"
// message -- otherwise the suggestion would be circular (explaining low
// demand using a number that is itself derived from order count).
{
  const result = buildItemActionInsights(
    [
      { item: "Anchor", orders: 15, rating: 4.6 },
      { item: "Struggler", orders: 4, rating: 4.4 },
    ],
    false,
    20
  );
  assert.equal(result.length, 1);
  assert.ok(
    result[0].description.includes("Not enough feedback to diagnose"),
    `expected the fallback-rating case to say "not enough feedback", got: ${result[0].description}`
  );
  assert.ok(!result[0].description.includes("like it"));
  console.log("  PASS: fabricated fallback rating never produces a false 'customers like it' message");
}

// High-demand boundary: 5 base items at 20 (diluting their own ratio so they
// stay safely inside the normal band) + one item at exactly 2x the average
// (avg=25, item=50) is NOT flagged (strict >).
{
  const baseItems = Array.from({ length: 5 }, (_, index) => ({
    item: `Base${index + 1}`,
    orders: 20,
    rating: 4.2,
  }));
  const result = buildItemActionInsights(
    [...baseItems, { item: "Popular", orders: 50, rating: 4.2 }],
    true,
    20
  );
  assert.deepEqual(result, []);
  console.log("  PASS: item at exactly 200% of average is not flagged (strict boundary)");
}

// High-demand, just above boundary: same base items, Popular=51 (ratio
// ~2.026) IS flagged, with a stock-up suggestion.
{
  const baseItems = Array.from({ length: 5 }, (_, index) => ({
    item: `Base${index + 1}`,
    orders: 20,
    rating: 4.2,
  }));
  const result = buildItemActionInsights(
    [...baseItems, { item: "Popular", orders: 51, rating: 4.2 }],
    true,
    20
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].icon, "Flame");
  assert.equal(result[0].type, "info");
  assert.ok(result[0].description.includes("Popular"));
  assert.ok(result[0].description.includes("cups"));
  console.log("  PASS: item just above 200% of average is flagged with a stock-up suggestion");
}

// Cap and priority: 5 base items at 20 (dilution) + Struggler(1), MildLow(9),
// Popular(60). avg=21.25. Deviations: Popular=38.75, Struggler=20.25,
// MildLow=12.25. Only the top 2 by deviation should be returned, regardless
// of direction, and MildLow (the smallest deviation) must be excluded.
{
  const baseItems = Array.from({ length: 5 }, (_, index) => ({
    item: `Base${index + 1}`,
    orders: 20,
    rating: 4.2,
  }));
  const result = buildItemActionInsights(
    [
      ...baseItems,
      { item: "Struggler", orders: 1, rating: 4.2 },
      { item: "MildLow", orders: 9, rating: 4.2 },
      { item: "Popular", orders: 60, rating: 4.2 },
    ],
    true,
    20
  );
  assert.equal(result.length, 2);
  assert.ok(result[0].description.includes("Popular"), "largest deviation (Popular) should be first");
  assert.ok(result[1].description.includes("Struggler"), "second-largest deviation (Struggler) should be second");
  assert.ok(
    !result.some((insight) => insight.description.includes("MildLow")),
    "MildLow has the smallest deviation and should be excluded by the cap"
  );
  console.log("  PASS: cap keeps only the 2 largest deviations, mixing low and high demand");
}

console.log("\nAll item-action-insights.ts checks passed.");

// frontend/scripts/verify-recommendations.mjs
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

console.log("Testing item-similarity.ts...");

const {
  cosineSimilarity,
  significanceWeight,
  computeItemNeighbors,
  predictCandidateScore,
} = await importDataUrlModule("../src/lib/item-similarity.ts");

// cosineSimilarity: known-answer check
{
  const sim = cosineSimilarity([1, 0, 1], [1, 1, 0]);
  // dot = 1, normA = sqrt(2), normB = sqrt(2) => 1/2 = 0.5
  assert.ok(Math.abs(sim - 0.5) < 1e-9, `expected 0.5, got ${sim}`);
  console.log("  PASS: cosineSimilarity matches hand-computed value");
}

// cosineSimilarity: zero vector -> 0, not NaN
{
  const sim = cosineSimilarity([0, 0, 0], [1, 2, 3]);
  assert.equal(sim, 0);
  console.log("  PASS: cosineSimilarity returns 0 (not NaN) for a zero vector");
}

// significanceWeight: shrinks toward 0 as support drops, collapses the pathological n=1 case
{
  const highSupport = significanceWeight(0.85, 4, 3);
  const lowSupport = significanceWeight(0.85, 1, 3);
  assert.ok(highSupport > lowSupport, "higher support should score higher after weighting");
  const pathological = significanceWeight(1.0, 1, 3);
  assert.ok(Math.abs(pathological - 0.25) < 1e-9, `expected 1.0 * 1/4 = 0.25, got ${pathological}`);
  console.log("  PASS: significanceWeight shrinks low-support pairs, collapses the n=1 pathological case");
}

// computeItemNeighbors: small known matrix, higher support outranks lower support
{
  const records = [
    { customerId: "c1", itemId: "A", quantity: 1 },
    { customerId: "c1", itemId: "B", quantity: 1 },
    { customerId: "c2", itemId: "A", quantity: 1 },
    { customerId: "c2", itemId: "B", quantity: 1 },
    { customerId: "c3", itemId: "A", quantity: 1 },
    { customerId: "c3", itemId: "C", quantity: 1 },
  ];
  const neighbors = computeItemNeighbors(records, 3);

  const aNeighbors = neighbors.get("A");
  assert.equal(aNeighbors.length, 2);
  assert.equal(aNeighbors[0].itemId, "B");
  assert.equal(aNeighbors[0].support, 2);
  assert.equal(aNeighbors[1].itemId, "C");
  assert.equal(aNeighbors[1].support, 1);

  const bNeighbors = neighbors.get("B");
  assert.ok(!bNeighbors.some((n) => n.itemId === "C"), "B and C never co-occur, should not be neighbors");

  console.log("  PASS: computeItemNeighbors ranks higher-support pairs above lower-support pairs");
}

// predictCandidateScore: sums weighted similarity * ahp score, tracks the driver pair
{
  const records = [
    { customerId: "c1", itemId: "A", quantity: 1 },
    { customerId: "c1", itemId: "B", quantity: 1 },
    { customerId: "c2", itemId: "A", quantity: 1 },
    { customerId: "c2", itemId: "B", quantity: 1 },
  ];
  const neighbors = computeItemNeighbors(records, 3);
  const ownedItemScores = new Map([["A", 0.8]]);
  const prediction = predictCandidateScore(neighbors, "B", ownedItemScores);

  assert.ok(prediction.score > 0, "expected a positive score for a real neighbor pair");
  assert.ok(prediction.driver !== null, "expected a driver to be identified");
  assert.equal(prediction.driver.ownedItemId, "A");
  assert.equal(prediction.driver.itemId, "B");

  const noSignal = predictCandidateScore(neighbors, "Z", ownedItemScores);
  assert.equal(noSignal.score, 0);
  assert.equal(noSignal.driver, null);

  console.log("  PASS: predictCandidateScore sums weighted contributions and identifies the driver pair");
}

// predictCandidateScore: minSupport structurally excludes low-support contributing
// pairs from the SUMMED score, not just from the driver-pair check. Candidate B has
// two contributing owned items: A (support=2, high) and C (support=1, low).
{
  const records = [
    { customerId: "c1", itemId: "A", quantity: 1 },
    { customerId: "c1", itemId: "B", quantity: 1 },
    { customerId: "c2", itemId: "A", quantity: 1 },
    { customerId: "c2", itemId: "B", quantity: 1 },
    { customerId: "c3", itemId: "C", quantity: 1 },
    { customerId: "c3", itemId: "B", quantity: 1 },
  ];
  const neighbors = computeItemNeighbors(records, 3);
  const ownedItemScores = new Map([["A", 0.8], ["C", 0.8]]);

  const unfiltered = predictCandidateScore(neighbors, "B", ownedItemScores);
  const filtered = predictCandidateScore(neighbors, "B", ownedItemScores, 2);
  const aOnly = predictCandidateScore(neighbors, "B", new Map([["A", 0.8]]));

  assert.ok(
    filtered.score < unfiltered.score,
    "minSupport=2 should exclude the C-B pair's contribution (support=1), producing a smaller score"
  );
  assert.ok(
    Math.abs(filtered.score - aOnly.score) < 1e-9,
    `filtered score should equal the high-support A-B contribution alone, got ${filtered.score} vs ${aOnly.score}`
  );
  assert.equal(filtered.driver.ownedItemId, "A", "the only surviving driver should be the high-support pair");

  console.log("  PASS: predictCandidateScore's minSupport excludes below-threshold pairs from the summed score, not just the driver");
}

console.log("\nTesting recommendations.ts CF integration...");

// recommendations.ts imports from ./item-similarity and ./recommendation-weights,
// both relative imports — the plain data-URL trick can't resolve those, so
// transpile all three to temp .mjs files on disk, same pattern used for
// demand-forecast.ts in the admin-analytics feature's verify-analytics.mjs.
const tempDir2 = await mkdtemp(path.join(tmpdir(), "kadaserve-verify-reco-"));

try {
  const itemSimilaritySource = await readFile(new URL("../src/lib/item-similarity.ts", import.meta.url), "utf8");
  const weightsSource = await readFile(new URL("../src/lib/recommendation-weights.ts", import.meta.url), "utf8");
  const recommendationsSource = await readFile(new URL("../src/lib/recommendations.ts", import.meta.url), "utf8");

  const itemSimilarityPath = path.join(tempDir2, "item-similarity.mjs");
  const weightsPath = path.join(tempDir2, "recommendation-weights.mjs");
  const recommendationsPath = path.join(tempDir2, "recommendations.mjs");

  await writeFile(itemSimilarityPath, transpile(itemSimilaritySource), "utf8");
  await writeFile(weightsPath, transpile(weightsSource), "utf8");
  await writeFile(
    recommendationsPath,
    transpile(recommendationsSource)
      .replace('"./recommendation-weights"', '"./recommendation-weights.mjs"')
      .replace('"./item-similarity"', '"./item-similarity.mjs"'),
    "utf8"
  );

  const { getRecommendationsForCustomer } = await import(pathToFileURL(recommendationsPath).href);

  // Two customers co-purchase Latte+Muffin; a third customer has only ever
  // ordered Latte. With CF enabled, Muffin should be discoverable for the
  // third customer even though they have never ordered it.
  const menuItems = [
    { id: "latte", name: "Latte", category: "coffee", price: 100, isAvailable: true },
    { id: "muffin", name: "Muffin", category: "pastry", price: 80, isAvailable: true },
    { id: "tea", name: "Tea", category: "non-coffee", price: 90, isAvailable: true },
  ];
  const now = new Date().toISOString();
  const orders = [
    { id: "o1", customerId: "c1", customerName: "C1", status: "completed", orderedAt: now, items: [{ menuItemId: "latte", name: "Latte", quantity: 1 }, { menuItemId: "muffin", name: "Muffin", quantity: 1 }] },
    { id: "o2", customerId: "c2", customerName: "C2", status: "completed", orderedAt: now, items: [{ menuItemId: "latte", name: "Latte", quantity: 1 }, { menuItemId: "muffin", name: "Muffin", quantity: 1 }] },
    { id: "o3", customerId: "c3", customerName: "C3", status: "completed", orderedAt: now, items: [{ menuItemId: "latte", name: "Latte", quantity: 3 }] },
  ];

  const withCf = getRecommendationsForCustomer({
    customerId: "c3",
    customerName: "C3",
    menuItems,
    orders,
    feedback: [],
    hourOfDay: 14,
    collaborativeLambda: 1, // low lambda so a support=2 pair clears threshold easily in this tiny fixture
  });
  const cfSlot = withCf.recommendations.find((r) => r.basis === "collaborative");
  assert.ok(cfSlot, "expected a collaborative-basis recommendation to appear for c3");
  assert.equal(cfSlot.item.id, "muffin");
  assert.equal(cfSlot.label, "Customers Also Enjoyed");
  assert.ok(cfSlot.reason.includes("Latte"), `expected reason to name the driver item, got: ${cfSlot.reason}`);
  console.log("  PASS: CF slot surfaces a never-ordered item backed by real cross-customer support");

  const withoutCf = getRecommendationsForCustomer({
    customerId: "c3",
    customerName: "C3",
    menuItems,
    orders,
    feedback: [],
    hourOfDay: 14,
    enableCollaborativeSlot: false,
  });
  assert.ok(
    !withoutCf.recommendations.some((r) => r.basis === "collaborative"),
    "enableCollaborativeSlot=false should suppress the CF slot"
  );
  console.log("  PASS: enableCollaborativeSlot=false suppresses the CF slot");

  assert.ok(
    !withCf.recommendations.some((r) => r.basis === "collaborative" && r.item.id === "latte"),
    "CF must not recommend an item the customer already ordered"
  );
  console.log("  PASS: CF slot never recommends an already-ordered item");
} finally {
  await rm(tempDir2, { recursive: true, force: true });
}

console.log("\nTesting recommendation-evaluation.ts...");

const tempDir3 = await mkdtemp(path.join(tmpdir(), "kadaserve-verify-eval-"));

try {
  const files = {
    "item-similarity.ts": "../src/lib/item-similarity.ts",
    "recommendation-weights.ts": "../src/lib/recommendation-weights.ts",
    "recommendations.ts": "../src/lib/recommendations.ts",
    "recommendation-evaluation.ts": "../src/lib/recommendation-evaluation.ts",
  };
  const sources = {};
  for (const [name, rel] of Object.entries(files)) {
    sources[name] = await readFile(new URL(rel, import.meta.url), "utf8");
  }

  const outPaths = {};
  for (const name of Object.keys(files)) {
    outPaths[name] = path.join(tempDir3, name.replace(".ts", ".mjs"));
  }

  await writeFile(outPaths["item-similarity.ts"], transpile(sources["item-similarity.ts"]), "utf8");
  await writeFile(outPaths["recommendation-weights.ts"], transpile(sources["recommendation-weights.ts"]), "utf8");
  await writeFile(
    outPaths["recommendations.ts"],
    transpile(sources["recommendations.ts"])
      .replace('"./recommendation-weights"', '"./recommendation-weights.mjs"')
      .replace('"./item-similarity"', '"./item-similarity.mjs"'),
    "utf8"
  );
  await writeFile(
    outPaths["recommendation-evaluation.ts"],
    transpile(sources["recommendation-evaluation.ts"]).replace('"./recommendations"', '"./recommendations.mjs"'),
    "utf8"
  );

  const {
    buildProtocolAScenarios,
    buildProtocolBScenarios,
    precisionAtK,
    recallAtK,
    runEvaluation,
  } = await import(pathToFileURL(outPaths["recommendation-evaluation.ts"]).href);

  // precisionAtK / recallAtK: hand-computed
  {
    const recommended = ["a", "b", "c"];
    const targets = new Set(["b"]);
    assert.ok(Math.abs(precisionAtK(recommended, targets, 3) - 1 / 3) < 1e-9);
    assert.equal(recallAtK(recommended, targets, 3), 1);
    assert.equal(recallAtK(["x", "y"], targets, 2), 0);
    console.log("  PASS: precisionAtK and recallAtK match hand-computed values");
  }

  // buildProtocolAScenarios: holds out the single most recent order
  {
    const orders = [
      { id: "o1", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-01T00:00:00Z", items: [{ menuItemId: "a", name: "A", quantity: 1 }] },
      { id: "o2", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-05T00:00:00Z", items: [{ menuItemId: "b", name: "B", quantity: 1 }] },
    ];
    const scenarios = buildProtocolAScenarios(orders);
    assert.equal(scenarios.length, 1);
    assert.equal(scenarios[0].customerId, "c1");
    assert.deepEqual([...scenarios[0].targetItemIds], ["b"]);
    assert.equal(scenarios[0].trainingOrders.length, 1);
    assert.equal(scenarios[0].trainingOrders[0].id, "o1");
    console.log("  PASS: buildProtocolAScenarios holds out the most recent order and keeps earlier history");
  }

  // buildProtocolAScenarios: customers with only 1 order are not evaluable
  {
    const orders = [
      { id: "o1", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-01T00:00:00Z", items: [{ menuItemId: "a", name: "A", quantity: 1 }] },
    ];
    assert.equal(buildProtocolAScenarios(orders).length, 0);
    console.log("  PASS: buildProtocolAScenarios skips customers with fewer than 2 orders");
  }

  // buildProtocolBScenarios: only a true singleton item is held out
  {
    const orders = [
      { id: "o1", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-01T00:00:00Z", items: [{ menuItemId: "a", name: "A", quantity: 1 }, { menuItemId: "b", name: "B", quantity: 1 }] },
      { id: "o2", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-05T00:00:00Z", items: [{ menuItemId: "a", name: "A", quantity: 1 }] },
    ];
    const scenarios = buildProtocolBScenarios(orders);
    assert.equal(scenarios.length, 1);
    assert.deepEqual([...scenarios[0].targetItemIds], ["b"]);
    const remainingItemIds = scenarios[0].trainingOrders.flatMap((o) => o.items.map((i) => i.menuItemId));
    assert.ok(!remainingItemIds.includes("b"), "held-out singleton must be fully removed from training history");
    assert.equal(remainingItemIds.filter((id) => id === "a").length, 2, "non-singleton item must be untouched");
    console.log("  PASS: buildProtocolBScenarios only holds out true singleton (never-repeated) items");
  }

  // buildProtocolBScenarios: no singleton item -> customer not evaluable
  {
    const orders = [
      { id: "o1", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-01T00:00:00Z", items: [{ menuItemId: "a", name: "A", quantity: 1 }] },
      { id: "o2", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-05T00:00:00Z", items: [{ menuItemId: "a", name: "A", quantity: 1 }] },
    ];
    assert.equal(buildProtocolBScenarios(orders).length, 0);
    console.log("  PASS: buildProtocolBScenarios skips customers with no true singleton item");
  }

  // buildProtocolBScenarios: a customer with exactly one distinct item (ordered
  // once, ever) has a "singleton" but zero remaining history after holdout —
  // this must NOT produce a scenario, since it can't discriminate between
  // strategies (all three fall through to the identical cold-start path).
  {
    const orders = [
      { id: "o1", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-01T00:00:00Z", items: [{ menuItemId: "a", name: "A", quantity: 1 }] },
    ];
    assert.equal(
      buildProtocolBScenarios(orders).length,
      0,
      "a customer whose entire history is a single distinct item must be excluded (would leave empty trainingOrders)"
    );
    console.log("  PASS: buildProtocolBScenarios skips customers with only one distinct item in their whole history");
  }

  // runEvaluation: end-to-end smoke test, all strategies/k produce bounded metrics
  {
    const menuItems = [
      { id: "a", name: "A", category: "coffee", price: 100, isAvailable: true },
      { id: "b", name: "B", category: "pastry", price: 80, isAvailable: true },
      { id: "c", name: "C", category: "coffee", price: 90, isAvailable: true },
    ];
    const orders = [
      { id: "o1", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-01T00:00:00Z", items: [{ menuItemId: "a", name: "A", quantity: 1 }] },
      { id: "o2", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-08T00:00:00Z", items: [{ menuItemId: "a", name: "A", quantity: 1 }] },
      { id: "o3", customerId: "c2", customerName: "C2", status: "completed", orderedAt: "2026-01-01T00:00:00Z", items: [{ menuItemId: "a", name: "A", quantity: 1 }, { menuItemId: "b", name: "B", quantity: 1 }] },
      { id: "o4", customerId: "c2", customerName: "C2", status: "completed", orderedAt: "2026-01-08T00:00:00Z", items: [{ menuItemId: "b", name: "B", quantity: 1 }] },
    ];
    const results = runEvaluation("A", orders, menuItems, [], [], [1, 3], 3);
    assert.equal(results.length, 6); // 3 strategies * 2 k values
    results.forEach((r) => {
      assert.ok(r.n >= 0);
      assert.ok(r.meanPrecision >= 0 && r.meanPrecision <= 1);
      assert.ok(r.meanRecall >= 0 && r.meanRecall <= 1);
    });
    console.log("  PASS: runEvaluation produces bounded, well-formed metrics across all strategies and k values");
  }

  // evaluateStrategy (via runEvaluation): precisionCeiling reflects each scenario's own
  // target-set size (min(1, |targets|/k)), not a flat 1/k. A Protocol A scenario whose
  // held-out order has 2 distinct items has a true ceiling of min(1, 2/3) at k=3, not 1/3.
  {
    const menuItems = [
      { id: "a", name: "A", category: "coffee", price: 100, isAvailable: true },
      { id: "b", name: "B", category: "pastry", price: 80, isAvailable: true },
      { id: "c", name: "C", category: "coffee", price: 90, isAvailable: true },
    ];
    const orders = [
      { id: "o1", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-01T00:00:00Z", items: [{ menuItemId: "a", name: "A", quantity: 1 }] },
      { id: "o2", customerId: "c1", customerName: "C1", status: "completed", orderedAt: "2026-01-08T00:00:00Z", items: [{ menuItemId: "b", name: "B", quantity: 1 }, { menuItemId: "c", name: "C", quantity: 1 }] },
    ];
    const results = runEvaluation("A", orders, menuItems, [], [], [3], 3);
    assert.equal(results.length, 3); // 3 strategies * 1 k value
    const expectedCeiling = Math.min(1, 2 / 3);
    results.forEach((r) => {
      assert.ok(
        Math.abs(r.precisionCeiling - expectedCeiling) < 1e-9,
        `expected precisionCeiling ~${expectedCeiling} for a 2-item held-out target at k=3, got ${r.precisionCeiling}`
      );
    });
    console.log("  PASS: precisionCeiling reflects per-scenario target-set size (min(1, |targets|/k)), not a flat 1/k");
  }
} finally {
  await rm(tempDir3, { recursive: true, force: true });
}

console.log("\nAll checks passed.");

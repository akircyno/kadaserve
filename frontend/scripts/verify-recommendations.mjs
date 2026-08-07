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
  console.log("  PASS: enableCollaborativeSlot=false reproduces pre-CF (AHP-only) behavior");

  assert.ok(
    !withCf.recommendations.some((r) => r.basis === "collaborative" && r.item.id === "latte"),
    "CF must not recommend an item the customer already ordered"
  );
  console.log("  PASS: CF slot never recommends an already-ordered item");
} finally {
  await rm(tempDir2, { recursive: true, force: true });
}

console.log("\nAll checks passed.");

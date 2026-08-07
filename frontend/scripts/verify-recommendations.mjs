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

console.log("\nAll item-similarity.ts checks passed.");

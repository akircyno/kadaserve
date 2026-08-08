# AI Recommendations (Collaborative Filtering + Evaluation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add item-based collaborative filtering (significance-weighted cosine similarity) as a new-item discovery slot in the customer recommendation engine, and build the leave-one-out Precision@K/Recall@K evaluation harness the thesis already commits to in Objectives #5–#6.

**Architecture:** A new zero-dependency similarity module feeds a small integration point in the existing recommendation engine (additive, not a rewrite); a separate evaluation module composes both to produce offline metrics via two holdout protocols, driven by a script against live Supabase data.

**Tech Stack:** TypeScript (pure functions, no framework code), Node standalone scripts (no Jest/Vitest, matching this project's existing convention), no new npm dependencies.

## Global Constraints

- No new npm dependencies.
- No Jest/Vitest — tests live in `frontend/scripts/verify-recommendations.mjs`, following the existing `verify-nutrition.mjs`/`verify-analytics.mjs` convention: transpile via the TypeScript compiler API, then either a `data:` URL dynamic import (zero-import files) or temp `.mjs` files on disk with patched relative-import extensions (files with relative imports).
- The existing AHP engine — `frontend/src/lib/recommendation-weights.ts` and the scoring logic in `frontend/src/lib/recommendations.ts` above the "cascade hybrid" assembly — must not be modified, only extended.
- Follow the codebase's flat `frontend/src/lib/*.ts` convention — no new subfolders.
- Exact constants from the spec, not to be re-tuned without evidence from the lambda sweep: `CF_LAMBDA = 3`, `CF_MIN_SCORE = 0.05`, `CF_MIN_SUPPORT = 2`.
- New `RecommendationBasis` value: `"collaborative"`. New `RecommendationLabel` value: `"Customers Also Enjoyed"` (exact string — must be mechanically distinct from the existing `"You Might Also Like"`, per this codebase's established anti-decorative-label convention).

---

### Task 1: Item-similarity module (`item-similarity.ts`)

**Files:**
- Create: `frontend/src/lib/item-similarity.ts`
- Create: `frontend/scripts/verify-recommendations.mjs`
- Modify: `frontend/package.json` (add `test:recommendations` script)

**Interfaces:**
- Produces: `type PurchaseRecord = { customerId: string; itemId: string; quantity: number }`, `type NeighborScore = { itemId: string; rawSimilarity: number; weightedSimilarity: number; support: number }`, `type CandidatePrediction = { score: number; driver: (NeighborScore & { ownedItemId: string }) | null }`, `cosineSimilarity(a: number[], b: number[]): number`, `significanceWeight(similarity: number, support: number, lambda: number): number`, `computeItemNeighbors(records: PurchaseRecord[], lambda: number): Map<string, NeighborScore[]>`, `predictCandidateScore(neighbors: Map<string, NeighborScore[]>, candidateItemId: string, ownedItemScores: Map<string, number>): CandidatePrediction`. Consumed by Task 2's integration into `recommendations.ts`.

- [ ] **Step 1: Write `item-similarity.ts`**

```typescript
// frontend/src/lib/item-similarity.ts

export type PurchaseRecord = {
  customerId: string;
  itemId: string;
  quantity: number;
};

export type NeighborScore = {
  itemId: string;
  rawSimilarity: number;
  weightedSimilarity: number;
  support: number;
};

export type CandidatePrediction = {
  score: number;
  driver: (NeighborScore & { ownedItemId: string }) | null;
};

function buildCustomerItemMatrix(records: PurchaseRecord[]): {
  matrix: Map<string, Map<string, number>>;
  customerIds: string[];
  itemIds: string[];
} {
  const matrix = new Map<string, Map<string, number>>();
  const customerIdSet = new Set<string>();
  const itemIdSet = new Set<string>();

  records.forEach((record) => {
    customerIdSet.add(record.customerId);
    itemIdSet.add(record.itemId);
    const customerRow = matrix.get(record.customerId) ?? new Map<string, number>();
    customerRow.set(record.itemId, (customerRow.get(record.itemId) ?? 0) + record.quantity);
    matrix.set(record.customerId, customerRow);
  });

  return {
    matrix,
    customerIds: [...customerIdSet],
    itemIds: [...itemIdSet],
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must be the same length.");
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Significance weighting (Herlocker et al., 1999): shrinks similarity
 * toward zero when it rests on few co-purchasing customers, correcting the
 * spurious near-1.0 similarities raw cosine produces at n=1 support.
 */
export function significanceWeight(similarity: number, support: number, lambda: number): number {
  if (support <= 0) {
    return 0;
  }

  return similarity * (support / (support + lambda));
}

export function computeItemNeighbors(
  records: PurchaseRecord[],
  lambda: number
): Map<string, NeighborScore[]> {
  const { matrix, customerIds, itemIds } = buildCustomerItemMatrix(records);

  function vectorFor(itemId: string): number[] {
    return customerIds.map((customerId) => matrix.get(customerId)?.get(itemId) ?? 0);
  }

  function supportFor(itemA: string, itemB: string): number {
    let count = 0;
    customerIds.forEach((customerId) => {
      const row = matrix.get(customerId);
      if (row && (row.get(itemA) ?? 0) > 0 && (row.get(itemB) ?? 0) > 0) {
        count += 1;
      }
    });
    return count;
  }

  const vectors = new Map(itemIds.map((itemId) => [itemId, vectorFor(itemId)]));
  const neighbors = new Map<string, NeighborScore[]>();

  itemIds.forEach((itemA) => {
    const scores: NeighborScore[] = [];

    itemIds.forEach((itemB) => {
      if (itemA === itemB) {
        return;
      }

      const support = supportFor(itemA, itemB);
      if (support === 0) {
        return;
      }

      const rawSimilarity = cosineSimilarity(vectors.get(itemA)!, vectors.get(itemB)!);
      const weightedSimilarity = significanceWeight(rawSimilarity, support, lambda);

      scores.push({ itemId: itemB, rawSimilarity, weightedSimilarity, support });
    });

    scores.sort((left, right) => right.weightedSimilarity - left.weightedSimilarity);
    neighbors.set(itemA, scores);
  });

  return neighbors;
}

/**
 * Predicted CF score for a candidate item, summed across the customer's
 * owned items: Σ weightedSim(candidate, owned) × ahpScore(owned).
 * `driver` is the single (candidate, owned) pair with the highest
 * weightedSimilarity — used both for the minimum-support threshold check
 * and to name the item in the customer-facing explanation.
 */
export function predictCandidateScore(
  neighbors: Map<string, NeighborScore[]>,
  candidateItemId: string,
  ownedItemScores: Map<string, number>
): CandidatePrediction {
  let score = 0;
  let driver: (NeighborScore & { ownedItemId: string }) | null = null;

  ownedItemScores.forEach((ahpScore, ownedItemId) => {
    const ownedNeighbors = neighbors.get(ownedItemId);
    if (!ownedNeighbors) {
      return;
    }

    const match = ownedNeighbors.find((n) => n.itemId === candidateItemId);
    if (!match) {
      return;
    }

    score += match.weightedSimilarity * ahpScore;

    if (!driver || match.weightedSimilarity > driver.weightedSimilarity) {
      driver = { ...match, ownedItemId };
    }
  });

  return { score, driver };
}
```

- [ ] **Step 2: Write `verify-recommendations.mjs`**

```javascript
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
```

- [ ] **Step 3: Run to confirm it fails (or passes, since Steps 1-2 are given together)**

Run: `cd frontend && node scripts/verify-recommendations.mjs`
Expected: `All item-similarity.ts checks passed.` To see the red state, temporarily comment out the `computeItemNeighbors` export and re-run — confirm it throws `is not a function`, then restore it.

- [ ] **Step 4: Confirm it passes for real**

Run: `cd frontend && node scripts/verify-recommendations.mjs`
Expected: exits 0, all 5 PASS lines print.

- [ ] **Step 5: Add the `test:recommendations` script to `frontend/package.json`**

In the `"scripts"` block, next to the existing `"test:analytics"` entry, add:

```json
    "test:recommendations": "node scripts/verify-recommendations.mjs",
```

- [ ] **Step 6: Run via npm**

Run: `cd frontend && npm run test:recommendations`
Expected: same pass output as Step 4.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/item-similarity.ts frontend/scripts/verify-recommendations.mjs frontend/package.json
git commit -m "feat: add significance-weighted item similarity module"
```

---

### Task 2: Integrate CF discovery slot into `recommendations.ts`

**Files:**
- Modify: `frontend/src/lib/recommendations.ts`
- Modify: `frontend/scripts/verify-recommendations.mjs`

**Interfaces:**
- Consumes: `computeItemNeighbors`, `predictCandidateScore`, `type PurchaseRecord` from `frontend/src/lib/item-similarity.ts` (Task 1), via relative import `from "./item-similarity"`.
- Produces: `RecommendationBasis` extended with `"collaborative"`; `RecommendationLabel` extended with `"Customers Also Enjoyed"`; `getGlobalStats` becomes exported with signature `getGlobalStats(menuItems: RecommendationMenuItem[], orders: RecommendationOrder[], feedback: RecommendationFeedback[], globalRanking: RecommendationGlobalRankItem[], collaborativeLambda: number): { availableItems: RecommendationMenuItem[]; menuByKey: Map<string, RecommendationMenuItem>; mostPopular: RecommendationMenuItem[]; popularity: Map<string, number>; itemNeighbors: Map<string, NeighborScore[]> }`; `getRecommendationsForCustomer` gains two new optional parameters, `enableCollaborativeSlot?: boolean` (default `true`) and `collaborativeLambda?: number` (default `CF_LAMBDA`). Consumed by Task 3's `recommendation-evaluation.ts`.

- [ ] **Step 1: Add the import and new type variants**

At the top of `frontend/src/lib/recommendations.ts`, add to the import block:

```typescript
import { computeItemNeighbors, predictCandidateScore, type PurchaseRecord } from "./item-similarity";
```

Change:

```typescript
export type RecommendationBasis =
  | "preference"
  | "top_seller"
  | "popularity";

export type RecommendationLabel =
  | "Best for You"
  | "Top Seller"
  | "Popular Now"
  | "You Might Also Like";
```

to:

```typescript
export type RecommendationBasis =
  | "preference"
  | "top_seller"
  | "popularity"
  | "collaborative";

export type RecommendationLabel =
  | "Best for You"
  | "Top Seller"
  | "Popular Now"
  | "You Might Also Like"
  | "Customers Also Enjoyed";
```

- [ ] **Step 2: Add the CF constants**

Next to the existing `TOP_SELLER_MIN_ORDER_COUNT` constant, add:

```typescript
/** Significance-weighting decay parameter for collaborative-filtering similarity (see item-similarity.ts). */
const CF_LAMBDA = 3;
/** Minimum predicted CF score required before a discovery recommendation qualifies. */
const CF_MIN_SCORE = 0.05;
/** Minimum customer support required on the CF slot's best contributing pair. */
const CF_MIN_SUPPORT = 2;
```

- [ ] **Step 3: Export `getGlobalStats` and thread `collaborativeLambda` through it**

Replace the current function signature and the popularity/return sections. Currently:

```typescript
function getGlobalStats(
  menuItems: RecommendationMenuItem[],
  orders: RecommendationOrder[],
  feedback: RecommendationFeedback[],
  globalRanking: RecommendationGlobalRankItem[]
) {
```

becomes:

```typescript
export function getGlobalStats(
  menuItems: RecommendationMenuItem[],
  orders: RecommendationOrder[],
  feedback: RecommendationFeedback[],
  globalRanking: RecommendationGlobalRankItem[],
  collaborativeLambda: number
) {
```

Leave everything from `const availableItems = ...` through the end of the `canonicalMostPopular` construction unchanged. Immediately before the current `return { availableItems, menuByKey, mostPopular: canonicalMostPopular, popularity };` line, insert:

```typescript
  // ── Collaborative-filtering item neighbors (cross-customer) ─────────────
  const purchaseRecords: PurchaseRecord[] = [];
  orders
    .filter((o) => FINAL_STATUSES.has(o.status))
    .forEach((order) => {
      order.items.forEach((oi) => {
        const menuItem = menuByKey.get(orderItemKey(oi));
        if (!menuItem) return;
        purchaseRecords.push({
          customerId: order.customerId,
          itemId: itemKey(menuItem),
          quantity: oi.quantity,
        });
      });
    });
  const itemNeighbors = computeItemNeighbors(purchaseRecords, collaborativeLambda);
```

and change the return statement to:

```typescript
  return { availableItems, menuByKey, mostPopular: canonicalMostPopular, popularity, itemNeighbors };
```

- [ ] **Step 4: Add the new parameters to `getRecommendationsForCustomer` and thread lambda into the `getGlobalStats` call**

Change the destructured parameter list (currently ending with `hourOfDay = new Date().getHours(),`) to:

```typescript
  hourOfDay = new Date().getHours(),
  enableCollaborativeSlot = true,
  collaborativeLambda = CF_LAMBDA,
```

and the accompanying type block (currently ending with the `hourOfDay?: number;` comment/field) to add, after it:

```typescript
  /**
   * Whether to attempt the collaborative-filtering discovery slot (slot 3).
   * Set to false to reproduce pre-CF ("AHP-only") behavior — used by the
   * evaluation harness to isolate CF's contribution.
   */
  enableCollaborativeSlot?: boolean;
  /** Override for the significance-weighting lambda, used by the evaluation harness's lambda sweep. */
  collaborativeLambda?: number;
```

Change the first line of the function body:

```typescript
  const globalStats = getGlobalStats(menuItems, orders, feedback, globalRanking);
```

to:

```typescript
  const globalStats = getGlobalStats(menuItems, orders, feedback, globalRanking, collaborativeLambda);
```

- [ ] **Step 5: Insert the CF discovery slot between slot 2 and the popularity loop**

Immediately after the closing brace of the "Slot 2" block (the block that pushes `second` with label `"You Might Also Like"`) and before the comment `// Remaining slots: fill from global popularity (mechanically distinct from preference)`, insert:

```typescript
  // Slot 3 attempt: Collaborative-filtering discovery (new items the customer hasn't tried)
  if (enableCollaborativeSlot && recommendations.length < 3) {
    const ownedItemScores = new Map(scoredItems.map((s) => [itemKey(s.item), s.score]));
    let bestCandidate: { item: RecommendationMenuItem; score: number; driverName: string } | null = null;

    globalStats.availableItems.forEach((candidateItem) => {
      const candidateKey = itemKey(candidateItem);
      if (ownedItemScores.has(candidateKey) || seen.has(candidateKey)) return;

      const prediction = predictCandidateScore(globalStats.itemNeighbors, candidateKey, ownedItemScores);
      if (
        prediction.score > CF_MIN_SCORE &&
        prediction.driver &&
        prediction.driver.support >= CF_MIN_SUPPORT &&
        (!bestCandidate || prediction.score > bestCandidate.score)
      ) {
        const driverItem = globalStats.menuByKey.get(prediction.driver.ownedItemId);
        bestCandidate = {
          item: candidateItem,
          score: prediction.score,
          driverName: driverItem?.name ?? "your favorites",
        };
      }
    });

    if (bestCandidate) {
      push({
        item: bestCandidate.item,
        label: "Customers Also Enjoyed",
        basis: "collaborative",
        reason: `Customers who ordered ${bestCandidate.driverName} also enjoyed this`,
        score: bestCandidate.score,
      });
    }
  }

```

Leave the popularity loop that follows completely unchanged — it already dedupes via `seen` and stops once `recommendations.length >= 3`, so it correctly fills any slot the CF attempt didn't claim.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Extend `verify-recommendations.mjs` with CF-integration tests**

Append this block to `frontend/scripts/verify-recommendations.mjs`, before the final `console.log("\nAll item-similarity.ts checks passed.")` line — rename that line to `console.log("\nAll checks passed.")` since the script now covers more than one module:

```javascript
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
```

- [ ] **Step 8: Run to verify it passes**

Run: `cd frontend && node scripts/verify-recommendations.mjs`
Expected: all PASS lines including the CF-integration section, ending in `All checks passed.`

- [ ] **Step 9: Typecheck and lint**

Run: `cd frontend && npx tsc --noEmit && npx eslint src/lib/recommendations.ts src/lib/item-similarity.ts`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/lib/recommendations.ts frontend/scripts/verify-recommendations.mjs
git commit -m "feat: add collaborative-filtering discovery slot to recommendation engine"
```

---

### Task 3: Evaluation harness (`recommendation-evaluation.ts`)

**Files:**
- Create: `frontend/src/lib/recommendation-evaluation.ts`
- Modify: `frontend/scripts/verify-recommendations.mjs`

**Interfaces:**
- Consumes: `getRecommendationsForCustomer`, `getGlobalStats` (both extended in Task 2), plus `type RecommendationOrder`, `type RecommendationMenuItem`, `type RecommendationFeedback`, `type RecommendationGlobalRankItem` from `frontend/src/lib/recommendations.ts`, via relative import `from "./recommendations"`.
- Produces: `type EvaluationScenario = { customerId: string; trainingOrders: RecommendationOrder[]; targetItemIds: Set<string> }`, `type StrategyName = "hybrid" | "ahp_only" | "popularity"`, `type StrategyMetrics = { strategy: StrategyName; k: number; n: number; meanPrecision: number; meanRecall: number; precisionCeiling: number }`, `type LambdaSweepResult = { lambda: number; n: number; meanPrecision: number; meanRecall: number }`, `buildProtocolAScenarios(orders: RecommendationOrder[]): EvaluationScenario[]`, `buildProtocolBScenarios(orders: RecommendationOrder[]): EvaluationScenario[]`, `precisionAtK(recommendedIds: string[], targetIds: Set<string>, k: number): number`, `recallAtK(recommendedIds: string[], targetIds: Set<string>, k: number): number`, `runEvaluation(protocol: "A" | "B", orders: RecommendationOrder[], menuItems: RecommendationMenuItem[], feedback: RecommendationFeedback[], globalRanking: RecommendationGlobalRankItem[], ks: number[], lambda: number): StrategyMetrics[]`, `runLambdaSweep(orders: RecommendationOrder[], menuItems: RecommendationMenuItem[], feedback: RecommendationFeedback[], globalRanking: RecommendationGlobalRankItem[], lambdas: number[], k: number): LambdaSweepResult[]`. Consumed by Task 4's `evaluate-recommendations.mjs`.

- [ ] **Step 1: Write `recommendation-evaluation.ts`**

```typescript
// frontend/src/lib/recommendation-evaluation.ts
import {
  getRecommendationsForCustomer,
  getGlobalStats,
  type RecommendationOrder,
  type RecommendationMenuItem,
  type RecommendationFeedback,
  type RecommendationGlobalRankItem,
} from "./recommendations";

const FINAL_STATUSES = new Set(["completed", "delivered"]);

export type EvaluationScenario = {
  customerId: string;
  trainingOrders: RecommendationOrder[];
  targetItemIds: Set<string>;
};

function itemIdFor(menuItemId: string | null | undefined, name: string): string {
  return menuItemId || name.trim().toLowerCase();
}

/**
 * Protocol A — next-order prediction. Holds out each customer's single most
 * recent order; targets are the distinct items in it (which may be repeat
 * purchases). This is the fair three-way protocol: AHP-only, popularity, and
 * CF can all legitimately compete, since targets aren't restricted to novel
 * items.
 */
export function buildProtocolAScenarios(orders: RecommendationOrder[]): EvaluationScenario[] {
  const byCustomer = new Map<string, RecommendationOrder[]>();

  orders
    .filter((o) => FINAL_STATUSES.has(o.status))
    .forEach((order) => {
      const list = byCustomer.get(order.customerId) ?? [];
      list.push(order);
      byCustomer.set(order.customerId, list);
    });

  const scenarios: EvaluationScenario[] = [];

  byCustomer.forEach((customerOrders, customerId) => {
    if (customerOrders.length < 2) return;

    const sorted = [...customerOrders].sort(
      (a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime()
    );
    const heldOut = sorted[0];
    const targetItemIds = new Set(heldOut.items.map((item) => itemIdFor(item.menuItemId, item.name)));

    if (targetItemIds.size === 0) return;

    const trainingOrders = orders.filter(
      (order) => !(order.customerId === customerId && order.id === heldOut.id)
    );

    scenarios.push({ customerId, trainingOrders, targetItemIds });
  });

  return scenarios;
}

/**
 * Protocol B — novel-item discovery. For each customer, finds items ordered
 * exactly once across their whole history (true singletons — removing the
 * one order-line makes the item fully absent from their remaining history),
 * and holds out the most recently ordered singleton. AHP-only can only score
 * items already in a customer's history, so it scores a structural 0 here by
 * design — that is documented, not a bug. The meaningful comparison is CF vs.
 * popularity.
 */
export function buildProtocolBScenarios(orders: RecommendationOrder[]): EvaluationScenario[] {
  const finalOrders = orders.filter((o) => FINAL_STATUSES.has(o.status));
  const byCustomer = new Map<string, RecommendationOrder[]>();

  finalOrders.forEach((order) => {
    const list = byCustomer.get(order.customerId) ?? [];
    list.push(order);
    byCustomer.set(order.customerId, list);
  });

  const scenarios: EvaluationScenario[] = [];

  byCustomer.forEach((customerOrders, customerId) => {
    const totalByItem = new Map<string, number>();
    type Occurrence = { itemId: string; orderId: string; orderedAt: string; quantity: number };
    const occurrences: Occurrence[] = [];

    customerOrders.forEach((order) => {
      order.items.forEach((item) => {
        const itemId = itemIdFor(item.menuItemId, item.name);
        totalByItem.set(itemId, (totalByItem.get(itemId) ?? 0) + item.quantity);
        occurrences.push({ itemId, orderId: order.id, orderedAt: order.orderedAt, quantity: item.quantity });
      });
    });

    // A true singleton: this occurrence's quantity equals the item's total
    // quantity across the customer's whole history, so it appears in no
    // other order line.
    const singletonOccurrences = occurrences.filter(
      (occ) => totalByItem.get(occ.itemId) === occ.quantity
    );

    if (singletonOccurrences.length === 0) return;

    const mostRecent = [...singletonOccurrences].sort(
      (a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime()
    )[0];

    const trainingOrders = orders
      .map((order) => {
        if (order.customerId !== customerId || order.id !== mostRecent.orderId) {
          return order;
        }

        const remainingItems = order.items.filter(
          (item) => itemIdFor(item.menuItemId, item.name) !== mostRecent.itemId
        );

        return { ...order, items: remainingItems };
      })
      .filter((order) => order.items.length > 0);

    scenarios.push({
      customerId,
      trainingOrders,
      targetItemIds: new Set([mostRecent.itemId]),
    });
  });

  return scenarios;
}

export type StrategyName = "hybrid" | "ahp_only" | "popularity";

export function generateTopKForStrategy(
  strategy: StrategyName,
  scenario: EvaluationScenario,
  menuItems: RecommendationMenuItem[],
  feedback: RecommendationFeedback[],
  globalRanking: RecommendationGlobalRankItem[],
  k: number,
  lambda: number
): string[] {
  if (strategy === "popularity") {
    const stats = getGlobalStats(menuItems, scenario.trainingOrders, feedback, globalRanking, lambda);
    return stats.mostPopular.slice(0, k).map((item) => item.id || item.name.trim().toLowerCase());
  }

  const profile = getRecommendationsForCustomer({
    customerId: scenario.customerId,
    customerName: scenario.customerId,
    menuItems,
    orders: scenario.trainingOrders,
    feedback,
    globalRanking,
    hourOfDay: 12,
    enableCollaborativeSlot: strategy === "hybrid",
    collaborativeLambda: lambda,
  });

  return profile.recommendations.slice(0, k).map((r) => r.item.id || r.item.name.trim().toLowerCase());
}

/** Precision@K = (relevant items in top K) / K, exactly per thesis Chapter 2.6.5. */
export function precisionAtK(recommendedIds: string[], targetIds: Set<string>, k: number): number {
  const topK = recommendedIds.slice(0, k);
  const hits = topK.filter((id) => targetIds.has(id)).length;
  return hits / k;
}

/** Recall@K = (relevant items in top K) / (total relevant items), per thesis Chapter 2.6.6. */
export function recallAtK(recommendedIds: string[], targetIds: Set<string>, k: number): number {
  if (targetIds.size === 0) return 0;
  const topK = recommendedIds.slice(0, k);
  const hits = topK.filter((id) => targetIds.has(id)).length;
  return hits / targetIds.size;
}

export type StrategyMetrics = {
  strategy: StrategyName;
  k: number;
  n: number;
  meanPrecision: number;
  meanRecall: number;
  precisionCeiling: number;
};

export function evaluateStrategy(
  strategy: StrategyName,
  scenarios: EvaluationScenario[],
  menuItems: RecommendationMenuItem[],
  feedback: RecommendationFeedback[],
  globalRanking: RecommendationGlobalRankItem[],
  k: number,
  lambda: number
): StrategyMetrics {
  if (scenarios.length === 0) {
    return { strategy, k, n: 0, meanPrecision: 0, meanRecall: 0, precisionCeiling: 1 / k };
  }

  const precisions: number[] = [];
  const recalls: number[] = [];

  scenarios.forEach((scenario) => {
    const topK = generateTopKForStrategy(strategy, scenario, menuItems, feedback, globalRanking, k, lambda);
    precisions.push(precisionAtK(topK, scenario.targetItemIds, k));
    recalls.push(recallAtK(topK, scenario.targetItemIds, k));
  });

  return {
    strategy,
    k,
    n: scenarios.length,
    meanPrecision: precisions.reduce((sum, v) => sum + v, 0) / precisions.length,
    meanRecall: recalls.reduce((sum, v) => sum + v, 0) / recalls.length,
    precisionCeiling: 1 / k,
  };
}

export function runEvaluation(
  protocol: "A" | "B",
  orders: RecommendationOrder[],
  menuItems: RecommendationMenuItem[],
  feedback: RecommendationFeedback[],
  globalRanking: RecommendationGlobalRankItem[],
  ks: number[],
  lambda: number
): StrategyMetrics[] {
  const scenarios = protocol === "A" ? buildProtocolAScenarios(orders) : buildProtocolBScenarios(orders);
  const strategies: StrategyName[] = ["hybrid", "ahp_only", "popularity"];

  const results: StrategyMetrics[] = [];
  strategies.forEach((strategy) => {
    ks.forEach((k) => {
      results.push(evaluateStrategy(strategy, scenarios, menuItems, feedback, globalRanking, k, lambda));
    });
  });

  return results;
}

export type LambdaSweepResult = {
  lambda: number;
  n: number;
  meanPrecision: number;
  meanRecall: number;
};

export function runLambdaSweep(
  orders: RecommendationOrder[],
  menuItems: RecommendationMenuItem[],
  feedback: RecommendationFeedback[],
  globalRanking: RecommendationGlobalRankItem[],
  lambdas: number[],
  k: number
): LambdaSweepResult[] {
  // Protocol B (discovery) is where lambda's effect on CF is most visible.
  const scenarios = buildProtocolBScenarios(orders);

  return lambdas.map((lambda) => {
    const metrics = evaluateStrategy("hybrid", scenarios, menuItems, feedback, globalRanking, k, lambda);
    return { lambda, n: metrics.n, meanPrecision: metrics.meanPrecision, meanRecall: metrics.meanRecall };
  });
}
```

- [ ] **Step 2: Extend `verify-recommendations.mjs`**

First, add a fourth entry to the transpile setup by appending this block before the final `console.log("\nAll checks passed.")` line:

```javascript
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
} finally {
  await rm(tempDir3, { recursive: true, force: true });
}
```

- [ ] **Step 3: Run to verify it passes**

Run: `cd frontend && node scripts/verify-recommendations.mjs`
Expected: all PASS lines including the recommendation-evaluation.ts section, ending in `All checks passed.`

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/recommendation-evaluation.ts frontend/scripts/verify-recommendations.mjs
git commit -m "feat: add leave-one-out Precision@K/Recall@K evaluation harness"
```

---

### Task 4: Live evaluation script and final report

**Files:**
- Create: `frontend/scripts/evaluate-recommendations.mjs`
- Modify: `frontend/package.json` (add `evaluate:recommendations` script)

**Interfaces:**
- Consumes: `runEvaluation`, `runLambdaSweep` from `frontend/src/lib/recommendation-evaluation.ts` (Task 3), loaded via the same temp-file transpile pattern as the verify script.

- [ ] **Step 1: Write `evaluate-recommendations.mjs`**

```javascript
// frontend/scripts/evaluate-recommendations.mjs
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

async function loadEnvLocal() {
  const envPath = new URL("../.env.local", import.meta.url);
  const contents = await readFile(envPath, "utf8");
  const env = {};

  contents.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^"(.*)"$/, "$1");
    env[key] = value;
  });

  return env;
}

async function fetchSupabase(baseUrl, serviceKey, urlPath) {
  const response = await fetch(`${baseUrl}/rest/v1/${urlPath}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase fetch failed for ${urlPath}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function loadRecommendationEvaluationModule() {
  const files = {
    "item-similarity.ts": "../src/lib/item-similarity.ts",
    "recommendation-weights.ts": "../src/lib/recommendation-weights.ts",
    "recommendations.ts": "../src/lib/recommendations.ts",
    "recommendation-evaluation.ts": "../src/lib/recommendation-evaluation.ts",
  };
  const tempDir = await mkdtemp(path.join(tmpdir(), "kadaserve-evaluate-reco-"));

  const sources = {};
  for (const [name, rel] of Object.entries(files)) {
    sources[name] = await readFile(new URL(rel, import.meta.url), "utf8");
  }

  const outPaths = {};
  for (const name of Object.keys(files)) {
    outPaths[name] = path.join(tempDir, name.replace(".ts", ".mjs"));
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

  const evaluationModule = await import(pathToFileURL(outPaths["recommendation-evaluation.ts"]).href);
  return { evaluationModule, tempDir };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function printMetricsTable(title, metrics) {
  console.log(`\n${title}`);
  console.log("strategy".padEnd(12), "k".padEnd(4), "n".padEnd(4), "precision".padEnd(12), "recall".padEnd(10), "ceiling");
  metrics.forEach((m) => {
    console.log(
      m.strategy.padEnd(12),
      String(m.k).padEnd(4),
      String(m.n).padEnd(4),
      formatPercent(m.meanPrecision).padEnd(12),
      formatPercent(m.meanRecall).padEnd(10),
      formatPercent(m.precisionCeiling)
    );
  });
}

async function main() {
  const env = await loadEnvLocal();
  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in frontend/.env.local");
  }

  const [rawOrders, rawMenuItems, rawFeedback, rawGlobalRanking] = await Promise.all([
    fetchSupabase(
      baseUrl,
      serviceKey,
      "orders?select=id,customer_id,status,ordered_at,order_items(menu_item_id,quantity,menu_items(name))&status=in.(completed,delivered)&limit=2000"
    ),
    fetchSupabase(baseUrl, serviceKey, "menu_items?select=id,name,category,base_price,is_available"),
    fetchSupabase(baseUrl, serviceKey, "feedback?select=customer_id,menu_item_id,taste_rating,strength_rating,overall_rating&limit=2000"),
    fetchSupabase(baseUrl, serviceKey, "analytics_items?select=item_id,item_name,order_count,sales_rank"),
  ]);

  const menuItems = rawMenuItems.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    price: Number(m.base_price ?? 0),
    isAvailable: Boolean(m.is_available),
  }));

  const orders = rawOrders
    .filter((o) => o.customer_id)
    .map((o) => ({
      id: o.id,
      customerId: o.customer_id,
      customerName: o.customer_id,
      status: o.status,
      orderedAt: o.ordered_at,
      items: (o.order_items ?? []).map((oi) => ({
        menuItemId: oi.menu_item_id,
        name: oi.menu_items?.name ?? "",
        quantity: Number(oi.quantity ?? 1),
      })),
    }));

  const feedback = rawFeedback.map((f) => ({
    customerId: f.customer_id,
    menuItemId: f.menu_item_id,
    tasteRating: f.taste_rating,
    strengthRating: f.strength_rating,
    overallRating: f.overall_rating,
  }));

  const globalRanking = rawGlobalRanking.map((r) => ({
    id: r.item_id,
    name: r.item_name,
    orderCount: Number(r.order_count ?? 0),
    rank: Number(r.sales_rank ?? 0),
  }));

  console.log(
    `Loaded ${orders.length} completed/delivered orders, ${menuItems.length} menu items, ${feedback.length} feedback rows.`
  );

  const { evaluationModule, tempDir } = await loadRecommendationEvaluationModule();

  try {
    const { runEvaluation, runLambdaSweep } = evaluationModule;

    console.log("\n=== Protocol A: Next-Order Prediction (fair three-way headline) ===");
    const protocolA = runEvaluation("A", orders, menuItems, feedback, globalRanking, [1, 3, 5], 3);
    printMetricsTable("Protocol A results", protocolA);

    console.log("\n=== Protocol B: Novel-Item Discovery (isolates CF; AHP-only is a structural 0 by design) ===");
    const protocolB = runEvaluation("B", orders, menuItems, feedback, globalRanking, [1, 3, 5], 3);
    printMetricsTable("Protocol B results", protocolB);
    console.log("\nNote: ahp_only rows in Protocol B are expected to be 0.000 — the current system can only");
    console.log("score items already in a customer's history, so it cannot recommend a truly novel item by");
    console.log("construction. This is documented, not a bug.");

    console.log("\n=== Lambda sensitivity sweep (Protocol B, hybrid strategy, k=3) ===");
    const sweep = runLambdaSweep(orders, menuItems, feedback, globalRanking, [1, 2, 3, 5], 3);
    console.log("lambda".padEnd(8), "n".padEnd(4), "precision".padEnd(12), "recall");
    sweep.forEach((s) => {
      console.log(
        String(s.lambda).padEnd(8),
        String(s.n).padEnd(4),
        formatPercent(s.meanPrecision).padEnd(12),
        formatPercent(s.meanRecall)
      );
    });

    console.log("\nSample sizes are small (see n columns above) — report alongside every metric, per the design spec.");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Add the `evaluate:recommendations` script to `frontend/package.json`**

Next to `test:recommendations`, add:

```json
    "evaluate:recommendations": "node scripts/evaluate-recommendations.mjs",
```

- [ ] **Step 3: Run it against live data**

Run: `cd frontend && npm run evaluate:recommendations`
Expected: prints the loaded-data summary line, then Protocol A results, Protocol B results (with the ahp_only-is-structural-zero note), and the lambda sweep table. No thrown errors. Capture the full output — this is the raw material for Chapter 3.

- [ ] **Step 4: Full regression pass**

Run: `cd frontend && npm run test:recommendations && npx tsc --noEmit && npx eslint src/lib/item-similarity.ts src/lib/recommendations.ts src/lib/recommendation-evaluation.ts scripts/evaluate-recommendations.mjs`
Expected: all pass, no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/scripts/evaluate-recommendations.mjs frontend/package.json
git commit -m "feat: add live evaluation script for Chapter 3 results"
```

- [ ] **Step 6: Report the captured results back in the session**

Paste the full `npm run evaluate:recommendations` output into the task report so the numbers are available for the manuscript — this is the deliverable Objectives #5–#6 need, and it should not just live in a terminal that gets closed.

---

## Reminder (not a code task)

The live menu contains a "Payment test" item (₱1, 1 order) — real test data in production. Per the design spec, this is a data cleanup the user should do directly in the admin Menu Management UI before any defense demo; it is intentionally not part of this plan's code changes.

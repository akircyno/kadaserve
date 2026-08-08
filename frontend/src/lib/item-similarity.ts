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
 *
 * `minSupport` structurally excludes any contributing (candidate, owned)
 * pair whose support is below the threshold — not just the driver pair.
 * Without this, a low-support (spurious, e.g. n=1) pair could still add to
 * the summed score even though it would fail the driver-pair support check
 * on its own, letting up to the rest of the total score come from pairs the
 * threshold was meant to exclude entirely. Defaults to 0 (no filtering) for
 * backward compatibility with existing callers/tests.
 */
export function predictCandidateScore(
  neighbors: Map<string, NeighborScore[]>,
  candidateItemId: string,
  ownedItemScores: Map<string, number>,
  minSupport = 0
): CandidatePrediction {
  let score = 0;
  let driver: (NeighborScore & { ownedItemId: string }) | null = null;

  ownedItemScores.forEach((ahpScore, ownedItemId) => {
    const ownedNeighbors = neighbors.get(ownedItemId);
    if (!ownedNeighbors) {
      return;
    }

    const match = ownedNeighbors.find((n) => n.itemId === candidateItemId);
    if (!match || match.support < minSupport) {
      return;
    }

    score += match.weightedSimilarity * ahpScore;

    if (!driver || match.weightedSimilarity > driver.weightedSimilarity) {
      driver = { ...match, ownedItemId };
    }
  });

  return { score, driver };
}

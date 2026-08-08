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
 * and holds out the most recently ordered singleton. Only customers with >=2
 * distinct items in their full history are evaluable, so real training
 * history remains after holdout (see the totalByItem.size check below).
 *
 * `ahp_only` here means CF is disabled, but the pre-existing popularity
 * fallback remains active — it is NOT restricted to previously-ordered
 * items, and can still recommend popular novel items, just without
 * personalized similarity-based ranking. The meaningful comparison Protocol
 * B measures is whether `hybrid`'s personalized discovery outperforms
 * `ahp_only`'s blind popularity-based discovery.
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

    // The evaluable population is "customers with >=2 distinct items" (design
    // spec) so that after holding out one singleton, real training history
    // remains and the three strategies can actually be distinguished. A
    // customer whose entire history is a single distinct item would have an
    // empty trainingOrders after holdout, forcing the cold-start path (pure
    // popularity for all three strategies) and contributing zero
    // discriminative signal while still inflating n.
    if (totalByItem.size < 2) return;

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
  const ceilings: number[] = [];

  scenarios.forEach((scenario) => {
    const topK = generateTopKForStrategy(strategy, scenario, menuItems, feedback, globalRanking, k, lambda);
    precisions.push(precisionAtK(topK, scenario.targetItemIds, k));
    recalls.push(recallAtK(topK, scenario.targetItemIds, k));
    ceilings.push(Math.min(1, scenario.targetItemIds.size / k));
  });

  return {
    strategy,
    k,
    n: scenarios.length,
    meanPrecision: precisions.reduce((sum, v) => sum + v, 0) / precisions.length,
    meanRecall: recalls.reduce((sum, v) => sum + v, 0) / recalls.length,
    precisionCeiling: ceilings.reduce((sum, v) => sum + v, 0) / ceilings.length,
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

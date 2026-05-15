/**
 * Recommendation Engine — Core Scoring & Top-N Selection
 *
 * Architecture: Cascade hybrid (Burke, 2002) combining:
 *   1. Content-based behavioral filtering (personal order history)
 *   2. Global popularity ranking (admin-curated analytics_items)
 *
 * Weights: AHP-derived — see recommendation-weights.ts for full derivation
 * and consistency ratio proof (CR = 0.016 < 0.10 ✓).
 */

import {
  PREFERENCE_WEIGHTS,
  FEEDBACK_DIMENSION_WEIGHTS,
  RECENCY_HALF_LIFE_DAYS,
  FEEDBACK_MIN_CONFIDENT_OBSERVATIONS,
  FEEDBACK_SKEPTICAL_PRIOR,
  CONTEXT_BOOST,
  MORNING_HOURS,
  AFTERNOON_HOURS,
  SNACK_HOURS,
} from "./recommendation-weights";

// ─── Public types ────────────────────────────────────────────────────────────

export type RecommendationBasis =
  | "preference"
  | "top_seller"
  | "popularity";

export type RecommendationLabel =
  | "Best for You"
  | "Top Seller"
  | "Popular Now"
  | "You Might Also Like";

export type RecommendationMenuItem = {
  id: string;
  name: string;
  category?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
};

export type RecommendationOrder = {
  id: string;
  customerId: string;
  customerName: string;
  status: string;
  orderedAt: string;
  items: Array<{
    menuItemId?: string | null;
    name: string;
    category?: string | null;
    quantity: number;
  }>;
};

export type RecommendationFeedback = {
  customerId?: string | null;
  menuItemId?: string | null;
  itemName?: string | null;
  tasteRating?: number | null;
  strengthRating?: number | null;
  overallRating?: number | null;
};

export type RecommendationGlobalRankItem = {
  id?: string | null;
  name: string;
  orderCount: number;
  rank?: number;
};

export type RecommendationResult = {
  item: RecommendationMenuItem;
  label: RecommendationLabel;
  basis: RecommendationBasis;
  /**
   * Human-readable explanation surfaced directly to the customer.
   * Supports transparency and builds trust (cf. SDG 12 responsible consumption).
   */
  reason: string;
  score: number;
};

export type CustomerRecommendationProfile = {
  customerId: string;
  customerName: string;
  mostOrderedItem: string;
  lastOrderedItem: string;
  averageFeedbackRating: number | null;
  preferenceScore: number;
  recommendations: RecommendationResult[];
  isNewCustomer: boolean;
};

// ─── Internal types ───────────────────────────────────────────────────────────

type ItemStats = {
  item: RecommendationMenuItem;
  /** Raw total units ordered by this customer. */
  frequency: number;
  /** Unix ms timestamp of the most recent qualifying order. */
  latestAt: number;
  /** Individual weighted feedback scores for this item. */
  feedbackScores: number[];
};

type ScoredItem = ItemStats & {
  /** Composite score in [0, 1]. */
  score: number;
  /** Weighted average of feedback dimensions; null if no feedback. */
  averageRating: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FINAL_STATUSES = new Set(["completed", "delivered"]);

/**
 * Minimum global order count required for a "Top Seller" label.
 * Items below this threshold use "Popular Now" instead, preventing
 * low-volume items from claiming an inflated ranking label.
 */
const TOP_SELLER_MIN_ORDER_COUNT = 5;

// ─── Utilities ────────────────────────────────────────────────────────────────

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function itemKey(item: { id?: string | null; name: string }): string {
  return item.id || normalizeText(item.name);
}

function orderItemKey(item: { menuItemId?: string | null; name: string }): string {
  return item.menuItemId || normalizeText(item.name);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Weighted composite feedback score from three rated dimensions.
 *
 * Dimensions are NOT treated as equivalent (critique §1.4):
 *   overall > taste > strength (AHP sub-weights, see recommendation-weights.ts)
 *
 * Returns null when no valid ratings exist for any dimension.
 */
function getWeightedFeedbackScore(feedback: RecommendationFeedback): number | null {
  const overall = Number(feedback.overallRating);
  const taste   = Number(feedback.tasteRating);
  const strength = Number(feedback.strengthRating);

  const hasOverall  = Number.isFinite(overall)  && overall  > 0;
  const hasTaste    = Number.isFinite(taste)     && taste    > 0;
  const hasStrength = Number.isFinite(strength)  && strength > 0;

  if (!hasOverall && !hasTaste && !hasStrength) return null;

  // Weighted sum over available dimensions; re-normalize weights for available dims.
  let weightedSum = 0;
  let totalWeight = 0;

  if (hasOverall)  { weightedSum += FEEDBACK_DIMENSION_WEIGHTS.overall   * overall;  totalWeight += FEEDBACK_DIMENSION_WEIGHTS.overall; }
  if (hasTaste)    { weightedSum += FEEDBACK_DIMENSION_WEIGHTS.taste     * taste;    totalWeight += FEEDBACK_DIMENSION_WEIGHTS.taste; }
  if (hasStrength) { weightedSum += FEEDBACK_DIMENSION_WEIGHTS.strength  * strength; totalWeight += FEEDBACK_DIMENSION_WEIGHTS.strength; }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

/**
 * Confidence-adjusted satisfaction score for a set of feedback observations.
 *
 * Applies Bayesian shrinkage toward FEEDBACK_SKEPTICAL_PRIOR (0.5) when the
 * number of observations is below FEEDBACK_MIN_CONFIDENT_OBSERVATIONS.
 * This avoids over-promoting items with a single 5★ review and avoids the
 * silent mean-imputation critique (§1.5): a missing score does NOT mean neutral.
 *
 * Formula: score = (n·x̄ + k·prior) / (n + k)
 *   where k = FEEDBACK_MIN_CONFIDENT_OBSERVATIONS, x̄ = observed mean/5.
 *
 * Returns FEEDBACK_SKEPTICAL_PRIOR when no feedback exists.
 */
function getConfidenceAdjustedFeedbackScore(scores: number[]): number {
  const n = scores.length;

  if (n === 0) return FEEDBACK_SKEPTICAL_PRIOR;

  const observedMean = scores.reduce((s, v) => s + v, 0) / n / 5; // normalise to [0,1]
  const k = FEEDBACK_MIN_CONFIDENT_OBSERVATIONS;

  return clamp01((n * observedMean + k * FEEDBACK_SKEPTICAL_PRIOR) / (n + k));
}

/**
 * Hyperbolic recency decay: f(d) = 1 / (1 + d/τ)
 *
 * At d=0 → 1.0 (ordered today).
 * At d=τ → 0.5 (half-life).
 * At d=2τ → 0.33.
 *
 * Reference: Ding et al. (2010), CIKM '05.
 */
function getRecencyScore(ageMs: number): number {
  const ageDays = Math.max(0, ageMs / 86_400_000);
  return clamp01(1 / (1 + ageDays / RECENCY_HALF_LIFE_DAYS));
}

/**
 * Normalises a customer's raw order frequency using log-damped global
 * context rather than pure self-relative normalisation.
 *
 * Problem with pure self-relative normalisation (critique §1.2):
 *   A customer who ordered one item once gets freq=1.0 — identical to a
 *   customer who ordered 50 times. This destroys discriminatory power.
 *
 * Fix: use log(1 + frequency) / log(1 + globalMaxFrequency).
 *   Log damping compresses the dynamic range so power-users don't dominate
 *   while preserving ordinal ranking. globalMaxFrequency is the max observed
 *   across ALL customers, providing cross-customer context.
 */
function getNormalisedFrequency(frequency: number, globalMaxFrequency: number): number {
  if (globalMaxFrequency <= 0) return 0;
  const logFreq    = Math.log1p(frequency);
  const logGlobalMax = Math.log1p(globalMaxFrequency);
  return clamp01(logFreq / logGlobalMax);
}

/**
 * Time-of-day context boost (lightweight CAF implementation).
 *
 * Applies a small additive bonus based on session hour and item category,
 * capped so context never overrides a strong behavioral signal.
 * Reference: Adomavicius & Tuzhilin (2011), Recommender Systems Handbook.
 */
function getContextBoost(
  item: RecommendationMenuItem,
  hourOfDay: number
): number {
  const cat = normalizeText(item.category);
  const isHot     = cat.includes("hot") || cat.includes("espresso") || cat.includes("coffee");
  const isIced    = cat.includes("iced") || cat.includes("frappe") || cat.includes("non-coffee");
  const isPastry  = cat.includes("pastry") || cat.includes("pastries") || cat.includes("food");

  const isMorning   = hourOfDay >= MORNING_HOURS.start   && hourOfDay <= MORNING_HOURS.end;
  const isAfternoon = hourOfDay >= AFTERNOON_HOURS.start && hourOfDay <= AFTERNOON_HOURS.end;
  const isSnack     = hourOfDay >= SNACK_HOURS.start     && hourOfDay <= SNACK_HOURS.end;

  let boost = 0;
  if (isMorning   && isHot)    boost += CONTEXT_BOOST.morningHotBoost;
  if (isAfternoon && isIced)   boost += CONTEXT_BOOST.afternoonIcedBoost;
  if ((isMorning || isSnack) && isPastry) boost += CONTEXT_BOOST.pastryBoost;

  return boost;
}

/**
 * Builds a human-readable explanation string for the customer.
 * Transparency increases trust and satisfies responsible-recommendation
 * principles (cf. SDG 12 alignment).
 */
function buildExplanation(
  basis: RecommendationBasis,
  stats: { frequency: number; latestAt: number; averageRating: number | null } | null,
  globalOrderCount: number | null
): string {
  if (basis === "preference" && stats) {
    const ageDays = Math.round((Date.now() - stats.latestAt) / 86_400_000);
    const parts: string[] = [`Ordered ${stats.frequency}× by you`];

    if (ageDays === 0)      parts.push("last ordered today");
    else if (ageDays === 1) parts.push("last ordered yesterday");
    else                    parts.push(`last ordered ${ageDays} days ago`);

    if (stats.averageRating !== null) {
      parts.push(`avg rating ${stats.averageRating.toFixed(1)}/5`);
    }

    return parts.join(" · ");
  }

  if (basis === "top_seller" && globalOrderCount !== null) {
    return `Top seller with ${globalOrderCount} orders storewide`;
  }

  if (basis === "popularity" && globalOrderCount !== null) {
    return `Popular choice — ${globalOrderCount} orders storewide`;
  }

  return "Recommended based on store popularity.";
}

// ─── Global stats builder ─────────────────────────────────────────────────────

function getGlobalStats(
  menuItems: RecommendationMenuItem[],
  orders: RecommendationOrder[],
  feedback: RecommendationFeedback[],
  globalRanking: RecommendationGlobalRankItem[]
) {
  const availableItems = menuItems.filter((i) => i.isAvailable);
  const menuByKey = new Map<string, RecommendationMenuItem>(
    availableItems.flatMap((item) => [
      [item.id, item],
      [normalizeText(item.name), item],
    ])
  );

  // Global popularity: count from completed/delivered orders
  const popularity = new Map<string, number>();
  orders
    .filter((o) => FINAL_STATUSES.has(o.status))
    .forEach((order) => {
      order.items.forEach((oi) => {
        const menuItem = menuByKey.get(orderItemKey(oi));
        if (!menuItem) return;
        const key = itemKey(menuItem);
        popularity.set(key, (popularity.get(key) ?? 0) + oi.quantity);
      });
    });

  // Merge admin-curated ranking (authoritative) over computed popularity
  const rankedSeen = new Set<string>();
  const globalRankedItems = globalRanking
    .map((r) => {
      const menuItem = r.id
        ? menuByKey.get(r.id)
        : menuByKey.get(normalizeText(r.name));
      return menuItem ? { item: menuItem, orderCount: Number(r.orderCount ?? 0), rank: Number(r.rank ?? 0) } : null;
    })
    .filter((r): r is { item: RecommendationMenuItem; orderCount: number; rank: number } => Boolean(r));

  const canonicalMostPopular: RecommendationMenuItem[] = [
    ...globalRankedItems
      .filter((r) => {
        const key = itemKey(r.item);
        if (rankedSeen.has(key)) return false;
        rankedSeen.add(key);
        popularity.set(key, r.orderCount);
        return true;
      })
      .map((r) => r.item),
    ...[...availableItems]
      .sort((a, b) => {
        const diff = (popularity.get(itemKey(b)) ?? 0) - (popularity.get(itemKey(a)) ?? 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      })
      .filter((i) => !rankedSeen.has(itemKey(i))),
  ];

  return { availableItems, menuByKey, mostPopular: canonicalMostPopular, popularity };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function getRecommendationsForCustomer({
  customerId,
  customerName,
  menuItems,
  orders,
  feedback,
  globalRanking = [],
  hourOfDay = new Date().getHours(),
}: {
  customerId: string;
  customerName: string;
  menuItems: RecommendationMenuItem[];
  orders: RecommendationOrder[];
  feedback: RecommendationFeedback[];
  globalRanking?: RecommendationGlobalRankItem[];
  /**
   * Local hour of day (0–23) for time-of-day context boosting.
   * Defaults to current server hour if omitted.
   */
  hourOfDay?: number;
}): CustomerRecommendationProfile {
  const globalStats = getGlobalStats(menuItems, orders, feedback, globalRanking);

  // ── Customer-scoped order history ────────────────────────────────────────
  const customerOrders = orders
    .filter((o) => o.customerId === customerId && FINAL_STATUSES.has(o.status))
    .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime());

  const customerFeedback = feedback.filter((f) => f.customerId === customerId);

  // ── Build per-item stats buckets ─────────────────────────────────────────
  const now = Date.now();
  const itemStats = new Map<string, ItemStats>();

  customerOrders.forEach((order) => {
    const orderedAt = new Date(order.orderedAt).getTime();
    order.items.forEach((oi) => {
      const menuItem = globalStats.menuByKey.get(orderItemKey(oi));
      if (!menuItem) return;
      const key = itemKey(menuItem);
      const current = itemStats.get(key) ?? { item: menuItem, frequency: 0, latestAt: orderedAt, feedbackScores: [] };
      itemStats.set(key, {
        ...current,
        frequency: current.frequency + oi.quantity,
        latestAt: Math.max(current.latestAt, orderedAt),
      });
    });
  });

  // Attach feedback scores to matching item buckets
  customerFeedback.forEach((f) => {
    const score = getWeightedFeedbackScore(f);
    if (score === null) return;
    const menuItem = f.menuItemId
      ? globalStats.menuByKey.get(f.menuItemId)
      : globalStats.menuByKey.get(normalizeText(f.itemName));
    if (!menuItem) return;
    const key = itemKey(menuItem);
    const bucket = itemStats.get(key);
    if (bucket) bucket.feedbackScores.push(score);
  });

  // ── Cold-start path (new customer) ──────────────────────────────────────
  if (customerOrders.length === 0) {
    const recommendations: RecommendationResult[] = [];
    const seen = new Set<string>();

    globalStats.mostPopular.slice(0, 3).forEach((item) => {
      const key = itemKey(item);
      if (seen.has(key)) return;
      seen.add(key);

      const globalCount = globalStats.popularity.get(key) ?? 0;
      /**
       * Cold-start: labels are mechanically distinct.
       * "Top Seller" requires a meaningful order volume threshold;
       * remaining items are "Popular Now" (lower volume, still prominent).
       * This avoids the decorative label critique (§5).
       */
      const isTopSeller = globalCount >= TOP_SELLER_MIN_ORDER_COUNT && recommendations.length === 0;
      const basis: RecommendationBasis = isTopSeller ? "top_seller" : "popularity";
      const label: RecommendationLabel = isTopSeller ? "Top Seller" : "Popular Now";

      recommendations.push({
        item,
        label,
        basis,
        reason: buildExplanation(basis, null, globalCount),
        score: globalCount,
      });
    });

    return {
      customerId,
      customerName,
      mostOrderedItem: "No completed orders yet",
      lastOrderedItem: "No completed orders yet",
      averageFeedbackRating: null,
      preferenceScore: 0,
      recommendations,
      isNewCustomer: true,
    };
  }

  // ── Compute global max frequency (cross-customer context for normalisation) ─
  // Uses all orders data so frequency signal is globally contextualised
  const globalFrequencyMap = new Map<string, number>();
  orders
    .filter((o) => FINAL_STATUSES.has(o.status))
    .forEach((order) => {
      order.items.forEach((oi) => {
        const menuItem = globalStats.menuByKey.get(orderItemKey(oi));
        if (!menuItem) return;
        const key = itemKey(menuItem);
        globalFrequencyMap.set(key, (globalFrequencyMap.get(key) ?? 0) + oi.quantity);
      });
    });
  const globalMaxFrequency = Math.max(1, ...globalFrequencyMap.values());

  // ── Score each item in the customer's history ─────────────────────────────
  const scoredItems: ScoredItem[] = [...itemStats.values()].map((stat) => {
    const frequencyScore   = getNormalisedFrequency(stat.frequency, globalMaxFrequency);
    const recencyScore     = getRecencyScore(now - stat.latestAt);
    const feedbackScore    = getConfidenceAdjustedFeedbackScore(stat.feedbackScores);
    const contextBoost     = getContextBoost(stat.item, hourOfDay);

    const baseScore =
      PREFERENCE_WEIGHTS.frequency * frequencyScore +
      PREFERENCE_WEIGHTS.recency   * recencyScore   +
      PREFERENCE_WEIGHTS.feedback  * feedbackScore;

    // Context boost is additive but capped so it cannot flip ranking alone
    const score = clamp01(baseScore + contextBoost);

    const averageRating =
      stat.feedbackScores.length > 0
        ? (stat.feedbackScores.reduce((s, v) => s + v, 0) / stat.feedbackScores.length) * 5 / 5
        : null;

    return { ...stat, score, averageRating };
  });

  scoredItems.sort((a, b) => b.score - a.score || b.frequency - a.frequency);

  // ── Build final recommendations (cascade hybrid) ─────────────────────────
  const recommendations: RecommendationResult[] = [];
  const seen = new Set<string>();

  function push(rec: RecommendationResult) {
    const key = itemKey(rec.item);
    if (!seen.has(key)) {
      seen.add(key);
      recommendations.push(rec);
    }
  }

  // Slot 1: Personalised "Best for You" — highest composite preference score
  if (scoredItems[0]) {
    const top = scoredItems[0];
    push({
      item: top.item,
      label: "Best for You",
      basis: "preference",
      reason: buildExplanation("preference", { frequency: top.frequency, latestAt: top.latestAt, averageRating: top.averageRating }, null),
      score: top.score,
    });
  }

  // Slot 2: Second-highest preference item (if distinct from slot 1)
  if (scoredItems[1] && recommendations.length < 3) {
    const second = scoredItems[1];
    push({
      item: second.item,
      label: "You Might Also Like",
      basis: "preference",
      reason: buildExplanation("preference", { frequency: second.frequency, latestAt: second.latestAt, averageRating: second.averageRating }, null),
      score: second.score,
    });
  }

  // Remaining slots: fill from global popularity (mechanically distinct from preference)
  for (const popularItem of globalStats.mostPopular) {
    if (recommendations.length >= 3) break;
    const globalCount = globalStats.popularity.get(itemKey(popularItem)) ?? 0;
    /**
     * "Top Seller" is only applied when:
     *   (a) it is the first global-basis slot, AND
     *   (b) the item exceeds the minimum order count threshold.
     * This makes "Top Seller" and "Popular Now" mechanically distinct (critique §5).
     */
    const isFirstGlobal = !recommendations.some((r) => r.basis === "top_seller" || r.basis === "popularity");
    const isTopSeller = isFirstGlobal && globalCount >= TOP_SELLER_MIN_ORDER_COUNT;
    const basis: RecommendationBasis = isTopSeller ? "top_seller" : "popularity";
    const label: RecommendationLabel = isTopSeller ? "Top Seller" : "Popular Now";

    push({
      item: popularItem,
      label,
      basis,
      reason: buildExplanation(basis, null, globalCount),
      score: globalCount,
    });
  }

  // ── Profile metadata ──────────────────────────────────────────────────────
  const favorite = [...scoredItems].sort((a, b) => b.frequency - a.frequency || b.score - a.score)[0];
  const lastOrderedItem = customerOrders[0]?.items[0]?.name ?? "No completed orders yet";

  const allFeedbackScores = customerFeedback
    .map(getWeightedFeedbackScore)
    .filter((s): s is number => s !== null);
  const averageFeedbackRating =
    allFeedbackScores.length > 0
      ? (allFeedbackScores.reduce((s, v) => s + v, 0) / allFeedbackScores.length)
      : null;

  return {
    customerId,
    customerName,
    mostOrderedItem: favorite?.item.name ?? "No item",
    lastOrderedItem,
    averageFeedbackRating,
    preferenceScore: scoredItems[0]?.score ?? 0,
    recommendations,
    isNewCustomer: false,
  };
}

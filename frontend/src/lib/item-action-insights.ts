export type ItemActionInsightIcon = "TrendingDown" | "Flame";
export type ItemActionInsightType = "info" | "warning";

export type ItemActionInsight = {
  icon: ItemActionInsightIcon;
  title: string;
  description: string;
  type: ItemActionInsightType;
};

export type ItemRankingRow = {
  item: string;
  orders: number;
  rating: number;
};

// Below this, item-level suggestions are too noisy to be meaningful (a slow
// day makes almost everything look "underperforming"). Matches the spirit of
// MIN_HISTORY_DAYS in demand-forecast.ts: don't draw conclusions from too
// little data.
const MIN_TOTAL_ORDERS = 20;
const LOW_DEMAND_RATIO = 0.5;
const HIGH_DEMAND_RATIO = 2;
const GOOD_RATING_THRESHOLD = 4;
const MAX_ITEM_ACTION_INSIGHTS = 2;

type FlaggedItem = {
  row: ItemRankingRow;
  direction: "low" | "high";
  deviation: number;
};

export function buildItemActionInsights(
  itemRanking: ItemRankingRow[],
  hasRealRatingData: boolean,
  totalOrders: number
): ItemActionInsight[] {
  if (totalOrders < MIN_TOTAL_ORDERS || itemRanking.length === 0) {
    return [];
  }

  const averageOrders =
    itemRanking.reduce((sum, row) => sum + row.orders, 0) / itemRanking.length;

  if (averageOrders <= 0) {
    return [];
  }

  const flagged: FlaggedItem[] = [];

  for (const row of itemRanking) {
    if (row.orders < LOW_DEMAND_RATIO * averageOrders) {
      flagged.push({ row, direction: "low", deviation: averageOrders - row.orders });
    } else if (row.orders > HIGH_DEMAND_RATIO * averageOrders) {
      flagged.push({ row, direction: "high", deviation: row.orders - averageOrders });
    }
  }

  flagged.sort((a, b) => b.deviation - a.deviation);

  return flagged.slice(0, MAX_ITEM_ACTION_INSIGHTS).map(({ row, direction }): ItemActionInsight => {
    if (direction === "high") {
      return {
        icon: "Flame",
        title: `${row.item} is in high demand`,
        description: `${row.item} is selling much more than usual — make sure you have enough cups, ingredients, and stock to keep up with demand.`,
        type: "info",
      };
    }

    if (!hasRealRatingData) {
      return {
        icon: "TrendingDown",
        title: `${row.item} has low demand`,
        description:
          "Not enough feedback to diagnose — a short promo could help surface why it's not selling.",
        type: "info",
      };
    }

    if (row.rating >= GOOD_RATING_THRESHOLD) {
      return {
        icon: "TrendingDown",
        title: `${row.item} has low demand`,
        description: `Customers who try ${row.item} like it — feature it more, bundle it with a bestseller, or add it to recommendations.`,
        type: "info",
      };
    }

    return {
      icon: "TrendingDown",
      title: `${row.item} has low demand`,
      description: `${row.item} has low demand and low ratings — consider reviewing the recipe or quality before promoting it further.`,
      type: "warning",
    };
  });
}

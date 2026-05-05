export type AnalyticsRankingRow = {
  item_id?: string | null;
  menu_item_id?: string | null;
  item_name?: string | null;
  order_count?: number | null;
  quantity_sold?: number | null;
  total_revenue?: number | null;
  sales_rank?: number | null;
};

export function getAnalyticsItemId(row: AnalyticsRankingRow) {
  return row.menu_item_id ?? row.item_id ?? null;
}

export function getAnalyticsOrderCount(row: AnalyticsRankingRow) {
  const orderCount = Number(row.order_count);
  return Number.isFinite(orderCount) ? orderCount : 0;
}

function getNumberValue(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function sortAnalyticsItemsByGlobalRanking<T extends AnalyticsRankingRow>(
  rows: T[]
) {
  return [...rows].sort((left, right) => {
    const orderDifference =
      getAnalyticsOrderCount(right) - getAnalyticsOrderCount(left);

    if (orderDifference !== 0) {
      return orderDifference;
    }

    const quantityDifference =
      getNumberValue(right.quantity_sold) - getNumberValue(left.quantity_sold);

    if (quantityDifference !== 0) {
      return quantityDifference;
    }

    const revenueDifference =
      getNumberValue(right.total_revenue) - getNumberValue(left.total_revenue);

    if (revenueDifference !== 0) {
      return revenueDifference;
    }

    const rankDifference =
      getNumberValue(left.sales_rank) - getNumberValue(right.sales_rank);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    return (left.item_name ?? getAnalyticsItemId(left) ?? "").localeCompare(
      right.item_name ?? getAnalyticsItemId(right) ?? ""
    );
  });
}

export type RecommendationBasis =
  | "preference"
  | "frequency"
  | "popularity"
  | "rating";

export type RecommendationLabel =
  | "Best for you"
  | "Your Favorite"
  | "Popular Now"
  | "Most popular"
  | "Highest rated";

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

export type RecommendationResult = {
  item: RecommendationMenuItem;
  label: RecommendationLabel;
  basis: RecommendationBasis;
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

const finalStatuses = new Set(["completed", "delivered"]);

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function itemKey(item: { id?: string | null; name: string }) {
  return item.id || normalizeText(item.name);
}

function orderItemKey(item: { menuItemId?: string | null; name: string }) {
  return item.menuItemId || normalizeText(item.name);
}

function getFeedbackRating(feedback: RecommendationFeedback) {
  const ratings = [
    feedback.tasteRating,
    feedback.strengthRating,
    feedback.overallRating,
  ]
    .map((rating) => Number(rating))
    .filter((rating) => Number.isFinite(rating) && rating > 0);

  if (ratings.length === 0) return null;

  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function dedupeRecommendations(recommendations: RecommendationResult[]) {
  const seen = new Set<string>();

  return recommendations.filter((recommendation) => {
    const key = itemKey(recommendation.item);

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function getAvailableMenu(items: RecommendationMenuItem[]) {
  return items.filter((item) => item.isAvailable);
}

function getGlobalStats(
  menuItems: RecommendationMenuItem[],
  orders: RecommendationOrder[],
  feedback: RecommendationFeedback[]
) {
  const availableItems = getAvailableMenu(menuItems);
  const menuByKey = new Map(
    availableItems.flatMap((item) => [
      [item.id, item],
      [normalizeText(item.name), item],
    ])
  );
  const popularity = new Map<string, number>();
  const ratingMap = new Map<string, number[]>();

  orders
    .filter((order) => finalStatuses.has(order.status))
    .forEach((order) => {
      order.items.forEach((item) => {
        const menuItem = menuByKey.get(orderItemKey(item));

        if (!menuItem) return;

        const key = itemKey(menuItem);
        popularity.set(key, (popularity.get(key) ?? 0) + item.quantity);
      });
    });

  feedback.forEach((row) => {
    const rating = getFeedbackRating(row);

    if (!rating) return;

    const menuItem = row.menuItemId
      ? menuByKey.get(row.menuItemId)
      : menuByKey.get(normalizeText(row.itemName));

    if (!menuItem) return;

    const key = itemKey(menuItem);
    const ratings = ratingMap.get(key) ?? [];
    ratingMap.set(key, [...ratings, rating]);
  });

  const mostPopular = [...availableItems].sort((first, second) => {
    const firstCount = popularity.get(itemKey(first)) ?? 0;
    const secondCount = popularity.get(itemKey(second)) ?? 0;

    return secondCount - firstCount || first.name.localeCompare(second.name);
  });
  const highestRated = [...availableItems].sort((first, second) => {
    const firstRating = average(ratingMap.get(itemKey(first)) ?? []) ?? 0;
    const secondRating = average(ratingMap.get(itemKey(second)) ?? []) ?? 0;

    return secondRating - firstRating || first.name.localeCompare(second.name);
  });

  return {
    availableItems,
    menuByKey,
    mostPopular,
    highestRated,
    popularity,
    ratingMap,
  };
}

function makeRecommendation(
  item: RecommendationMenuItem,
  label: RecommendationLabel,
  basis: RecommendationBasis,
  reason: string,
  score: number
): RecommendationResult {
  return {
    item,
    label,
    basis,
    reason,
    score,
  };
}

export function getRecommendationsForCustomer({
  customerId,
  customerName,
  menuItems,
  orders,
  feedback,
}: {
  customerId: string;
  customerName: string;
  menuItems: RecommendationMenuItem[];
  orders: RecommendationOrder[];
  feedback: RecommendationFeedback[];
}): CustomerRecommendationProfile {
  const globalStats = getGlobalStats(menuItems, orders, feedback);
  const customerOrders = orders
    .filter(
      (order) =>
        order.customerId === customerId && finalStatuses.has(order.status)
    )
    .sort(
      (first, second) =>
        new Date(second.orderedAt).getTime() -
        new Date(first.orderedAt).getTime()
    );
  const customerFeedback = feedback.filter(
    (row) => row.customerId === customerId
  );
  const customerItemStats = new Map<
    string,
    {
      item: RecommendationMenuItem;
      frequency: number;
      latestAt: number;
      ratings: number[];
    }
  >();
  const now = Date.now();

  customerOrders.forEach((order) => {
    const orderedAt = new Date(order.orderedAt).getTime();

    order.items.forEach((orderItem) => {
      const menuItem = globalStats.menuByKey.get(orderItemKey(orderItem));

      if (!menuItem) return;

      const key = itemKey(menuItem);
      const current = customerItemStats.get(key) ?? {
        item: menuItem,
        frequency: 0,
        latestAt: orderedAt,
        ratings: [],
      };

      customerItemStats.set(key, {
        ...current,
        frequency: current.frequency + orderItem.quantity,
        latestAt: Math.max(current.latestAt, orderedAt),
      });
    });
  });

  customerFeedback.forEach((row) => {
    const rating = getFeedbackRating(row);

    if (!rating) return;

    const menuItem = row.menuItemId
      ? globalStats.menuByKey.get(row.menuItemId)
      : globalStats.menuByKey.get(normalizeText(row.itemName));

    if (!menuItem) return;

    const key = itemKey(menuItem);
    const current = customerItemStats.get(key);

    if (!current) return;

    current.ratings.push(rating);
  });

  if (customerOrders.length === 0) {
    const mostPopular =
      globalStats.mostPopular.find(
        (item) => (globalStats.popularity.get(itemKey(item)) ?? 0) > 0
      ) ?? globalStats.availableItems[0];
    const highestRated =
      globalStats.highestRated.find(
        (item) => (average(globalStats.ratingMap.get(itemKey(item)) ?? []) ?? 0) > 0
      ) ??
      globalStats.availableItems.find(
        (item) => itemKey(item) !== itemKey(mostPopular)
      );
    const recommendations = dedupeRecommendations(
      [
        mostPopular
          ? makeRecommendation(
              mostPopular,
              "Popular Now",
              "popularity",
              "Global top-selling item for discovery.",
              globalStats.popularity.get(itemKey(mostPopular)) ?? 0
            )
          : null,
        highestRated
          ? makeRecommendation(
              highestRated,
              "Best for you",
              "rating",
              "Top-N starter result based on available ratings.",
              average(globalStats.ratingMap.get(itemKey(highestRated)) ?? []) ?? 0
            )
          : null,
      ].filter(Boolean) as RecommendationResult[]
    ).slice(0, 2);

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

  const maxFrequency = Math.max(
    1,
    ...[...customerItemStats.values()].map((stat) => stat.frequency)
  );
  const scoredItems = [...customerItemStats.values()]
    .map((stat) => {
      const frequency = stat.frequency / maxFrequency;
      const ageDays = Math.max(0, (now - stat.latestAt) / 86_400_000);
      const recency = 1 / (1 + ageDays / 30);
      const feedbackRating = (average(stat.ratings) ?? 3) / 5;
      const score =
        0.5 * frequency + 0.3 * recency + 0.2 * feedbackRating;

      return {
        ...stat,
        score,
        averageRating: average(stat.ratings),
      };
    })
    .sort((first, second) => second.score - first.score);
  const favorite = [...scoredItems].sort(
    (first, second) =>
      second.frequency - first.frequency || second.score - first.score
  )[0];
  const lastOrderedItem =
    customerOrders[0]?.items[0]?.name ?? "No completed orders yet";
  const triedKeys = new Set(scoredItems.map((stat) => itemKey(stat.item)));
  const discover =
    globalStats.mostPopular.find((item) => !triedKeys.has(itemKey(item))) ??
    globalStats.highestRated.find((item) => !triedKeys.has(itemKey(item))) ??
    globalStats.availableItems.find((item) => !triedKeys.has(itemKey(item)));
  const fallbackItems = [
    ...globalStats.mostPopular,
    ...globalStats.highestRated,
    ...globalStats.availableItems,
  ];
  const recommendations = dedupeRecommendations([
    scoredItems[0]
      ? makeRecommendation(
          scoredItems[0].item,
          "Best for you",
          "preference",
          "Top-N result based on frequency, recency, and feedback rating.",
          scoredItems[0].score
        )
      : null,
    favorite
      ? makeRecommendation(
          favorite.item,
          "Your Favorite",
          "frequency",
          `Most frequently ordered item: ${favorite.frequency} ordered.`,
          favorite.frequency
        )
      : null,
    discover
      ? makeRecommendation(
          discover,
          "Popular Now",
          (globalStats.popularity.get(itemKey(discover)) ?? 0) > 0
            ? "popularity"
            : "rating",
          "Global top-selling or high-rated item for discovery.",
          globalStats.popularity.get(itemKey(discover)) ?? 0
        )
      : null,
    ...fallbackItems.map((item) =>
      makeRecommendation(
        item,
        "Popular Now",
        "popularity",
        "Global top-selling or high-rated item for discovery.",
        globalStats.popularity.get(itemKey(item)) ?? 0
      )
    ),
  ].filter(Boolean) as RecommendationResult[]).slice(0, 3);

  return {
    customerId,
    customerName,
    mostOrderedItem: favorite?.item.name ?? "No item",
    lastOrderedItem,
    averageFeedbackRating: average(
      customerFeedback
        .map(getFeedbackRating)
        .filter((rating): rating is number => typeof rating === "number")
    ),
    preferenceScore: scoredItems[0]?.score ?? 0,
    recommendations,
    isNewCustomer: false,
  };
}

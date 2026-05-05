import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CustomerPreferenceRow = {
  menu_item_id: string | null;
  preference_score: number | null;
};

type AnalyticsItemRow = {
  item_id?: string | null;
  menu_item_id?: string | null;
  item_name?: string | null;
  order_count?: number | null;
  total_revenue: number | null;
  quantity_sold: number | null;
  sales_rank?: number | null;
};

type MenuItemRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  base_price: number;
  image_url: string | null;
  is_available: boolean;
  has_sugar_level: boolean | null;
  has_ice_level: boolean | null;
  has_size_option: boolean | null;
  has_temp_option: boolean | null;
};

type RecommendationBasis = "preference" | "popularity";

const MENU_ITEM_COLUMNS =
  "id, name, description, category, base_price, image_url, is_available, has_sugar_level, has_ice_level, has_size_option, has_temp_option";

function getNumberValue(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeMenuItem(
  item: MenuItemRow,
  score: number | null,
  rank: number,
  basis: RecommendationBasis
) {
  return {
    rank,
    label: basis === "preference" ? "Best for You" : "Popular Picks",
    basis,
    reason:
      basis === "preference"
        ? "Recommended from your preference score."
        : "Popular pick based on item analytics.",
    item_id: item.id,
    item_name: item.name,
    price: Number(item.base_price ?? 0),
    image_url: item.image_url,
    category: item.category,
    preference_score: basis === "preference" ? score : null,
    item: {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      base_price: Number(item.base_price ?? 0),
      image_url: item.image_url,
      is_available: Boolean(item.is_available),
      has_sugar_level: Boolean(item.has_sugar_level),
      has_ice_level: Boolean(item.has_ice_level),
      has_size_option: Boolean(item.has_size_option),
      has_temp_option: Boolean(item.has_temp_option),
    },
  };
}

function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      ids.filter(
        (id): id is string =>
          typeof id === "string" && id.trim().length > 0 && id !== "null"
      )
    )
  );
}

function sortMenuByRequestedIds(menuItems: MenuItemRow[], requestedIds: string[]) {
  const orderById = new Map(requestedIds.map((id, index) => [id, index]));

  return [...menuItems].sort(
    (left, right) =>
      (orderById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderById.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name)
  );
}

function getAnalyticsItemId(row: AnalyticsItemRow) {
  return row.menu_item_id ?? row.item_id ?? null;
}

function getOrderFrequency(row: AnalyticsItemRow) {
  return Math.max(getNumberValue(row.quantity_sold), getNumberValue(row.order_count));
}

function sortAnalyticsItemsByFrequency(rows: AnalyticsItemRow[]) {
  return [...rows].sort((left, right) => {
    const orderDifference = getOrderFrequency(right) - getOrderFrequency(left);

    if (orderDifference !== 0) {
      return orderDifference;
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

    return (getAnalyticsItemId(left) ?? "").localeCompare(
      getAnalyticsItemId(right) ?? ""
    );
  });
}

function getAnalyticsDebugRow(row: AnalyticsItemRow | null) {
  if (!row) {
    return null;
  }

  return {
    item_id: getAnalyticsItemId(row),
    item_name: row.item_name ?? null,
    total_orders: getOrderFrequency(row),
    order_count: getNumberValue(row.order_count),
    quantity_sold: getNumberValue(row.quantity_sold),
    total_revenue: getNumberValue(row.total_revenue),
    sales_rank: getNumberValue(row.sales_rank),
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: preferenceRows, error: preferenceError } = await supabase
      .from("customer_preferences")
      .select("menu_item_id, preference_score")
      .eq("customer_id", user.id)
      .order("preference_score", { ascending: false })
      .limit(12)
      .returns<CustomerPreferenceRow[]>();

    let recommendations: ReturnType<typeof normalizeMenuItem>[] = [];
    const selectedItemIds = new Set<string>();

    if (!preferenceError && preferenceRows && preferenceRows.length > 0) {
      const preferenceByItemId = new Map(
        preferenceRows.map((row) => [
          row.menu_item_id,
          getNumberValue(row.preference_score),
        ])
      );
      const preferredItemIds = uniqueIds(preferenceRows.map((row) => row.menu_item_id));

      if (preferredItemIds.length > 0) {
        const { data: preferredMenuItems, error: preferredMenuError } = await supabase
          .from("menu_items")
          .select(MENU_ITEM_COLUMNS)
          .in("id", preferredItemIds)
          .eq("is_available", true)
          .returns<MenuItemRow[]>();

        if (preferredMenuError) {
          return NextResponse.json(
            { error: preferredMenuError.message },
            { status: 500 }
          );
        }

        const personalizedRecommendations = sortMenuByRequestedIds(
          preferredMenuItems ?? [],
          preferredItemIds
        )
          .slice(0, 1)
          .map((item, index) =>
            normalizeMenuItem(
              item,
              preferenceByItemId.get(item.id) ?? null,
              index + 1,
              "preference"
            )
          );

        personalizedRecommendations.forEach((recommendation) => {
          selectedItemIds.add(recommendation.item_id);
        });

        recommendations = personalizedRecommendations;
      }
    }

    const { data: analyticsRows, error: analyticsError } = await adminSupabase
      .from("analytics_items")
      .select(
        "item_id, menu_item_id, item_name, order_count, quantity_sold, total_revenue, sales_rank"
      )
      .returns<AnalyticsItemRow[]>();

    if (analyticsError) {
      return NextResponse.json(
        { error: analyticsError.message },
        { status: 500 }
      );
    }

    const sortedAnalyticsRows = sortAnalyticsItemsByFrequency(analyticsRows ?? []);
    const adminTopAnalyticsRow = sortedAnalyticsRows[0] ?? null;
    const sortedPopularItemIds = uniqueIds(sortedAnalyticsRows.map(getAnalyticsItemId));
    const popularItemIds =
      sortedPopularItemIds.length > 0
        ? sortedPopularItemIds.filter((id) => !selectedItemIds.has(id))
        : [];
    let fallbackMenuItems: MenuItemRow[] = [];

    if (popularItemIds.length > 0) {
      const { data: popularMenuItems, error: popularMenuError } = await adminSupabase
        .from("menu_items")
        .select(MENU_ITEM_COLUMNS)
        .in("id", popularItemIds)
        .returns<MenuItemRow[]>();

      if (popularMenuError) {
        return NextResponse.json(
          { error: popularMenuError.message },
          { status: 500 }
        );
      }

      fallbackMenuItems = sortMenuByRequestedIds(
        popularMenuItems ?? [],
        popularItemIds
      );
    }

    if (sortedAnalyticsRows.length === 0 && fallbackMenuItems.length < 3) {
      const existingIds = new Set([
        ...fallbackMenuItems.map((item) => item.id),
        ...selectedItemIds,
      ]);
      const { data: menuRows, error: menuError } = await supabase
        .from("menu_items")
        .select(MENU_ITEM_COLUMNS)
        .eq("is_available", true)
        .order("name", { ascending: true })
        .limit(12)
        .returns<MenuItemRow[]>();

      if (menuError) {
        return NextResponse.json({ error: menuError.message }, { status: 500 });
      }

      fallbackMenuItems = [
        ...fallbackMenuItems,
        ...(menuRows ?? []).filter((item) => !existingIds.has(item.id)),
      ];
    }

    const remainingSlots = Math.max(0, 3 - recommendations.length);
    const fallbackRecommendations = fallbackMenuItems
      .slice(0, remainingSlots)
      .map((item, index) =>
        normalizeMenuItem(
          item,
          null,
          recommendations.length + index + 1,
          "popularity"
        )
      );

    recommendations = [...recommendations, ...fallbackRecommendations];
    const topSellerRecommendation =
      recommendations.find((recommendation) => recommendation.basis === "popularity") ??
      null;
    const debug = {
      sourceTable: sortedAnalyticsRows.length > 0 ? "analytics_items" : "menu_items fallback",
      sourceQuery:
        "analytics_items sorted by quantity_sold/order_count DESC, total_revenue DESC, sales_rank ASC",
      adminTopItemResult: getAnalyticsDebugRow(adminTopAnalyticsRow),
      customerTopSellerResult: topSellerRecommendation
        ? {
            item_id: topSellerRecommendation.item_id,
            item_name: topSellerRecommendation.item_name,
            rank: topSellerRecommendation.rank,
            basis: topSellerRecommendation.basis,
          }
        : null,
    };

    console.log("[KadaServe Recommendations] Source table/query used", debug.sourceQuery);
    console.log("[KadaServe Recommendations] Admin top item result", debug.adminTopItemResult);
    console.log(
      "[KadaServe Recommendations] Customer top seller result",
      debug.customerTopSellerResult
    );

    return NextResponse.json({
      source:
        recommendations.some((recommendation) => recommendation.basis === "preference")
          ? "customer_preferences"
          : "analytics_items",
      recommendations,
      debug,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading recommendations." },
      { status: 500 }
    );
  }
}

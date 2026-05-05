import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getAnalyticsItemId,
  sortAnalyticsItemsByGlobalRanking,
} from "@/lib/analytics-ranking";

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

type RecommendationBasis = "preference" | "top_seller" | "popularity";
type RecommendationCard = ReturnType<typeof normalizeMenuItem>;

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
    label:
      basis === "preference"
        ? "Best for You"
        : basis === "top_seller"
        ? "Top Seller"
        : "Popular Now",
    basis,
    reason:
      basis === "preference"
        ? "Recommended from your preference score."
        : basis === "top_seller"
        ? "Global most ordered item from Admin Item Ranking."
        : "Global popular item from Admin Item Ranking.",
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

function appendUniqueRecommendation(
  recommendations: RecommendationCard[],
  recommendation: RecommendationCard | null
) {
  if (
    recommendation &&
    !recommendations.some((item) => item.item_id === recommendation.item_id)
  ) {
    recommendations.push(recommendation);
  }
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

    const recommendations: RecommendationCard[] = [];

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

        const personalizedRecommendation = sortMenuByRequestedIds(
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
          )[0] ?? null;

        appendUniqueRecommendation(recommendations, personalizedRecommendation);
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

    const sortedAnalyticsRows = sortAnalyticsItemsByGlobalRanking(analyticsRows ?? []);
    const sortedPopularItemIds = uniqueIds(sortedAnalyticsRows.map(getAnalyticsItemId));
    let rankedMenuItems: MenuItemRow[] = [];

    if (sortedPopularItemIds.length > 0) {
      const { data: popularMenuItems, error: popularMenuError } = await adminSupabase
        .from("menu_items")
        .select(MENU_ITEM_COLUMNS)
        .in("id", sortedPopularItemIds)
        .returns<MenuItemRow[]>();

      if (popularMenuError) {
        return NextResponse.json(
          { error: popularMenuError.message },
          { status: 500 }
        );
      }

      rankedMenuItems = sortMenuByRequestedIds(
        popularMenuItems ?? [],
        sortedPopularItemIds
      );
    }

    if (sortedAnalyticsRows.length === 0 && rankedMenuItems.length < 3) {
      const existingIds = new Set(rankedMenuItems.map((item) => item.id));
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

      rankedMenuItems = [
        ...rankedMenuItems,
        ...(menuRows ?? []).filter((item) => !existingIds.has(item.id)),
      ];
    }

    rankedMenuItems.forEach((item, index) => {
      if (recommendations.length >= 3) {
        return;
      }

      const isTopSeller = index === 0;

      appendUniqueRecommendation(
        recommendations,
        normalizeMenuItem(
          item,
          null,
          index + 1,
          isTopSeller ? "top_seller" : "popularity"
        )
      );
    });

    return NextResponse.json({
      source:
        recommendations.some((recommendation) => recommendation.basis === "preference")
          ? "customer_preferences"
          : "analytics_items",
      recommendations,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading recommendations." },
      { status: 500 }
    );
  }
}

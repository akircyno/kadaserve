import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CustomerPreferenceRow = {
  menu_item_id: string | null;
  preference_score: number | null;
};

type AnalyticsItemRow = {
  item_id?: string | null;
  menu_item_id?: string | null;
  total_revenue: number | null;
  quantity_sold: number | null;
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

export async function GET() {
  try {
    const supabase = await createClient();
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
          .slice(0, 3)
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

        if (personalizedRecommendations.length >= 3) {
          return NextResponse.json({
            source: "customer_preferences",
            recommendations: personalizedRecommendations,
          });
        }

        recommendations = personalizedRecommendations;
      }
    }

    const { data: analyticsRows } = await supabase
      .from("analytics_items")
      .select("item_id, menu_item_id, total_revenue, quantity_sold")
      .order("total_revenue", { ascending: false })
      .order("quantity_sold", { ascending: false })
      .limit(12)
      .returns<AnalyticsItemRow[]>();
    const popularItemIds = uniqueIds(
      (analyticsRows ?? []).map((row) => row.menu_item_id ?? row.item_id)
    ).filter((id) => !selectedItemIds.has(id));
    let fallbackMenuItems: MenuItemRow[] = [];

    if (popularItemIds.length > 0) {
      const { data: popularMenuItems, error: popularMenuError } = await supabase
        .from("menu_items")
        .select(MENU_ITEM_COLUMNS)
        .in("id", popularItemIds)
        .eq("is_available", true)
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

    if (fallbackMenuItems.length < 3) {
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

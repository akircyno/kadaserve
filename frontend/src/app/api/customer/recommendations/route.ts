import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getAnalyticsItemId,
  sortAnalyticsItemsByGlobalRanking,
} from "@/lib/analytics-ranking";
import {
  getRecommendationsForCustomer,
  type RecommendationFeedback,
  type RecommendationGlobalRankItem,
  type RecommendationMenuItem,
  type RecommendationOrder,
} from "@/lib/recommendations";

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

type OrderRecommendationRow = {
  id: string;
  customer_id?: string | null;
  status: string;
  ordered_at: string;
  order_items?: Array<{
    quantity: number | null;
    menu_items:
      | {
          id: string | null;
          name: string | null;
          category: string | null;
        }
      | Array<{
          id: string | null;
          name: string | null;
          category: string | null;
        }>
      | null;
  }> | null;
};

type FeedbackRecommendationRow = {
  customer_id?: string | null;
  menu_item_id: string | null;
  taste_rating: number | null;
  strength_rating: number | null;
  overall_rating: number | null;
};

const MENU_ITEM_COLUMNS =
  "id, name, description, category, base_price, image_url, is_available, has_sugar_level, has_ice_level, has_size_option, has_temp_option";

function makeRecommendationCard(
  recommendation: ReturnType<typeof getRecommendationsForCustomer>["recommendations"][number],
  rank: number
) {
  const item = recommendation.item;

  return {
    rank,
    label: recommendation.label,
    basis: recommendation.basis,
    reason: recommendation.reason,
    item_id: item.id,
    item_name: item.name,
    price: Number(item.price ?? 0),
    image_url: item.imageUrl ?? null,
    category: item.category,
    preference_score:
      recommendation.basis === "preference" ? recommendation.score : null,
    item: {
      id: item.id,
      name: item.name,
      description: null,
      category: item.category,
      base_price: Number(item.price ?? 0),
      image_url: item.imageUrl ?? null,
      is_available: Boolean(item.isAvailable),
      has_sugar_level: false,
      has_ice_level: false,
      has_size_option: false,
      has_temp_option: false,
    },
  };
}

function normalizeOrderRows(
  rows: OrderRecommendationRow[] | null | undefined,
  customerId: string,
  customerName: string,
  mode: "customer" | "global"
): RecommendationOrder[] {
  return (
    rows?.map((order) => ({
      id: String(order.id),
      customerId: mode === "customer" ? customerId : `global-${order.id}`,
      customerName,
      status: String(order.status),
      orderedAt: String(order.ordered_at),
      items:
        order.order_items?.map((item) => {
          const menuItem = Array.isArray(item.menu_items)
            ? item.menu_items[0]
            : item.menu_items;

          return {
            menuItemId: menuItem?.id,
            name: menuItem?.name ?? "Menu item",
            category: menuItem?.category,
            quantity: Number(item.quantity) || 1,
          };
        }) ?? [],
    })) ?? []
  );
}

function normalizeFeedbackRows(
  rows: FeedbackRecommendationRow[] | null | undefined,
  customerId: string | null
): RecommendationFeedback[] {
  return (
    rows?.map((row) => ({
      customerId,
      menuItemId: row.menu_item_id,
      tasteRating: row.taste_rating,
      strengthRating: row.strength_rating,
      overallRating: row.overall_rating,
    })) ?? []
  );
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

    const { data: menuRows, error: menuError } = await adminSupabase
      .from("menu_items")
      .select(MENU_ITEM_COLUMNS)
      .eq("is_available", true)
      .returns<MenuItemRow[]>();

    if (menuError) {
      return NextResponse.json({ error: menuError.message }, { status: 500 });
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
    const globalRanking: RecommendationGlobalRankItem[] = sortedAnalyticsRows.map(
      (row, index) => ({
        id: getAnalyticsItemId(row),
        name: row.item_name ?? "",
        orderCount: Number(row.order_count ?? row.quantity_sold ?? 0),
        rank: index + 1,
      })
    );
    const recommendationMenuItems: RecommendationMenuItem[] = (menuRows ?? []).map(
      (item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: Number(item.base_price ?? 0),
        imageUrl: item.image_url,
        isAvailable: Boolean(item.is_available),
      })
    );
    const orderSelect = `
      id,
      customer_id,
      status,
      ordered_at,
      order_items (
        quantity,
        menu_items (
          id,
          name,
          category
        )
      )
    `;
    const [{ data: customerOrders }, { data: globalOrders }] = await Promise.all([
      supabase
        .from("orders")
        .select(orderSelect)
        .eq("customer_id", user.id)
        .in("status", ["completed", "delivered"])
        .returns<OrderRecommendationRow[]>(),
      adminSupabase
        .from("orders")
        .select(orderSelect)
        .in("status", ["completed", "delivered"])
        .returns<OrderRecommendationRow[]>(),
    ]);
    const [{ data: customerFeedback }, { data: globalFeedback }] = await Promise.all([
      supabase
        .from("feedback")
        .select("customer_id, menu_item_id, taste_rating, strength_rating, overall_rating")
        .eq("customer_id", user.id)
        .returns<FeedbackRecommendationRow[]>(),
      adminSupabase
        .from("feedback")
        .select("customer_id, menu_item_id, taste_rating, strength_rating, overall_rating")
        .returns<FeedbackRecommendationRow[]>(),
    ]);
    const profile = getRecommendationsForCustomer({
      customerId: user.id,
      customerName: user.email ?? "Customer",
      menuItems: recommendationMenuItems,
      orders: [
        ...normalizeOrderRows(globalOrders, user.id, "Customer", "global"),
        ...normalizeOrderRows(customerOrders, user.id, user.email ?? "Customer", "customer"),
      ],
      feedback: [
        ...normalizeFeedbackRows(globalFeedback, null),
        ...normalizeFeedbackRows(customerFeedback, user.id),
      ],
      globalRanking,
      // Provide server-local hour so time-of-day context boosts activate per request.
      hourOfDay: new Date().getHours(),
    });
    const recommendations = profile.recommendations
      .slice(0, 3)
      .map((recommendation, index) =>
        makeRecommendationCard(recommendation, index + 1)
      );

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

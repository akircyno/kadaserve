import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CustomerDashboard } from "@/features/customer/components/customer-dashboard";
import type {
  RecommendationFeedback,
  RecommendationOrder,
} from "@/lib/recommendations";
import type { CustomerMenuItem } from "@/types/menu";
import type { CustomerOrder } from "@/types/orders";
import type { FeedbackItem } from "@/types/feedback";

type PageProps = {
  searchParams: Promise<{
    splash?: string;
    tab?: string;
  }>;
};

const fallbackOrders: CustomerOrder[] = [];

type CustomerPreferenceRow = {
  menu_item_id: string | null;
  preference_score: number | null;
};

type AnalyticsItemRow = {
  item_id?: string | null;
  menu_item_id?: string | null;
  item_name?: string | null;
  order_count?: number | null;
  quantity_sold?: number | null;
  total_revenue?: number | null;
  sales_rank?: number | null;
};

type InitialTopRecommendation = {
  rank: number;
  label: "Best for You" | "Popular Picks";
  basis: "preference" | "popularity";
  reason: string;
  item_id: string;
  item_name: string;
  price: number;
  image_url: string | null;
  preference_score: number | null;
  item: CustomerMenuItem;
};

function getNumberValue(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getAnalyticsItemId(row: AnalyticsItemRow) {
  return row.menu_item_id ?? row.item_id ?? null;
}

function getOrderFrequency(row: AnalyticsItemRow) {
  return Math.max(getNumberValue(row.quantity_sold), getNumberValue(row.order_count));
}

function sortAnalyticsItemsByAdminRanking(rows: AnalyticsItemRow[]) {
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

function makeInitialRecommendation({
  item,
  rank,
  basis,
  score,
}: {
  item: CustomerMenuItem;
  rank: number;
  basis: "preference" | "popularity";
  score: number | null;
}): InitialTopRecommendation {
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
    preference_score: basis === "preference" ? score : null,
    item,
  };
}

export default async function CustomerPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const shouldShowEntrySplash = resolvedSearchParams.splash === "1";
  const initialSection =
    resolvedSearchParams.tab === "orders"
      ? "orders"
      : resolvedSearchParams.tab === "menu"
      ? "menu"
      : resolvedSearchParams.tab === "rewards"
      ? "rewards"
      : "home";

  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: menuData, error: menuError } = await supabase
    .from("menu_items")
    .select(
      "id, name, description, category, base_price, image_url, is_available, has_sugar_level, has_ice_level, has_size_option, has_temp_option"
    )
    .order("name", { ascending: true });

  const menuItems = (!menuError && menuData ? menuData : []) as CustomerMenuItem[];
  const menuById = new Map(menuItems.map((item) => [item.id, item]));
  let globalRecommendationOrders: RecommendationOrder[] = [];
  let globalRecommendationFeedback: RecommendationFeedback[] = [];
  const initialTopRecommendations: InitialTopRecommendation[] = [];
  let initialRecommendationSource: "customer_preferences" | "analytics_items" =
    "analytics_items";

  const { data: globalOrderData } = await supabase
    .from("orders")
    .select(
      `
        id,
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
      `
    )
    .in("status", ["completed", "delivered"]);

  globalRecommendationOrders =
    globalOrderData?.map((order) => ({
      id: String(order.id),
      customerId: `global-${order.id}`,
      customerName: "Customer",
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
    })) ?? [];

  const { data: globalFeedbackData } = await supabase
    .from("feedback")
    .select("menu_item_id, taste_rating, strength_rating, overall_rating");

  globalRecommendationFeedback =
    globalFeedbackData?.map((item) => ({
      customerId: null,
      menuItemId: String(item.menu_item_id),
      tasteRating: Number(item.taste_rating),
      strengthRating: Number(item.strength_rating),
      overallRating: Number(item.overall_rating),
    })) ?? [];

  let orders: CustomerOrder[] = fallbackOrders;
  let feedbackItems: FeedbackItem[] = [];
  let preferenceSignals: Array<{
    menuItemId: string;
    tasteRating: number;
    strengthRating: number;
    overallRating: number;
  }> = [];
  let customerProfile = {
    fullName: "KadaServe Customer",
    email: user?.email ?? null,
    phone: null as string | null,
    avatarUrl: null as string | null,
    satisfactionAverage: null as number | null,
  };

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    customerProfile = {
      fullName:
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "KadaServe Customer",
      email: profile?.email || user.email || null,
      phone: profile?.phone || null,
      avatarUrl:
        profile?.avatar_url ||
        (typeof user.user_metadata?.avatar_url === "string"
          ? user.user_metadata.avatar_url
          : null),
      satisfactionAverage: null,
    };

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(
        `
          id,
          order_type,
          status,
          payment_method,
          payment_status,
          total_amount,
          delivery_fee,
          reward_code,
          reward_discount_amount,
          ordered_at,
          delivery_address,
          delivery_lat,
          delivery_lng,
          delivery_email,
          delivery_phone,
          order_items (
            id,
            quantity,
            unit_price,
            menu_items (
              id,
              name,
              category
            )
          )
        `
      )
      .eq("customer_id", user.id)
      .order("ordered_at", { ascending: false });

    if (!ordersError && ordersData) {
      orders = ordersData as unknown as CustomerOrder[];
    }

    const eligibleStatuses = ["delivered", "completed"];

    const eligibleOrderItems =
      orders
        .filter((order) => eligibleStatuses.includes(order.status))
        .flatMap((order) =>
          order.order_items
            .flatMap((item) => {
              if (!item.menu_items?.id || !item.menu_items.name) {
                return [];
              }

              return [
                {
                  order_id: order.id,
                  order_item_id: item.id,
                  menu_item_id: item.menu_items.id,
                  item_name: item.menu_items.name,
                },
              ];
            })
        ) ?? [];

    if (eligibleOrderItems.length > 0) {
      const { data: existingFeedback } = await supabase
        .from("feedback")
        .select("order_item_id")
        .eq("customer_id", user.id);

      const submittedIds = new Set(
        (existingFeedback ?? []).map((item) => item.order_item_id)
      );

      feedbackItems = eligibleOrderItems.filter(
        (item) => !submittedIds.has(item.order_item_id)
      );
    }

    const { data: submittedFeedback } = await supabase
      .from("feedback")
      .select("menu_item_id, taste_rating, strength_rating, overall_rating")
      .eq("customer_id", user.id);

    preferenceSignals =
      submittedFeedback
        ?.map((item) => ({
          menuItemId: String(item.menu_item_id),
          tasteRating: Number(item.taste_rating),
          strengthRating: Number(item.strength_rating),
          overallRating: Number(item.overall_rating),
        }))
        .filter(
          (item) =>
            item.menuItemId &&
            item.menuItemId !== "null" &&
            Number.isFinite(item.overallRating)
        ) ?? [];

    const ratings =
      submittedFeedback
        ?.map((item) => Number(item.overall_rating))
        .filter((rating) => Number.isFinite(rating)) ?? [];

    customerProfile.satisfactionAverage =
      ratings.length > 0
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        : null;
  }

  const selectedInitialIds = new Set<string>();

  if (user) {
    const { data: preferenceRows } = await supabase
      .from("customer_preferences")
      .select("menu_item_id, preference_score")
      .eq("customer_id", user.id)
      .order("preference_score", { ascending: false })
      .limit(1)
      .returns<CustomerPreferenceRow[]>();
    const preferenceRow = preferenceRows?.[0];
    const preferenceItem =
      preferenceRow?.menu_item_id ? menuById.get(preferenceRow.menu_item_id) : null;

    if (preferenceItem) {
      initialTopRecommendations.push(
        makeInitialRecommendation({
          item: preferenceItem,
          rank: 1,
          basis: "preference",
          score: getNumberValue(preferenceRow?.preference_score),
        })
      );
      selectedInitialIds.add(preferenceItem.id);
      initialRecommendationSource = "customer_preferences";
    }
  }

  const { data: analyticsRows } = await adminSupabase
    .from("analytics_items")
    .select(
      "item_id, menu_item_id, item_name, order_count, quantity_sold, total_revenue, sales_rank"
    )
    .returns<AnalyticsItemRow[]>();
  const sortedAnalyticsRows = sortAnalyticsItemsByAdminRanking(analyticsRows ?? []);
  const adminTopItemRow = sortedAnalyticsRows[0] ?? null;
  const analyticsItemIds = sortedAnalyticsRows
    .map(getAnalyticsItemId)
    .filter((id): id is string => Boolean(id));
  const popularityIds =
    analyticsItemIds.length > 0
      ? analyticsItemIds.filter((id) => !selectedInitialIds.has(id))
      : menuItems
          .filter((item) => !selectedInitialIds.has(item.id))
          .map((item) => item.id);

  for (const itemId of popularityIds) {
    if (initialTopRecommendations.length >= 3) {
      break;
    }

    const item = menuById.get(itemId);

    if (!item) {
      continue;
    }

    initialTopRecommendations.push(
      makeInitialRecommendation({
        item,
        rank: initialTopRecommendations.length + 1,
        basis: "popularity",
        score: null,
      })
    );
  }

  const initialCustomerTopSeller =
    initialTopRecommendations.find((item) => item.basis === "popularity") ?? null;

  console.log("[KadaServe Recommendations] Source table/query used", {
    source: sortedAnalyticsRows.length > 0 ? "analytics_items" : "menu_items fallback",
    sort: "quantity_sold/order_count DESC, total_revenue DESC, sales_rank ASC",
  });
  console.log("[KadaServe Recommendations] Admin top item result", {
    item_id: adminTopItemRow ? getAnalyticsItemId(adminTopItemRow) : null,
    item_name: adminTopItemRow?.item_name ?? null,
    total_orders: adminTopItemRow ? getOrderFrequency(adminTopItemRow) : 0,
  });
  console.log("[KadaServe Recommendations] Customer top seller result", {
    item_id: initialCustomerTopSeller?.item_id ?? null,
    item_name: initialCustomerTopSeller?.item_name ?? null,
  });

  return (
    <CustomerDashboard
      menuItems={menuItems}
      orders={orders}
      feedbackItems={feedbackItems}
      preferenceSignals={preferenceSignals}
      globalRecommendationOrders={globalRecommendationOrders}
      globalRecommendationFeedback={globalRecommendationFeedback}
      initialSection={initialSection}
      shouldShowEntrySplash={shouldShowEntrySplash}
      customerProfile={customerProfile}
      isAuthenticated={Boolean(user)}
      initialTopRecommendations={initialTopRecommendations}
      initialRecommendationSource={initialRecommendationSource}
    />
  );
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AnalyticsOrderRow = {
  id: string;
  status: string;
};

type AnalyticsOrderItemRow = {
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  menu_items: { name: string | null } | { name: string | null }[] | null;
};

type AnalyticsFeedbackRow = {
  order_id: string;
  taste_rating: number | null;
  strength_rating: number | null;
  overall_rating: number | null;
};

type AnalyticsItemsRow = {
  id: string;
  item_id: string;
  menu_item_id: string;
  item_name: string;
  period_type: string;
  period_start: string;
  order_count: number;
  quantity_sold: number;
  total_revenue: number;
  avg_rating: number;
  sales_rank: number;
  updated_at: string;
};

function analyticsSetupError(message: string) {
  const normalized = message.toLowerCase();

  return normalized.includes("analytics_items") ||
    normalized.includes("item_id") ||
    normalized.includes("menu_item_id") ||
    normalized.includes("on conflict") ||
    normalized.includes("unique")
    ? "analytics_items is not set up yet. Run backend/seed/analytics-items.sql in Supabase."
    : message;
}

function isMissingConflictConstraint(message: string) {
  return message
    .toLowerCase()
    .includes("no unique or exclusion constraint matching the on conflict");
}

function getNumberValue(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getFeedbackScore(row: AnalyticsFeedbackRow) {
  return (
    getNumberValue(row.taste_rating) +
    getNumberValue(row.strength_rating) +
    getNumberValue(row.overall_rating)
  ) / 3;
}

function normalizeMenuItem(
  menuItem: AnalyticsOrderItemRow["menu_items"]
): { name: string | null } | null {
  return Array.isArray(menuItem) ? menuItem[0] ?? null : menuItem;
}

function buildItemAnalytics(
  orders: AnalyticsOrderRow[],
  orderItems: AnalyticsOrderItemRow[],
  feedbackRows: AnalyticsFeedbackRow[]
): Omit<AnalyticsItemsRow, "id">[] {
  const validOrderIds = new Set(
    orders.filter((order) => order.status !== "cancelled").map((order) => order.id)
  );
  const feedbackByOrderId = new Map<string, number[]>();
  const buckets = new Map<
    string,
    {
      itemId: string;
      itemName: string;
      orderIds: Set<string>;
      quantitySold: number;
      totalRevenue: number;
      feedbackScores: number[];
    }
  >();

  feedbackRows.forEach((feedback) => {
    const score = getFeedbackScore(feedback);

    if (Number.isFinite(score)) {
      const currentScores = feedbackByOrderId.get(feedback.order_id) ?? [];
      currentScores.push(score);
      feedbackByOrderId.set(feedback.order_id, currentScores);
    }
  });

  orderItems.forEach((item) => {
    if (!validOrderIds.has(item.order_id) || !item.menu_item_id) {
      return;
    }

    const itemName = normalizeMenuItem(item.menu_items)?.name?.trim() || "Menu item";
    const currentBucket =
      buckets.get(item.menu_item_id) ?? {
        itemId: item.menu_item_id,
        itemName,
        orderIds: new Set<string>(),
        quantitySold: 0,
        totalRevenue: 0,
        feedbackScores: [],
      };

    currentBucket.itemName = itemName;
    currentBucket.orderIds.add(item.order_id);
    currentBucket.quantitySold += Number(item.quantity ?? 0);
    currentBucket.totalRevenue += Number(item.quantity ?? 0) * Number(item.unit_price ?? 0);

    const orderFeedbackScores = feedbackByOrderId.get(item.order_id);
    if (orderFeedbackScores && orderFeedbackScores.length > 0) {
      const averageOrderFeedback =
        orderFeedbackScores.reduce((sum, score) => sum + score, 0) /
        orderFeedbackScores.length;
      currentBucket.feedbackScores.push(averageOrderFeedback);
    }

    buckets.set(item.menu_item_id, currentBucket);
  });

  return Array.from(buckets.values())
    .sort((left, right) => {
      if (right.quantitySold !== left.quantitySold) {
        return right.quantitySold - left.quantitySold;
      }

      if (right.orderIds.size !== left.orderIds.size) {
        return right.orderIds.size - left.orderIds.size;
      }

      if (right.totalRevenue !== left.totalRevenue) {
        return right.totalRevenue - left.totalRevenue;
      }

      return left.itemName.localeCompare(right.itemName);
    })
    .map((bucket, index) => {
      const totalRevenue = Number(bucket.totalRevenue.toFixed(2));
      const avgRating = Number(
        (
          bucket.feedbackScores.length > 0
            ? bucket.feedbackScores.reduce((sum, score) => sum + score, 0) /
              bucket.feedbackScores.length
            : 0
        ).toFixed(2)
      );

      return {
        item_id: bucket.itemId,
        menu_item_id: bucket.itemId,
        item_name: bucket.itemName,
        period_type: "daily",
        period_start: new Date().toISOString().slice(0, 10),
        order_count: bucket.orderIds.size,
        quantity_sold: bucket.quantitySold,
        total_revenue: totalRevenue,
        avg_rating: avgRating,
        sales_rank: index + 1,
        updated_at: new Date().toISOString(),
      };
    });
}

async function assertAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return {
      error: NextResponse.json({ error: analyticsSetupError(profileError.message) }, { status: 500 }),
    };
  }

  if (!profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase };
}

export async function GET() {
  try {
    const access = await assertAdminAccess();
    if ("error" in access) {
      return access.error;
    }

    const { supabase } = access;
    const { data, error } = await supabase
      .from("analytics_items")
      .select(
        "id, item_id, item_name, order_count, quantity_sold, total_revenue, avg_rating, sales_rank, updated_at"
      )
      .order("sales_rank", { ascending: true })
      .order("total_revenue", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: analyticsSetupError(error.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({ analyticsItems: data ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading item analytics." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const access = await assertAdminAccess();
    if ("error" in access) {
      return access.error;
    }

    const { supabase } = access;

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, status")
      .neq("status", "cancelled")
      .returns<AnalyticsOrderRow[]>();

    if (ordersError) {
      return NextResponse.json(
        { error: analyticsSetupError(ordersError.message) },
        { status: 500 }
      );
    }

    const orderIds = (orders ?? []).map((order) => order.id);
    const { data: orderItems, error: orderItemsError } = orderIds.length
      ? await supabase
          .from("order_items")
          .select(
            `
              order_id,
              menu_item_id,
              quantity,
              unit_price,
              menu_items (
                name
              )
            `
          )
          .in("order_id", orderIds)
          .returns<AnalyticsOrderItemRow[]>()
      : { data: [], error: null };

    if (orderItemsError) {
      return NextResponse.json(
        { error: analyticsSetupError(orderItemsError.message) },
        { status: 500 }
      );
    }

    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("feedback")
      .select("order_id, taste_rating, strength_rating, overall_rating")
      .returns<AnalyticsFeedbackRow[]>();

    if (feedbackError) {
      return NextResponse.json(
        { error: analyticsSetupError(feedbackError.message) },
        { status: 500 }
      );
    }

    const analyticsRows = buildItemAnalytics(
      orders ?? [],
      orderItems ?? [],
      feedbackRows ?? []
    );

    if (analyticsRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No valid orders found for item analytics.",
        analyticsItems: [],
      });
    }

    const { data: savedRows, error: upsertError } = await supabase
      .from("analytics_items")
      .upsert(analyticsRows, { onConflict: "item_id" })
      .select(
        "id, item_id, item_name, order_count, quantity_sold, total_revenue, avg_rating, sales_rank, updated_at"
      );

    if (upsertError) {
      if (isMissingConflictConstraint(upsertError.message)) {
        const { error: deleteError } = await supabase
          .from("analytics_items")
          .delete()
          .eq("period_type", "daily");

        if (deleteError) {
          return NextResponse.json(
            { error: analyticsSetupError(deleteError.message) },
            { status: 500 }
          );
        }

        const { data: insertedRows, error: insertError } = await supabase
          .from("analytics_items")
          .insert(analyticsRows)
          .select(
            "id, item_id, item_name, order_count, quantity_sold, total_revenue, avg_rating, sales_rank, updated_at"
          );

        if (insertError) {
          return NextResponse.json(
            { error: analyticsSetupError(insertError.message) },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          analyticsItems: insertedRows ?? analyticsRows,
          migrationSql:
            "create unique index if not exists analytics_items_item_id_key on public.analytics_items (item_id);",
        });
      }

      return NextResponse.json(
        { error: analyticsSetupError(upsertError.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analyticsItems: savedRows ?? analyticsRows,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while generating item analytics." },
      { status: 500 }
    );
  }
}

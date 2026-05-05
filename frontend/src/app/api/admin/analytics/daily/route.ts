import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AnalyticsOrderRow = {
  id: string;
  ordered_at: string;
  total_amount: number | null;
  status: string;
};

type AnalyticsFeedbackRow = {
  order_id: string;
  taste_rating: number | null;
  strength_rating: number | null;
  overall_rating: number | null;
};

type AnalyticsDailyRow = {
  order_date: string;
  day_of_week: string;
  order_count: number;
  total_revenue: number;
  avg_order_value: number;
  avg_rating: number;
};

const ANALYTICS_TIME_ZONE = "Asia/Manila";

function analyticsSetupError(message: string) {
  return message.toLowerCase().includes("analytics_daily")
    ? "analytics_daily is not set up yet. Run backend/seed/analytics-daily.sql in Supabase."
    : message;
}

function formatDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDayOfWeek(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ANALYTICS_TIME_ZONE,
    weekday: "long",
  }).format(new Date(value));
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

function buildDailyAnalytics(
  orders: AnalyticsOrderRow[],
  feedbackRows: AnalyticsFeedbackRow[]
): AnalyticsDailyRow[] {
  const buckets = new Map<
    string,
    {
      orderCount: number;
      totalRevenue: number;
      feedbackScores: number[];
    }
  >();
  const orderDateByOrderId = new Map<string, string>();

  orders
    .filter((order) => order.status !== "cancelled")
    .forEach((order) => {
      const orderDate = formatDateKey(order.ordered_at);
      orderDateByOrderId.set(order.id, orderDate);

      const currentBucket = buckets.get(orderDate) ?? {
        orderCount: 0,
        totalRevenue: 0,
        feedbackScores: [],
      };

      currentBucket.orderCount += 1;
      currentBucket.totalRevenue += getNumberValue(order.total_amount);

      buckets.set(orderDate, currentBucket);
    });

  feedbackRows.forEach((feedback) => {
    const orderDate = orderDateByOrderId.get(feedback.order_id);

    if (!orderDate) {
      return;
    }

    const score = getFeedbackScore(feedback);

    if (!Number.isFinite(score)) {
      return;
    }

    const currentBucket = buckets.get(orderDate);

    if (!currentBucket) {
      return;
    }

    currentBucket.feedbackScores.push(score);
  });

  return Array.from(buckets.entries())
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([orderDate, bucket]) => {
      const totalRevenue = Number(bucket.totalRevenue.toFixed(2));
      const avgOrderValue = Number(
        (bucket.orderCount > 0 ? totalRevenue / bucket.orderCount : 0).toFixed(2)
      );
      const avgRating = Number(
        (
          bucket.feedbackScores.length > 0
            ? bucket.feedbackScores.reduce((sum, score) => sum + score, 0) /
              bucket.feedbackScores.length
            : 0
        ).toFixed(2)
      );

      return {
        order_date: orderDate,
        day_of_week: formatDayOfWeek(orderDate),
        order_count: bucket.orderCount,
        total_revenue: totalRevenue,
        avg_order_value: avgOrderValue,
        avg_rating: avgRating,
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
      .from("analytics_daily")
      .select(
        "id, order_date, day_of_week, order_count, total_revenue, avg_order_value, avg_rating"
      )
      .order("order_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: analyticsSetupError(error.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({ analyticsDaily: data ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading analytics." },
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
      .select("id, ordered_at, total_amount, status")
      .neq("status", "cancelled")
      .returns<AnalyticsOrderRow[]>();

    if (ordersError) {
      return NextResponse.json(
        { error: analyticsSetupError(ordersError.message) },
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

    const analyticsRows = buildDailyAnalytics(orders ?? [], feedbackRows ?? []);

    if (analyticsRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No valid orders found for daily analytics.",
        analyticsDaily: [],
      });
    }

    const { data: savedRows, error: upsertError } = await supabase
      .from("analytics_daily")
      .upsert(analyticsRows, { onConflict: "order_date" })
      .select(
        "id, order_date, day_of_week, order_count, total_revenue, avg_order_value, avg_rating"
      );

    if (upsertError) {
      return NextResponse.json(
        { error: analyticsSetupError(upsertError.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analyticsDaily: savedRows ?? analyticsRows,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while generating analytics." },
      { status: 500 }
    );
  }
}

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

type AnalyticsWeeklyDbRow = {
  id: string;
  week_start_date: string;
  week_end_date: string;
  order_count: number;
  total_revenue: number;
  avg_order_value: number;
  updated_at: string;
};

const ANALYTICS_TIME_ZONE = "Asia/Manila";

function analyticsSetupError(message: string) {
  return message.toLowerCase().includes("analytics_weekly")
    ? "analytics_weekly is not set up yet. Run backend/seed/analytics-weekly.sql in Supabase."
    : message;
}

function formatDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
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

function getManilaWeekdayIndex(value: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: ANALYTICS_TIME_ZONE,
    weekday: "short",
  }).format(new Date(value));

  if (weekday === "Mon") return 1;
  if (weekday === "Tue") return 2;
  if (weekday === "Wed") return 3;
  if (weekday === "Thu") return 4;
  if (weekday === "Fri") return 5;
  if (weekday === "Sat") return 6;

  return 7;
}

function addDays(dateKey: string, days: number) {
  const base = new Date(`${dateKey}T00:00:00+08:00`);
  const shifted = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  return formatDateKey(shifted);
}

function getWeekStartDate(orderDate: string) {
  const weekdayIndex = getManilaWeekdayIndex(`${orderDate}T00:00:00+08:00`);
  const offset = weekdayIndex === 7 ? -6 : 1 - weekdayIndex;

  return addDays(orderDate, offset);
}

function buildWeeklyAnalytics(
  orders: AnalyticsOrderRow[],
  feedbackRows: AnalyticsFeedbackRow[]
): Omit<AnalyticsWeeklyDbRow, "id">[] {
  const buckets = new Map<
    string,
    {
      weekStartDate: string;
      weekEndDate: string;
      orderCount: number;
      totalRevenue: number;
      feedbackScores: number[];
    }
  >();
  const weekStartByOrderId = new Map<string, string>();
  const updatedAt = new Date().toISOString();

  orders
    .filter((order) => order.status !== "cancelled")
    .forEach((order) => {
      const orderDate = formatDateKey(order.ordered_at);
      const weekStartDate = getWeekStartDate(orderDate);
      const weekEndDate = addDays(weekStartDate, 6);

      weekStartByOrderId.set(order.id, weekStartDate);

      const currentBucket = buckets.get(weekStartDate) ?? {
        weekStartDate,
        weekEndDate,
        orderCount: 0,
        totalRevenue: 0,
        feedbackScores: [],
      };

      currentBucket.orderCount += 1;
      currentBucket.totalRevenue += getNumberValue(order.total_amount);
      currentBucket.weekEndDate = weekEndDate;

      buckets.set(weekStartDate, currentBucket);
    });

  feedbackRows.forEach((feedback) => {
    const weekStartDate = weekStartByOrderId.get(feedback.order_id);

    if (!weekStartDate) {
      return;
    }

    const currentBucket = buckets.get(weekStartDate);
    const score = getFeedbackScore(feedback);

    if (!currentBucket || !Number.isFinite(score)) {
      return;
    }

    currentBucket.feedbackScores.push(score);
  });

  return Array.from(buckets.values())
    .sort((left, right) => left.weekStartDate.localeCompare(right.weekStartDate))
    .map((bucket) => {
      const totalRevenue = Number(bucket.totalRevenue.toFixed(2));
      const avgOrderValue = Number(
        (bucket.orderCount > 0 ? totalRevenue / bucket.orderCount : 0).toFixed(2)
      );

      return {
        week_start_date: bucket.weekStartDate,
        week_end_date: bucket.weekEndDate,
        order_count: bucket.orderCount,
        total_revenue: totalRevenue,
        avg_order_value: avgOrderValue,
        updated_at: updatedAt,
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
      .from("analytics_weekly")
      .select(
        "id, week_start_date, week_end_date, order_count, total_revenue, avg_order_value, updated_at"
      )
      .order("week_start_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: analyticsSetupError(error.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({ analyticsWeekly: data ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading weekly analytics." },
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

    const analyticsRows = buildWeeklyAnalytics(orders ?? [], feedbackRows ?? []);

    if (analyticsRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No valid orders found for weekly analytics.",
        analyticsWeekly: [],
      });
    }

    const { data: savedRows, error: upsertError } = await supabase
      .from("analytics_weekly")
      .upsert(analyticsRows, { onConflict: "week_start_date" })
      .select(
        "id, week_start_date, week_end_date, order_count, total_revenue, avg_order_value, updated_at"
      );

    if (upsertError) {
      return NextResponse.json(
        { error: analyticsSetupError(upsertError.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analyticsWeekly: savedRows ?? analyticsRows,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while generating weekly analytics." },
      { status: 500 }
    );
  }
}

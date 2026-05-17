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

type AnalyticsHourlyRow = {
  order_date: string;
  day_of_week: string;
  hour_of_day: number;
  hour_label: string;
  order_count: number;
  total_revenue: number;
  avg_order_value: number;
  avg_rating: number;
  updated_at: string;
};

const ANALYTICS_TIME_ZONE = "Asia/Manila";
const OPERATING_HOURS = [17, 18, 19, 20, 21, 22, 23, 0];

function analyticsSetupError(message: string) {
  return message.toLowerCase().includes("analytics_hourly")
    ? "analytics_hourly is not set up yet. Run backend/seed/analytics-hourly.sql in Supabase."
    : message;
}

function formatHourLabel(hour: number) {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const displayHour = normalizedHour % 12 || 12;
  const suffix = normalizedHour < 12 ? "AM" : "PM";

  return `${displayHour}${suffix}`;
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

function getManilaHour(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ANALYTICS_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  return Number(parts.find((part) => part.type === "hour")?.value ?? 0);
}

function getNumberValue(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getOperatingHourIndex(hour: number) {
  const index = OPERATING_HOURS.indexOf(hour);
  return index === -1 ? OPERATING_HOURS.length : index;
}

function getFeedbackScore(row: AnalyticsFeedbackRow) {
  return (
    getNumberValue(row.taste_rating) +
    getNumberValue(row.strength_rating) +
    getNumberValue(row.overall_rating)
  ) / 3;
}

function buildEmptyHourlyRows(orderDate: string): AnalyticsHourlyRow[] {
  const updatedAt = new Date().toISOString();

  return OPERATING_HOURS.map((hour) => ({
    order_date: orderDate,
    day_of_week: formatDayOfWeek(`${orderDate}T00:00:00+08:00`),
    hour_of_day: hour,
    hour_label: formatHourLabel(hour),
    order_count: 0,
    total_revenue: 0,
    avg_order_value: 0,
    avg_rating: 0,
    updated_at: updatedAt,
  }));
}

function buildHourlyAnalytics(
  orders: AnalyticsOrderRow[],
  feedbackRows: AnalyticsFeedbackRow[]
): AnalyticsHourlyRow[] {
  const buckets = new Map<
    string,
    {
      orderDate: string;
      dayOfWeek: string;
      hour: number;
      orderCount: number;
      totalRevenue: number;
      feedbackScores: number[];
    }
  >();
  const hourByOrderId = new Map<string, number>();
  const dateByOrderId = new Map<string, string>();
  const updatedAt = new Date().toISOString();

  orders
    .filter((order) => order.status !== "cancelled")
    .forEach((order) => {
      const orderDate = formatDateKey(order.ordered_at);
      const dayOfWeek = formatDayOfWeek(order.ordered_at);
      const hour = getManilaHour(order.ordered_at);
      dateByOrderId.set(order.id, orderDate);
      hourByOrderId.set(order.id, hour);

      for (const bucketHour of OPERATING_HOURS) {
        const bucketKey = `${orderDate}:${bucketHour}`;

        if (!buckets.has(bucketKey)) {
          buckets.set(bucketKey, {
            orderDate,
            dayOfWeek,
            hour: bucketHour,
            orderCount: 0,
            totalRevenue: 0,
            feedbackScores: [],
          });
        }
      }

      const currentBucket = OPERATING_HOURS.includes(hour)
        ? buckets.get(`${orderDate}:${hour}`)
        : null;

      if (!currentBucket) {
        return;
      }

      currentBucket.orderCount += 1;
      currentBucket.totalRevenue += getNumberValue(order.total_amount);
    });

  feedbackRows.forEach((feedback) => {
    const orderDate = dateByOrderId.get(feedback.order_id);
    const hour = hourByOrderId.get(feedback.order_id);

    if (!orderDate || hour === undefined) {
      return;
    }

    const currentBucket = buckets.get(`${orderDate}:${hour}`);
    const score = getFeedbackScore(feedback);

    if (!currentBucket || !Number.isFinite(score)) {
      return;
    }

    currentBucket.feedbackScores.push(score);
  });

  return Array.from(buckets.values())
    .sort((left, right) =>
      left.orderDate === right.orderDate
        ? getOperatingHourIndex(left.hour) - getOperatingHourIndex(right.hour)
        : left.orderDate.localeCompare(right.orderDate)
    )
    .map((bucket) => {
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
        order_date: bucket.orderDate,
        day_of_week: bucket.dayOfWeek,
        hour_of_day: bucket.hour,
        hour_label: formatHourLabel(bucket.hour),
        order_count: bucket.orderCount,
        total_revenue: totalRevenue,
        avg_order_value: avgOrderValue,
        avg_rating: avgRating,
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

export async function GET(request: Request) {
  try {
    const access = await assertAdminAccess();
    if ("error" in access) {
      return access.error;
    }

    const { supabase } = access;
    const { searchParams } = new URL(request.url);
    let targetDate = searchParams.get("date");

    if (!targetDate) {
      const { data: latestRow, error: latestError } = await supabase
        .from("analytics_hourly")
        .select("order_date")
        .order("order_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) {
        return NextResponse.json(
          { error: analyticsSetupError(latestError.message) },
          { status: 500 }
        );
      }

      targetDate =
        typeof latestRow?.order_date === "string"
          ? latestRow.order_date
          : formatDateKey(new Date().toISOString());
    }

    const { data, error } = await supabase
      .from("analytics_hourly")
      .select(
        "id, order_date, day_of_week, hour_of_day, hour_label, order_count, total_revenue, avg_order_value, avg_rating, updated_at"
      )
      .eq("order_date", targetDate)
      .in("hour_of_day", OPERATING_HOURS)
      .order("hour_of_day", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: analyticsSetupError(error.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      analyticsDate: targetDate,
      analyticsHourly:
        data && data.length > 0
          ? [...data].sort(
              (left, right) =>
                getOperatingHourIndex(Number(left.hour_of_day)) -
                getOperatingHourIndex(Number(right.hour_of_day))
            )
          : buildEmptyHourlyRows(targetDate),
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading hourly analytics." },
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

    const analyticsRows = buildHourlyAnalytics(orders ?? [], feedbackRows ?? []);

    const { data: savedRows, error: upsertError } = await supabase
      .from("analytics_hourly")
      .upsert(analyticsRows, { onConflict: "order_date,hour_of_day" })
      .select(
        "id, order_date, day_of_week, hour_of_day, hour_label, order_count, total_revenue, avg_order_value, avg_rating, updated_at"
      );

    if (upsertError) {
      return NextResponse.json(
        { error: analyticsSetupError(upsertError.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analyticsHourly: savedRows ?? analyticsRows,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while generating hourly analytics." },
      { status: 500 }
    );
  }
}

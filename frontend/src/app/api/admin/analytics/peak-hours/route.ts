import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyIntensity, getMean, getStandardDeviation } from "@/lib/peak-hour-intensity";

type AnalyticsHourlyRow = {
  order_date: string;
  day_of_week: string;
  hour_of_day: number;
  order_count: number;
  total_revenue: number;
};

type PeakOrderRow = {
  id: string;
  ordered_at: string;
  status: string;
};

type PeakHourWindowRow = {
  id?: string;
  day_of_week: number;
  hour_start: number;
  hour_end: number;
  avg_order_count: number;
  intensity: string;
  detected_at: string;
};

const DAY_INDEX_BY_NAME: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};
const OPERATING_HOURS = [17, 18, 19, 20, 21, 22, 23, 0];

const PEAK_HOUR_CONSTRAINT_SQL = `create unique index if not exists peak_hour_windows_day_of_week_hour_start_key
on public.peak_hour_windows (day_of_week, hour_start);`;

function analyticsSetupError(message: string) {
  const normalized = message.toLowerCase();

  return normalized.includes("relation")
    && normalized.includes("peak_hour_windows")
    && (normalized.includes("does not exist") || normalized.includes("schema cache"))
    ? "peak_hour_windows is not set up yet. Run backend/seed/peak-hour-windows.sql in Supabase."
    : normalized.includes("relation")
      && normalized.includes("analytics_hourly")
      && (normalized.includes("does not exist") || normalized.includes("schema cache"))
        ? "analytics_hourly is not set up yet. Run backend/seed/analytics-hourly.sql in Supabase."
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

function formatDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDayOfWeek(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "long",
  }).format(new Date(value));
}

function getManilaHour(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  return Number(parts.find((part) => part.type === "hour")?.value ?? 0);
}

function getDayOfWeekNumber(row: AnalyticsHourlyRow) {
  const dayName = String(row.day_of_week ?? "").trim().toLowerCase();
  const dayFromName = DAY_INDEX_BY_NAME[dayName];

  if (dayFromName !== undefined) {
    return dayFromName;
  }

  const [year, month, day] = row.order_date.split("-").map(Number);
  const fallbackDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return Number.isFinite(fallbackDay) ? fallbackDay : 0;
}

function getManilaMonthRange() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? 1);
  const monthText = String(month).padStart(2, "0");
  const daysInMonth = new Date(year, month, 0).getDate();

  return {
    startDate: `${year}-${monthText}-01`,
    endDate: `${year}-${monthText}-${String(daysInMonth).padStart(2, "0")}`,
  };
}

function getDateRange(request: Request) {
  const { searchParams } = new URL(request.url);
  const monthRange = getManilaMonthRange();
  const startDate = searchParams.get("startDate") ?? monthRange.startDate;
  const endDate = searchParams.get("endDate") ?? monthRange.endDate;
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

  return {
    startDate: isDate(startDate) ? startDate : monthRange.startDate,
    endDate: isDate(endDate) ? endDate : monthRange.endDate,
  };
}

function buildPeakHourWindows(hourlyRows: AnalyticsHourlyRow[]): PeakHourWindowRow[] {
  const monthlyBuckets = new Map<
    string,
    {
      dayOfWeek: number;
      hourStart: number;
      totalOrderCount: number;
    }
  >();

  hourlyRows
    .filter((row) => OPERATING_HOURS.includes(Math.trunc(getNumberValue(row.hour_of_day))))
    .forEach((row) => {
      if (!row.order_date) {
        return;
      }

      const dayOfWeek = getDayOfWeekNumber(row);
      const hourStart = Math.trunc(getNumberValue(row.hour_of_day));
      const bucketKey = `${dayOfWeek}:${hourStart}`;
      const currentBucket =
        monthlyBuckets.get(bucketKey) ?? {
          dayOfWeek,
          hourStart,
          totalOrderCount: 0,
        };

      currentBucket.totalOrderCount += getNumberValue(row.order_count);
      monthlyBuckets.set(bucketKey, currentBucket);
    });

  const detectedAt = new Date().toISOString();
  const buckets = Array.from(monthlyBuckets.values());
  const bucketCounts = buckets.map((bucket) => bucket.totalOrderCount);
  const meanOrderCount = getMean(bucketCounts);
  const standardDeviation = getStandardDeviation(bucketCounts, meanOrderCount);

  return buckets
    .map((bucket) => ({
      day_of_week: bucket.dayOfWeek,
      hour_start: bucket.hourStart,
      hour_end: (bucket.hourStart + 1) % 24,
      avg_order_count: Number(bucket.totalOrderCount.toFixed(2)),
      intensity: classifyIntensity(bucket.totalOrderCount, meanOrderCount, standardDeviation),
      detected_at: detectedAt,
    }))
    .sort(
      (left, right) =>
        left.day_of_week - right.day_of_week ||
        left.hour_start - right.hour_start
    );
}

function buildMonthlyHourlyRows(orders: PeakOrderRow[]): AnalyticsHourlyRow[] {
  return orders
    .filter((order) => !["cancelled", "expired"].includes(order.status))
    .map((order) => ({
      order_date: formatDateKey(order.ordered_at),
      day_of_week: formatDayOfWeek(order.ordered_at),
      hour_of_day: getManilaHour(order.ordered_at),
      order_count: 1,
      total_revenue: 0,
    }))
    .filter((row) => OPERATING_HOURS.includes(row.hour_of_day));
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
    const { startDate, endDate } = getDateRange(request);
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, ordered_at, status")
      .gte("ordered_at", `${startDate}T00:00:00+08:00`)
      .lte("ordered_at", `${endDate}T23:59:59+08:00`)
      .neq("status", "cancelled")
      .neq("status", "expired")
      .order("ordered_at", { ascending: true })
      .returns<PeakOrderRow[]>();

    if (error) {
      return NextResponse.json(
        { error: analyticsSetupError(error.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      peakHourWindows: buildPeakHourWindows(buildMonthlyHourlyRows(orders ?? [])),
      range: "month",
      startDate,
      endDate,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading peak-hour windows." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await assertAdminAccess();
    if ("error" in access) {
      return access.error;
    }

    const { supabase } = access;
    const { startDate, endDate } = getDateRange(request);
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, ordered_at, status")
      .gte("ordered_at", `${startDate}T00:00:00+08:00`)
      .lte("ordered_at", `${endDate}T23:59:59+08:00`)
      .neq("status", "cancelled")
      .neq("status", "expired")
      .order("ordered_at", { ascending: true })
      .returns<PeakOrderRow[]>();

    if (ordersError) {
      return NextResponse.json(
        { error: analyticsSetupError(ordersError.message) },
        { status: 500 }
      );
    }

    const peakRows = buildPeakHourWindows(buildMonthlyHourlyRows(orders ?? []));
    const { error: deleteError } = await supabase
      .from("peak_hour_windows")
      .delete()
      .gte("hour_start", 0);

    if (deleteError) {
      return NextResponse.json(
        { error: analyticsSetupError(deleteError.message) },
        { status: 500 }
      );
    }

    if (peakRows.length === 0) {
      return NextResponse.json({
        success: true,
        peakHourWindows: [],
        range: "month",
        startDate,
        endDate,
      });
    }

    const { data: savedRows, error: upsertError } = await supabase
      .from("peak_hour_windows")
      .upsert(peakRows, { onConflict: "day_of_week,hour_start" })
      .select("id, day_of_week, hour_start, hour_end, avg_order_count, intensity, detected_at");

    if (upsertError) {
      if (isMissingConflictConstraint(upsertError.message)) {
        const { data: insertedRows, error: insertError } = await supabase
          .from("peak_hour_windows")
          .insert(peakRows)
          .select("id, day_of_week, hour_start, hour_end, avg_order_count, intensity, detected_at");

        if (insertError) {
          return NextResponse.json(
            { error: analyticsSetupError(insertError.message) },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          peakHourWindows: insertedRows ?? peakRows,
          range: "month",
          startDate,
          endDate,
          migrationSql: PEAK_HOUR_CONSTRAINT_SQL,
        });
      }

      return NextResponse.json(
        { error: analyticsSetupError(upsertError.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      peakHourWindows: savedRows ?? peakRows,
      range: "month",
      startDate,
      endDate,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while generating peak-hour windows." },
      { status: 500 }
    );
  }
}

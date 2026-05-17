import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AnalyticsHourlyRow = {
  order_date: string;
  day_of_week: string;
  hour_of_day: number;
  order_count: number;
  total_revenue: number;
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

  return normalized.includes("peak_hour_windows")
    ? "peak_hour_windows is not set up yet. Run backend/seed/peak-hour-windows.sql in Supabase."
    : normalized.includes("analytics_hourly")
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

function getDayOfWeekNumber(row: AnalyticsHourlyRow) {
  const dayName = String(row.day_of_week ?? "").trim().toLowerCase();
  const dayFromName = DAY_INDEX_BY_NAME[dayName];

  if (dayFromName !== undefined) {
    return dayFromName;
  }

  const dateValue = new Date(`${row.order_date}T00:00:00+08:00`);
  const fallbackDay = dateValue.getDay();

  return Number.isFinite(fallbackDay) ? fallbackDay : 0;
}

function getIntensity(avgOrderCount: number, avgThreshold: number) {
  if (avgThreshold <= 0) {
    return "low";
  }

  const ratio = avgOrderCount / avgThreshold;

  if (ratio >= 2) {
    return "high";
  }

  if (ratio >= 1.25) {
    return "medium";
  }

  return "low";
}

function buildPeakHourWindows(hourlyRows: AnalyticsHourlyRow[]): PeakHourWindowRow[] {
  const rowsByDate = new Map<string, AnalyticsHourlyRow[]>();

  hourlyRows
    .filter((row) => OPERATING_HOURS.includes(Math.trunc(getNumberValue(row.hour_of_day))))
    .forEach((row) => {
    if (!row.order_date) {
      return;
    }

    const currentRows = rowsByDate.get(row.order_date) ?? [];
    currentRows.push(row);
    rowsByDate.set(row.order_date, currentRows);
  });

  const peakBuckets = new Map<
    string,
    {
      dayOfWeek: number;
      hourStart: number;
      totalOrderCount: number;
      totalThreshold: number;
      occurrences: number;
    }
  >();

  rowsByDate.forEach((dateRows) => {
    const intervalCount = dateRows.length;
    const totalOrders = dateRows.reduce(
      (sum, row) => sum + getNumberValue(row.order_count),
      0
    );

    if (intervalCount === 0 || totalOrders <= 0) {
      return;
    }

    const threshold = totalOrders / intervalCount;

    dateRows.forEach((row) => {
      const orderCount = getNumberValue(row.order_count);

      if (orderCount <= 0 || orderCount < threshold) {
        return;
      }

      const dayOfWeek = getDayOfWeekNumber(row);
      const hourStart = Math.trunc(getNumberValue(row.hour_of_day));
      const bucketKey = `${dayOfWeek}:${hourStart}`;
      const currentBucket =
        peakBuckets.get(bucketKey) ?? {
          dayOfWeek,
          hourStart,
          totalOrderCount: 0,
          totalThreshold: 0,
          occurrences: 0,
        };

      currentBucket.totalOrderCount += orderCount;
      currentBucket.totalThreshold += threshold;
      currentBucket.occurrences += 1;
      peakBuckets.set(bucketKey, currentBucket);
    });
  });

  const detectedAt = new Date().toISOString();

  return Array.from(peakBuckets.values())
    .map((bucket) => {
      const avgOrderCount = Number(
        (bucket.totalOrderCount / bucket.occurrences).toFixed(2)
      );
      const avgThreshold = bucket.totalThreshold / bucket.occurrences;

      return {
        day_of_week: bucket.dayOfWeek,
        hour_start: bucket.hourStart,
        hour_end: (bucket.hourStart + 1) % 24,
        avg_order_count: avgOrderCount,
        intensity: getIntensity(avgOrderCount, avgThreshold),
        detected_at: detectedAt,
      };
    })
    .sort(
      (left, right) =>
        right.avg_order_count - left.avg_order_count ||
        left.day_of_week - right.day_of_week ||
        left.hour_start - right.hour_start
    );
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
      .from("peak_hour_windows")
      .select("id, day_of_week, hour_start, hour_end, avg_order_count, intensity, detected_at")
      .order("day_of_week", { ascending: true })
      .order("hour_start", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: analyticsSetupError(error.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({ peakHourWindows: data ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading peak-hour windows." },
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
    const { data: hourlyRows, error: hourlyError } = await supabase
      .from("analytics_hourly")
      .select("order_date, day_of_week, hour_of_day, order_count, total_revenue")
      .order("order_date", { ascending: true })
      .order("hour_of_day", { ascending: true })
      .returns<AnalyticsHourlyRow[]>();

    if (hourlyError) {
      return NextResponse.json(
        { error: analyticsSetupError(hourlyError.message) },
        { status: 500 }
      );
    }

    const peakRows = buildPeakHourWindows(hourlyRows ?? []);
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
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while generating peak-hour windows." },
      { status: 500 }
    );
  }
}

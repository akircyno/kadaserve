import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fillDailySeries, generateDemandForecast, MIN_HISTORY_DAYS } from "@/lib/demand-forecast";

type AnalyticsOrderRow = {
  ordered_at: string;
};

const LOOKBACK_DAYS = 180;

const ANALYTICS_TIME_ZONE = "Asia/Manila";

function formatDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
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
    return { error: NextResponse.json({ error: profileError.message }, { status: 500 }) };
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
    const lookbackStart = new Date();
    lookbackStart.setDate(lookbackStart.getDate() - LOOKBACK_DAYS);

    const { data: orders, error } = await supabase
      .from("orders")
      .select("ordered_at")
      .gte("ordered_at", lookbackStart.toISOString())
      .neq("status", "cancelled")
      .neq("status", "expired")
      .order("ordered_at", { ascending: true })
      .returns<AnalyticsOrderRow[]>();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ forecast: null, reason: "No order history yet." });
    }

    const dailyCounts = new Map<string, number>();
    orders.forEach((order) => {
      const dateKey = formatDateKey(order.ordered_at);
      dailyCounts.set(dateKey, (dailyCounts.get(dateKey) ?? 0) + 1);
    });

    const sortedDates = Array.from(dailyCounts.keys()).sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];
    const series = fillDailySeries(dailyCounts, startDate, endDate);

    if (series.length < MIN_HISTORY_DAYS) {
      return NextResponse.json({
        forecast: null,
        reason: `Not enough order history yet for a forecast (need ${MIN_HISTORY_DAYS} days, have ${series.length}).`,
      });
    }

    const result = generateDemandForecast(series);

    if (!result) {
      return NextResponse.json({
        forecast: null,
        reason: "Could not fit a forecast model to the available data.",
      });
    }

    return NextResponse.json({
      forecast: result.forecast,
      diagnostics: result.diagnostics,
      coefficients: result.coefficients,
      history: series.slice(-30),
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while generating the demand forecast." },
      { status: 500 }
    );
  }
}

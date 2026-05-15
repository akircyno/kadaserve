import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  PREFERENCE_WEIGHTS,
  FEEDBACK_DIMENSION_WEIGHTS,
  FEEDBACK_MIN_CONFIDENT_OBSERVATIONS,
  FEEDBACK_SKEPTICAL_PRIOR,
  RECENCY_HALF_LIFE_DAYS,
} from "@/lib/recommendation-weights";

type PreferenceOrderRow = {
  id: string;
  customer_id: string | null;
  ordered_at: string;
  status: string;
};

type PreferenceOrderItemRow = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  quantity: number | null;
};

type PreferenceFeedbackRow = {
  order_id: string;
  order_item_id: string | null;
  customer_id: string | null;
  menu_item_id: string | null;
  taste_rating: number | null;
  strength_rating: number | null;
  overall_rating: number | null;
};

type CustomerPreferenceRow = {
  customer_id: string;
  menu_item_id: string;
  frequency: number;
  recency_score: number;
  avg_rating: number;
  preference_score: number;
  last_ordered_at: string;
  updated_at: string;
};

const FINAL_ORDER_STATUSES = new Set(["completed", "delivered"]);
const MANILA_TIME_ZONE = "Asia/Manila";
const REQUIRED_COLUMNS =
  "customer_id, menu_item_id, frequency, recency_score, avg_rating, preference_score, last_ordered_at, updated_at";
const CUSTOMER_PREFERENCES_MIGRATION_SQL = `alter table if exists public.customer_preferences
add column if not exists frequency integer not null default 0,
add column if not exists recency_score numeric not null default 0,
add column if not exists avg_rating numeric not null default 0,
add column if not exists preference_score numeric not null default 0,
add column if not exists last_ordered_at timestamptz,
add column if not exists updated_at timestamptz not null default now();

create unique index if not exists customer_preferences_customer_menu_item_key
on public.customer_preferences (customer_id, menu_item_id);`;

function analyticsSetupError(message: string) {
  const normalized = message.toLowerCase();

  return normalized.includes("customer_preferences") ||
    normalized.includes("frequency") ||
    normalized.includes("recency_score") ||
    normalized.includes("avg_rating") ||
    normalized.includes("on conflict") ||
    normalized.includes("unique")
    ? "customer_preferences is not set up yet. Run backend/seed/customer-preferences.sql in Supabase."
    : message;
}

function isMissingConflictConstraint(message: string) {
  return message
    .toLowerCase()
    .includes("no unique or exclusion constraint matching the on conflict");
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function getOrderItemQuantity(quantity: number | null) {
  const normalizedQuantity = Number(quantity);

  return Number.isFinite(normalizedQuantity) && normalizedQuantity > 0
    ? Math.round(normalizedQuantity)
    : 1;
}

function formatManilaDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function getDaysSinceLastOrder(lastOrderedAt: string) {
  const todayKey = formatManilaDateKey(new Date().toISOString());
  const lastOrderKey = formatManilaDateKey(lastOrderedAt);
  const todayStart = Date.parse(`${todayKey}T00:00:00+08:00`);
  const lastOrderStart = Date.parse(`${lastOrderKey}T00:00:00+08:00`);
  const days = Math.floor((todayStart - lastOrderStart) / 86_400_000);

  return Math.max(0, days);
}

/**
 * Hyperbolic recency decay: f(d) = 1 / (1 + d/τ)
 * τ = RECENCY_HALF_LIFE_DAYS (30 days). Reference: Ding et al. (2010), CIKM '05.
 */
function getRecencyScore(lastOrderedAt: string): number {
  const daysSinceLastOrder = getDaysSinceLastOrder(lastOrderedAt);
  return clamp01(1 / (1 + daysSinceLastOrder / RECENCY_HALF_LIFE_DAYS));
}

/**
 * Weighted feedback score using AHP sub-weights for each dimension.
 * Returns null when no valid dimension rating is present.
 * Dimensions: overall (0.54) > taste (0.30) > strength (0.16).
 */
function getFeedbackScore(row: PreferenceFeedbackRow): number | null {
  const overall  = Number(row.overall_rating);
  const taste    = Number(row.taste_rating);
  const strength = Number(row.strength_rating);

  const hasOverall  = Number.isFinite(overall)  && overall  > 0;
  const hasTaste    = Number.isFinite(taste)     && taste    > 0;
  const hasStrength = Number.isFinite(strength)  && strength > 0;

  if (!hasOverall && !hasTaste && !hasStrength) return null;

  let weightedSum = 0;
  let totalWeight = 0;

  if (hasOverall)  { weightedSum += FEEDBACK_DIMENSION_WEIGHTS.overall   * overall;  totalWeight += FEEDBACK_DIMENSION_WEIGHTS.overall; }
  if (hasTaste)    { weightedSum += FEEDBACK_DIMENSION_WEIGHTS.taste     * taste;    totalWeight += FEEDBACK_DIMENSION_WEIGHTS.taste; }
  if (hasStrength) { weightedSum += FEEDBACK_DIMENSION_WEIGHTS.strength  * strength; totalWeight += FEEDBACK_DIMENSION_WEIGHTS.strength; }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

function getBucketKey(customerId: string, menuItemId: string) {
  return `${customerId}:${menuItemId}`;
}

function buildCustomerPreferences(
  orders: PreferenceOrderRow[],
  orderItems: PreferenceOrderItemRow[],
  feedbackRows: PreferenceFeedbackRow[]
): CustomerPreferenceRow[] {
  const validOrders = orders.filter(
    (order) =>
      order.customer_id &&
      FINAL_ORDER_STATUSES.has(String(order.status).trim().toLowerCase())
  );
  const ordersById = new Map(validOrders.map((order) => [order.id, order]));
  const orderItemsByOrderId = new Map<string, PreferenceOrderItemRow[]>();
  const orderItemLookup = new Map<
    string,
    { customerId: string; menuItemId: string }
  >();
  const buckets = new Map<
    string,
    {
      customerId: string;
      menuItemId: string;
      frequency: number;
      lastOrderedAt: string;
      feedbackScores: number[];
    }
  >();

  orderItems.forEach((item) => {
    const order = ordersById.get(item.order_id);

    if (!order?.customer_id || !item.menu_item_id) {
      return;
    }

    const bucketKey = getBucketKey(order.customer_id, item.menu_item_id);
    const currentBucket =
      buckets.get(bucketKey) ?? {
        customerId: order.customer_id,
        menuItemId: item.menu_item_id,
        frequency: 0,
        lastOrderedAt: order.ordered_at,
        feedbackScores: [],
      };

    currentBucket.frequency += getOrderItemQuantity(item.quantity);

    if (new Date(order.ordered_at).getTime() > new Date(currentBucket.lastOrderedAt).getTime()) {
      currentBucket.lastOrderedAt = order.ordered_at;
    }

    buckets.set(bucketKey, currentBucket);

    const orderItemsForOrder = orderItemsByOrderId.get(item.order_id) ?? [];
    orderItemsForOrder.push(item);
    orderItemsByOrderId.set(item.order_id, orderItemsForOrder);
    orderItemLookup.set(item.id, {
      customerId: order.customer_id,
      menuItemId: item.menu_item_id,
    });
  });

  feedbackRows.forEach((feedback) => {
    const order = ordersById.get(feedback.order_id);
    const customerId = feedback.customer_id ?? order?.customer_id;
    const rating = getFeedbackScore(feedback);

    if (!customerId || rating === null) {
      return;
    }

    if (feedback.order_item_id) {
      const matchedOrderItem = orderItemLookup.get(feedback.order_item_id);
      const bucket = matchedOrderItem
        ? buckets.get(
            getBucketKey(matchedOrderItem.customerId, matchedOrderItem.menuItemId)
          )
        : null;

      if (bucket) {
        bucket.feedbackScores.push(rating);
        return;
      }
    }

    if (feedback.menu_item_id) {
      const bucket = buckets.get(getBucketKey(customerId, feedback.menu_item_id));

      if (bucket) {
        bucket.feedbackScores.push(rating);
      }

      return;
    }

    const orderItemsForOrder = orderItemsByOrderId.get(feedback.order_id) ?? [];
    orderItemsForOrder.forEach((item) => {
      if (!item.menu_item_id) {
        return;
      }

      const bucket = buckets.get(getBucketKey(customerId, item.menu_item_id));

      if (bucket) {
        bucket.feedbackScores.push(rating);
      }
    });
  });

  const updatedAt = new Date().toISOString();

  // Global max frequency across all customers for log-damped normalisation.
  // Prevents self-relative normalisation where a 1-order customer == 50-order customer.
  const globalMaxFrequency = Math.max(1, ...Array.from(buckets.values()).map((b) => b.frequency));

  return Array.from(buckets.values())
    .map((bucket) => {
      // Log-damped frequency normalised against global max (not customer max).
      const logFreq       = Math.log1p(bucket.frequency);
      const logGlobalMax  = Math.log1p(globalMaxFrequency);
      const frequencyScore = clamp01(logFreq / logGlobalMax);

      const recencyScore = Number(getRecencyScore(bucket.lastOrderedAt).toFixed(4));

      // Confidence-adjusted satisfaction: Bayesian shrinkage toward skeptical prior (0.5)
      // when observation count is below threshold — avoids silent mean imputation.
      const n = bucket.feedbackScores.length;
      const avgRaw = n > 0
        ? bucket.feedbackScores.reduce((s, v) => s + v, 0) / n
        : 0;
      const avgRating = Number(avgRaw.toFixed(2));
      const k = FEEDBACK_MIN_CONFIDENT_OBSERVATIONS;
      const observedMean = n > 0 ? clamp01(avgRating / 5) : FEEDBACK_SKEPTICAL_PRIOR;
      const feedbackScore = n > 0
        ? clamp01((n * observedMean + k * FEEDBACK_SKEPTICAL_PRIOR) / (n + k))
        : FEEDBACK_SKEPTICAL_PRIOR;

      const preferenceScore = Number(
        (
          PREFERENCE_WEIGHTS.frequency * frequencyScore +
          PREFERENCE_WEIGHTS.recency   * recencyScore   +
          PREFERENCE_WEIGHTS.feedback  * feedbackScore
        ).toFixed(4)
      );

      return {
        customer_id: bucket.customerId,
        menu_item_id: bucket.menuItemId,
        frequency: bucket.frequency,
        recency_score: recencyScore,
        avg_rating: avgRating,
        preference_score: preferenceScore,
        last_ordered_at: bucket.lastOrderedAt,
        updated_at: updatedAt,
      };
    })
    .sort(
      (first, second) =>
        second.preference_score - first.preference_score ||
        second.frequency - first.frequency ||
        second.avg_rating - first.avg_rating ||
        new Date(second.last_ordered_at).getTime() -
          new Date(first.last_ordered_at).getTime()
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
      .from("customer_preferences")
      .select(REQUIRED_COLUMNS)
      .order("preference_score", { ascending: false })
      .order("frequency", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          error: analyticsSetupError(error.message),
          migrationSql: CUSTOMER_PREFERENCES_MIGRATION_SQL,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ customerPreferences: data ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading customer preferences." },
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
    const { error: schemaError } = await supabase
      .from("customer_preferences")
      .select(REQUIRED_COLUMNS)
      .limit(1);

    if (schemaError) {
      return NextResponse.json(
        {
          error: analyticsSetupError(schemaError.message),
          migrationSql: CUSTOMER_PREFERENCES_MIGRATION_SQL,
        },
        { status: 500 }
      );
    }

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, customer_id, ordered_at, status")
      .not("customer_id", "is", null)
      .neq("status", "cancelled")
      .returns<PreferenceOrderRow[]>();

    if (ordersError) {
      return NextResponse.json(
        { error: analyticsSetupError(ordersError.message) },
        { status: 500 }
      );
    }

    const validOrderIds = (orders ?? [])
      .filter((order) =>
        FINAL_ORDER_STATUSES.has(String(order.status).trim().toLowerCase())
      )
      .map((order) => order.id);
    const { data: orderItems, error: orderItemsError } = validOrderIds.length
      ? await supabase
          .from("order_items")
          .select("id, order_id, menu_item_id, quantity")
          .in("order_id", validOrderIds)
          .returns<PreferenceOrderItemRow[]>()
      : { data: [], error: null };

    if (orderItemsError) {
      return NextResponse.json(
        { error: analyticsSetupError(orderItemsError.message) },
        { status: 500 }
      );
    }

    const { data: feedbackRows, error: feedbackError } = validOrderIds.length
      ? await supabase
          .from("feedback")
          .select(
            "order_id, order_item_id, customer_id, menu_item_id, taste_rating, strength_rating, overall_rating"
          )
          .in("order_id", validOrderIds)
          .returns<PreferenceFeedbackRow[]>()
      : { data: [], error: null };

    if (feedbackError) {
      return NextResponse.json(
        { error: analyticsSetupError(feedbackError.message) },
        { status: 500 }
      );
    }

    const preferenceRows = buildCustomerPreferences(
      orders ?? [],
      orderItems ?? [],
      feedbackRows ?? []
    );
    const { error: deleteError } = await supabase
      .from("customer_preferences")
      .delete()
      .not("customer_id", "is", null);

    if (deleteError) {
      return NextResponse.json(
        { error: analyticsSetupError(deleteError.message) },
        { status: 500 }
      );
    }

    if (preferenceRows.length === 0) {
      return NextResponse.json({
        success: true,
        customerPreferences: [],
      });
    }

    const { data: savedRows, error: upsertError } = await supabase
      .from("customer_preferences")
      .upsert(preferenceRows, { onConflict: "customer_id,menu_item_id" })
      .select(REQUIRED_COLUMNS);

    if (upsertError) {
      if (isMissingConflictConstraint(upsertError.message)) {
        const { data: insertedRows, error: insertError } = await supabase
          .from("customer_preferences")
          .insert(preferenceRows)
          .select(REQUIRED_COLUMNS);

        if (insertError) {
          return NextResponse.json(
            { error: analyticsSetupError(insertError.message) },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          customerPreferences: insertedRows ?? preferenceRows,
          migrationSql: CUSTOMER_PREFERENCES_MIGRATION_SQL,
        });
      }

      return NextResponse.json(
        {
          error: analyticsSetupError(upsertError.message),
          migrationSql: CUSTOMER_PREFERENCES_MIGRATION_SQL,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      customerPreferences: savedRows ?? preferenceRows,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while generating customer preferences." },
      { status: 500 }
    );
  }
}

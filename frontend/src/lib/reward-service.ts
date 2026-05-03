export const FREE_DELIVERY_FEE = 50;
export const POINTS_PER_COMPLETED_ITEM = 20;
export const POINTS_PER_FEEDBACK = 10;

export type RewardItemRow = {
  id: string;
  name: string;
  description: string;
  type: "delivery_fee";
  points_cost: number;
  value: number;
  is_active: boolean;
  created_at: string;
};

export type CustomerRewardRow = {
  id: string;
  customer_id: string;
  reward_item_id: string;
  code: string;
  status: "active" | "used" | "expired";
  redeemed_at: string;
  expires_at: string;
  used_at: string | null;
  order_id: string | null;
  reward_items: RewardItemRow | RewardItemRow[] | null;
};

type SupabaseLike = {
  from: (table: string) => RewardTableBuilder;
};

type QueryError = { message: string } | null;

type QueryResult<T> = Promise<{
  data: T;
  error: QueryError;
  count?: number | null;
}>;

type RewardTableBuilder = {
  select: (
    columns?: string,
    options?: { head?: boolean; count?: "exact" | "planned" | "estimated" }
  ) => RewardFilterBuilder;
  update: (values: Record<string, unknown>) => RewardFilterBuilder;
  insert: (
    values: Record<string, unknown> | Record<string, unknown>[]
  ) => RewardFilterBuilder;
};

type RewardFilterBuilder = {
  select: (
    columns?: string,
    options?: { head?: boolean; count?: "exact" | "planned" | "estimated" }
  ) => RewardFilterBuilder;
  eq: (column: string, value: unknown) => RewardFilterBuilder;
  lt: (column: string, value: unknown) => RewardFilterBuilder;
  in: (column: string, values: unknown[]) => RewardFilterBuilder;
  order: (column: string, options?: { ascending?: boolean }) => RewardFilterBuilder;
  maybeSingle: () => RewardFilterBuilder;
  single: () => RewardFilterBuilder;
  returns: <T>() => QueryResult<T>;
};

type CompletedOrderRow = {
  id: string;
  order_items: { quantity: number }[] | null;
};

type RedeemedRewardRow = {
  id: string;
  reward_items: { points_cost: number } | { points_cost: number }[] | null;
};

type FeedbackPointRow = {
  id: string;
};

function normalizeRewardItem(
  rewardItem: RewardItemRow | RewardItemRow[] | null
) {
  return Array.isArray(rewardItem) ? rewardItem[0] ?? null : rewardItem;
}

export function serializeCustomerReward(row: CustomerRewardRow) {
  const rewardItem = normalizeRewardItem(row.reward_items);

  return {
    id: row.id,
    code: row.code,
    status: row.status,
    redeemedAt: row.redeemed_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    orderId: row.order_id,
    rewardItem: rewardItem
      ? {
          id: rewardItem.id,
          name: rewardItem.name,
          description: rewardItem.description,
          type: rewardItem.type,
          pointsCost: rewardItem.points_cost,
          value: Number(rewardItem.value),
          isActive: rewardItem.is_active,
        }
      : null,
  };
}

export function serializeRewardItem(row: RewardItemRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    pointsCost: row.points_cost,
    value: Number(row.value),
    isActive: row.is_active,
  };
}

export async function expireCustomerRewards(
  supabase: unknown,
  customerId?: string
) {
  const db = supabase as SupabaseLike;
  let query = db
    .from("customer_rewards")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString());

  if (customerId) {
    query = query.eq("customer_id", customerId);
  }

  await query.select("id").returns<{ id: string }[]>();
}

export async function getCustomerRewardPoints(
  supabase: unknown,
  customerId: string
) {
  const db = supabase as SupabaseLike;
  const { data: completedOrders, error: ordersError } = await db
    .from("orders")
    .select(
      `
        id,
        order_items (
          quantity
        )
      `
    )
    .eq("customer_id", customerId)
    .in("status", ["completed", "delivered"])
    .returns<CompletedOrderRow[]>();

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  const earnedPoints = (completedOrders ?? []).reduce((sum, order) => {
    const itemCount = (order.order_items ?? []).reduce(
      (itemSum, item) => itemSum + Number(item.quantity ?? 0),
      0
    );

    return sum + itemCount * POINTS_PER_COMPLETED_ITEM;
  }, 0);

  const { data: feedbackRows, error: feedbackError } = await db
    .from("feedback")
    .select("id")
    .eq("customer_id", customerId)
    .returns<FeedbackPointRow[]>();

  if (feedbackError) {
    throw new Error(feedbackError.message);
  }

  const feedbackPoints = (feedbackRows ?? []).length * POINTS_PER_FEEDBACK;

  const { data: redeemedRewards, error: rewardsError } = await db
    .from("customer_rewards")
    .select(
      `
        id,
        reward_items (
          points_cost
        )
      `
    )
    .eq("customer_id", customerId)
    .returns<RedeemedRewardRow[]>();

  if (rewardsError) {
    throw new Error(rewardsError.message);
  }

  const spentPoints = (redeemedRewards ?? []).reduce((sum, reward) => {
    const rewardItem = Array.isArray(reward.reward_items)
      ? reward.reward_items[0]
      : reward.reward_items;

    return sum + Number(rewardItem?.points_cost ?? 0);
  }, 0);

  return Math.max(0, earnedPoints + feedbackPoints - spentPoints);
}

export function generateRewardCode(type: RewardItemRow["type"]) {
  const randomCode = crypto.randomUUID().slice(0, 8).toUpperCase();

  if (type === "delivery_fee") {
    return `FREEDELIVERY-${randomCode}`;
  }

  return `KADA-${randomCode}`;
}

export async function validateDeliveryReward({
  supabase,
  customerId,
  rewardId,
  rewardCode,
  orderType,
}: {
  supabase: unknown;
  customerId: string;
  rewardId?: string | null;
  rewardCode?: string | null;
  orderType: "pickup" | "delivery";
}) {
  if (orderType !== "delivery") {
    return {
      ok: false as const,
      error: "Free Delivery can only be used for delivery orders.",
      status: 400,
    };
  }

  const db = supabase as SupabaseLike;
  let query = db
    .from("customer_rewards")
    .select(
      `
        id,
        customer_id,
        reward_item_id,
        code,
        status,
        redeemed_at,
        expires_at,
        used_at,
        order_id,
        reward_items (
          id,
          name,
          description,
          type,
          points_cost,
          value,
          is_active,
          created_at
        )
      `
    )
    .eq("customer_id", customerId)
    .eq("status", "active");

  if (rewardId) {
    query = query.eq("id", rewardId);
  } else if (rewardCode) {
    query = query.eq("code", rewardCode.trim().toUpperCase());
  } else {
    return {
      ok: false as const,
      error: "Choose a reward voucher first.",
      status: 400,
    };
  }

  const { data: voucher, error } = await query
    .maybeSingle()
    .returns<CustomerRewardRow | null>();

  if (error) {
    return { ok: false as const, error: error.message, status: 500 };
  }

  const rewardItem = voucher ? normalizeRewardItem(voucher.reward_items) : null;

  if (!voucher || !rewardItem) {
    return {
      ok: false as const,
      error: "This reward is not available anymore.",
      status: 404,
    };
  }

  if (new Date(voucher.expires_at).getTime() <= Date.now()) {
    await db
      .from("customer_rewards")
      .update({ status: "expired" })
      .eq("id", voucher.id)
      .eq("customer_id", customerId);

    return {
      ok: false as const,
      error: "This reward voucher has expired.",
      status: 409,
    };
  }

  if (rewardItem.type !== "delivery_fee" || !rewardItem.is_active) {
    return {
      ok: false as const,
      error: "This reward cannot be applied to checkout.",
      status: 400,
    };
  }

  return {
    ok: true as const,
    voucher,
    rewardItem,
    discountAmount: Math.min(FREE_DELIVERY_FEE, Number(rewardItem.value)),
  };
}

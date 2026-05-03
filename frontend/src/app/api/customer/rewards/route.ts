import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  expireCustomerRewards,
  getCustomerRewardPoints,
  serializeCustomerReward,
  serializeRewardItem,
  type CustomerRewardRow,
  type RewardItemRow,
} from "@/lib/reward-service";

function rewardSetupError(message: string) {
  return message.toLowerCase().includes("reward_items") ||
    message.toLowerCase().includes("customer_rewards")
    ? "Rewards are not set up yet. Run backend/seed/rewards.sql in Supabase."
    : message;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await expireCustomerRewards(supabase, user.id);

    const { data: rewardItems, error: rewardItemsError } = await supabase
      .from("reward_items")
      .select("id, name, description, type, points_cost, value, is_active, created_at")
      .eq("is_active", true)
      .order("points_cost", { ascending: true })
      .returns<RewardItemRow[]>();

    if (rewardItemsError) {
      return NextResponse.json(
        { error: rewardSetupError(rewardItemsError.message) },
        { status: 500 }
      );
    }

    const { data: vouchers, error: vouchersError } = await supabase
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
      .eq("customer_id", user.id)
      .order("redeemed_at", { ascending: false })
      .returns<CustomerRewardRow[]>();

    if (vouchersError) {
      return NextResponse.json(
        { error: rewardSetupError(vouchersError.message) },
        { status: 500 }
      );
    }

    const points = await getCustomerRewardPoints(supabase, user.id);
    const serializedVouchers = (vouchers ?? []).map(serializeCustomerReward);

    return NextResponse.json({
      points,
      redeemableRewards: (rewardItems ?? []).map(serializeRewardItem),
      activeVouchers: serializedVouchers.filter(
        (voucher) =>
          voucher.status === "active" &&
          new Date(voucher.expiresAt).getTime() > Date.now()
      ),
      vouchers: serializedVouchers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? rewardSetupError(error.message)
            : "Something went wrong while loading rewards.",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  expireCustomerRewards,
  generateRewardCode,
  getCustomerRewardPoints,
  serializeCustomerReward,
  type CustomerRewardRow,
  type RewardItemRow,
} from "@/lib/reward-service";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function rewardSetupError(message: string) {
  return message.toLowerCase().includes("reward_items") ||
    message.toLowerCase().includes("customer_rewards")
    ? "Rewards are not set up yet. Run backend/seed/rewards.sql in Supabase."
    : message;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const rewardItemId =
      typeof body.rewardItemId === "string" ? body.rewardItemId : null;

    if (!rewardItemId) {
      return NextResponse.json(
        { error: "Choose a reward to redeem." },
        { status: 400 }
      );
    }

    await expireCustomerRewards(supabase, user.id);

    const { data: rewardItem, error: rewardItemError } = await supabase
      .from("reward_items")
      .select("id, name, description, type, points_cost, value, is_active, created_at")
      .eq("id", rewardItemId)
      .eq("is_active", true)
      .maybeSingle()
      .returns<RewardItemRow | null>();

    if (rewardItemError) {
      return NextResponse.json(
        { error: rewardSetupError(rewardItemError.message) },
        { status: 500 }
      );
    }

    if (!rewardItem) {
      return NextResponse.json(
        { error: "This reward is not available anymore." },
        { status: 404 }
      );
    }

    const points = await getCustomerRewardPoints(supabase, user.id);

    if (points < rewardItem.points_cost) {
      return NextResponse.json(
        { error: "You do not have enough points for this reward." },
        { status: 409 }
      );
    }

    const { data: voucher, error: voucherError } = await supabase
      .from("customer_rewards")
      .insert({
        customer_id: user.id,
        reward_item_id: rewardItem.id,
        code: generateRewardCode(rewardItem.type),
        status: "active",
        expires_at: addDays(new Date(), 30).toISOString(),
      })
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
      .single()
      .returns<CustomerRewardRow>();

    if (voucherError) {
      return NextResponse.json(
        { error: rewardSetupError(voucherError.message) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${rewardItem.name} added to My Rewards.`,
      points: Math.max(0, points - rewardItem.points_cost),
      voucher: serializeCustomerReward(voucher),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? rewardSetupError(error.message)
            : "Something went wrong while redeeming this reward.",
      },
      { status: 500 }
    );
  }
}

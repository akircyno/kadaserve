import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  serializeCustomerReward,
  validateDeliveryReward,
} from "@/lib/reward-service";

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
    const rewardId = typeof body.rewardId === "string" ? body.rewardId : null;
    const rewardCode =
      typeof body.rewardCode === "string" ? body.rewardCode : null;
    const orderType = body.orderType === "delivery" ? "delivery" : "pickup";

    const validation = await validateDeliveryReward({
      supabase,
      customerId: user.id,
      rewardId,
      rewardCode,
      orderType,
    });

    if (!validation.ok) {
      return NextResponse.json(
        { error: rewardSetupError(validation.error) },
        { status: validation.status }
      );
    }

    return NextResponse.json({
      success: true,
      reward: serializeCustomerReward(validation.voucher),
      rewardCode: validation.voucher.code,
      discountAmount: validation.discountAmount,
      deliveryFee: 0,
      message: "Free Delivery reward applied.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? rewardSetupError(error.message)
            : "Something went wrong while applying this reward.",
      },
      { status: 500 }
    );
  }
}

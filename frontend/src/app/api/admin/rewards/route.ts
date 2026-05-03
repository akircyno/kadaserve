import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  expireCustomerRewards,
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "staff"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await expireCustomerRewards(supabase);

    const { data: rewardItems, error: rewardItemsError } = await supabase
      .from("reward_items")
      .select("id, name, description, type, points_cost, value, is_active, created_at")
      .order("created_at", { ascending: false })
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
      .returns<CustomerRewardRow[]>();

    if (vouchersError) {
      return NextResponse.json(
        { error: rewardSetupError(vouchersError.message) },
        { status: 500 }
      );
    }

    const vouchersByRewardId = new Map<string, CustomerRewardRow[]>();
    (vouchers ?? []).forEach((voucher) => {
      const current = vouchersByRewardId.get(voucher.reward_item_id) ?? [];
      current.push(voucher);
      vouchersByRewardId.set(voucher.reward_item_id, current);
    });

    const rewardPool = (rewardItems ?? []).map((item) => {
      const itemVouchers = vouchersByRewardId.get(item.id) ?? [];

      return {
        ...serializeRewardItem(item),
        redeemedCount: itemVouchers.length,
        usedCount: itemVouchers.filter((voucher) => voucher.status === "used").length,
        activeUnusedCount: itemVouchers.filter(
          (voucher) =>
            voucher.status === "active" &&
            new Date(voucher.expires_at).getTime() > Date.now()
        ).length,
      };
    });

    return NextResponse.json({
      rewardPool,
      summary: {
        totalRedeemed: vouchers?.length ?? 0,
        totalUsed:
          vouchers?.filter((voucher) => voucher.status === "used").length ?? 0,
        activeUnused:
          vouchers?.filter(
            (voucher) =>
              voucher.status === "active" &&
              new Date(voucher.expires_at).getTime() > Date.now()
          ).length ?? 0,
        freeDeliveryRedeemed:
          rewardPool.find((item) => item.type === "delivery_fee")?.redeemedCount ?? 0,
        freeDeliveryUsed:
          rewardPool.find((item) => item.type === "delivery_fee")?.usedCount ?? 0,
      },
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

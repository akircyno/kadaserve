import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeStoreOverride,
  resolveStoreStatus,
  STORE_STATUS_SETTING_KEY,
} from "@/lib/store-status";
import {
  FREE_DELIVERY_FEE,
  validateDeliveryReward,
} from "@/lib/reward-service";

type CheckoutItem = {
  menu_item_id: string;
  name: string;
  base_price: number;
  quantity: number;
  sugar_level: number;
  ice_level: string | null;
  size: string;
  temperature: string;
  addons: string[];
  addon_price: number;
  special_instructions: string;
  image_url: string | null;
};

function getVoucherDiscount(subtotal: number, code: string) {
  const normalizedCode = code.trim().toUpperCase();

  if (normalizedCode === "KADA10") {
    return Math.round(subtotal * 0.1);
  }

  if (normalizedCode === "FIRSTSIP") {
    return Math.min(50, subtotal);
  }

  if (normalizedCode === "KADA30") {
    return Math.min(30, subtotal);
  }

  if (normalizedCode === "CREAMYADDON") {
    return Math.min(15, subtotal);
  }

  return 0;
}

function isMissingStoreSettingsTable(error: { message?: string; code?: string } | null) {
  return (
    error?.code === "42P01" ||
    Boolean(error?.message?.toLowerCase().includes("store_settings"))
  );
}

function getOptionalCoordinate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function isValidLatLng(lat: number | null, lng: number | null) {
  if (lat === null && lng === null) {
    return true;
  }

  return (
    lat !== null &&
    lng !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to checkout." },
        { status: 401 }
      );
    }

    const { data: storeSetting, error: storeSettingError } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", STORE_STATUS_SETTING_KEY)
      .maybeSingle();

    if (storeSettingError && !isMissingStoreSettingsTable(storeSettingError)) {
      return NextResponse.json(
        { error: storeSettingError.message },
        { status: 500 }
      );
    }

    const storeStatus = resolveStoreStatus(
      normalizeStoreOverride(storeSetting?.value)
    );

    if (storeStatus.effectiveStatus !== "open") {
      return NextResponse.json(
        {
          error:
            storeStatus.checkoutBlockedMessage ||
            "Kada Cafe PH is not accepting orders right now.",
          storeStatus,
        },
        { status: 409 }
      );
    }

    const body = await request.json();

    const items = body.items as CheckoutItem[];
    const orderType = body.orderType as "pickup" | "delivery";
    const paymentMethod = body.paymentMethod as "cash" | "gcash";
    const deliveryAddress =
      typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
    const deliveryLat = getOptionalCoordinate(body.deliveryLat);
    const deliveryLng = getOptionalCoordinate(body.deliveryLng);
    const voucherCode = typeof body.voucherCode === "string" ? body.voucherCode : "";
    const rewardId = typeof body.rewardId === "string" ? body.rewardId : null;
    const rewardCode = typeof body.rewardCode === "string" ? body.rewardCode : null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, phone")
      .eq("id", user.id)
      .maybeSingle();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    if (!orderType || !["pickup", "delivery"].includes(orderType)) {
      return NextResponse.json(
        { error: "Please select pickup or delivery." },
        { status: 400 }
      );
    }

    if (!paymentMethod || !["cash", "gcash"].includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Please select a payment method." },
        { status: 400 }
      );
    }

    if (orderType === "delivery" && paymentMethod !== "cash") {
      return NextResponse.json(
        { error: "Delivery orders can only use cash payment." },
        { status: 400 }
      );
    }

    if (orderType === "delivery") {
      if (!deliveryAddress) {
        return NextResponse.json(
          { error: "Delivery address is required." },
          { status: 400 }
        );
      }

      if (!isValidLatLng(deliveryLat, deliveryLng)) {
        return NextResponse.json(
          { error: "Use a valid delivery pin location." },
          { status: 400 }
        );
      }
    }

    const subtotal = items.reduce((sum, item) => {
      return sum + (item.base_price + item.addon_price) * item.quantity;
    }, 0);
    const baseDeliveryFee = orderType === "delivery" ? FREE_DELIVERY_FEE : 0;
    let deliveryFee = baseDeliveryFee;
    let rewardDiscountAmount = 0;
    let appliedRewardCode: string | null = null;
    let appliedRewardId: string | null = null;

    if (rewardId || rewardCode) {
      const rewardValidation = await validateDeliveryReward({
        supabase,
        customerId: user.id,
        rewardId,
        rewardCode,
        orderType,
      });

      if (!rewardValidation.ok) {
        return NextResponse.json(
          { error: rewardValidation.error },
          { status: rewardValidation.status }
        );
      }

      appliedRewardId = rewardValidation.voucher.id;
      appliedRewardCode = rewardValidation.voucher.code;
      rewardDiscountAmount = Math.min(baseDeliveryFee, rewardValidation.discountAmount);
      deliveryFee = Math.max(0, baseDeliveryFee - rewardDiscountAmount);
    }

    const voucherDiscount = getVoucherDiscount(subtotal, voucherCode);
    const totalAmount = Math.max(0, subtotal + deliveryFee - voucherDiscount);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: user.id,
        order_type: orderType,
        status: "pending",
        payment_method: paymentMethod,
        payment_status: "unpaid",
        total_amount: totalAmount,
        delivery_fee: deliveryFee,
        reward_code: appliedRewardCode,
        reward_discount_amount: rewardDiscountAmount,
        delivery_address: orderType === "delivery" ? deliveryAddress : null,
        delivery_lat: orderType === "delivery" ? deliveryLat : null,
        delivery_lng: orderType === "delivery" ? deliveryLng : null,
        delivery_email:
          orderType === "delivery" ? profile?.email || user.email || null : null,
        delivery_phone: orderType === "delivery" ? profile?.phone || null : null,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || "Failed to create order." },
        { status: 500 }
      );
    }

    const orderItemsPayload = items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.base_price + item.addon_price,
      sugar_level: item.sugar_level,
      ice_level: item.ice_level,
      size: item.size,
      temperature: item.temperature,
      addons: item.addons,
      addon_price: item.addon_price,
      special_instructions: item.special_instructions || null,
    }));

    const { error: orderItemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (orderItemsError) {
      return NextResponse.json(
        { error: orderItemsError.message },
        { status: 500 }
      );
    }

    if (appliedRewardId) {
      const { data: usedVoucher, error: rewardUseError } = await supabase
        .from("customer_rewards")
        .update({
          status: "used",
          used_at: new Date().toISOString(),
          order_id: order.id,
        })
        .eq("id", appliedRewardId)
        .eq("customer_id", user.id)
        .eq("status", "active")
        .select("id")
        .maybeSingle();

      if (rewardUseError || !usedVoucher) {
        return NextResponse.json(
          {
            error:
              rewardUseError?.message ||
              "This reward could not be marked as used. Please try again.",
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderType,
      deliveryFee,
      rewardCode: appliedRewardCode,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong during checkout." },
      { status: 500 }
    );
  }
}

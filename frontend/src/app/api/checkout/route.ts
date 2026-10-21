import { NextResponse } from "next/server";
import {
  getDistanceBasedDeliveryFee,
  hasDeliveryCoordinates,
} from "@/lib/delivery-fee";
import {
  getPaymentSetupMessage,
  readPaymentProof,
  removePaymentProof,
  uploadPaymentProof,
  type PaymentProofUpload,
} from "@/lib/payments/payment-proof-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeStoreOverride,
  resolveStoreStatus,
  STORE_STATUS_SETTING_KEY,
} from "@/lib/store-status";

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

// Cash checkout sends JSON. GCash QR checkout sends multipart form data:
// "payload" (the same JSON) plus "paymentProof" (the payment screenshot).
async function readCheckoutRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return { body: await request.json(), paymentProof: null };
  }

  const formData = await request.formData();
  const payload = formData.get("payload");

  return {
    body: typeof payload === "string" ? JSON.parse(payload) : {},
    paymentProof: formData.get("paymentProof"),
  };
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

    const { body, paymentProof: paymentProofField } = await readCheckoutRequest(request);

    const items = body.items as CheckoutItem[];
    const orderType = body.orderType as "pickup" | "delivery";
    const paymentMethod = body.paymentMethod as "cash" | "online";
    const deliveryAddress =
      typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
    const deliveryPhone =
      typeof body.deliveryPhone === "string" ? body.deliveryPhone.trim() : "";
    const deliveryLat = getOptionalCoordinate(body.deliveryLat);
    const deliveryLng = getOptionalCoordinate(body.deliveryLng);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
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

    if (!paymentMethod || !["cash", "online"].includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Please select a payment method." },
        { status: 400 }
      );
    }

    // GCash QR orders need a valid payment screenshot before anything is created.
    let paymentProof: PaymentProofUpload | null = null;

    if (paymentMethod === "online") {
      const { proof, error: proofError } = await readPaymentProof(paymentProofField);

      if (!proof) {
        return NextResponse.json({ error: proofError }, { status: 400 });
      }

      paymentProof = proof;
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

      if (!hasDeliveryCoordinates(deliveryLat, deliveryLng)) {
        return NextResponse.json(
          { error: "Pin your delivery location to calculate the delivery fee." },
          { status: 400 }
        );
      }
    }

    const subtotal = items.reduce((sum, item) => {
      return sum + (item.base_price + item.addon_price) * item.quantity;
    }, 0);
    const deliveryFeeQuote =
      orderType === "delivery" && hasDeliveryCoordinates(deliveryLat, deliveryLng)
        ? getDistanceBasedDeliveryFee(deliveryLat as number, deliveryLng as number)
        : null;

    if (deliveryFeeQuote && !deliveryFeeQuote.isDeliverable) {
      return NextResponse.json(
        {
          error: `Delivery is available within ${deliveryFeeQuote.maxDeliveryDistanceKm} km of the cafe.`,
        },
        { status: 400 }
      );
    }

    const deliveryFee =
      orderType === "delivery" && deliveryFeeQuote?.isDeliverable
        ? deliveryFeeQuote.fee ?? 0
        : 0;
    const totalAmount = Math.max(0, subtotal + deliveryFee);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: user.id,
        order_type: orderType,
        status: paymentMethod === "online" ? "pending_payment" : "pending",
        payment_method: paymentMethod,
        payment_status: "unpaid",
        total_amount: totalAmount,
        delivery_fee: deliveryFee,
        delivery_address: orderType === "delivery" ? deliveryAddress : null,
        delivery_lat: orderType === "delivery" ? deliveryLat : null,
        delivery_lng: orderType === "delivery" ? deliveryLng : null,
        delivery_email:
          orderType === "delivery" ? profile?.email || user.email || null : null,
        delivery_phone:
          orderType === "delivery" ? deliveryPhone || profile?.phone || null : null,
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
      await supabase.from("orders").delete().eq("id", order.id);

      return NextResponse.json(
        { error: orderItemsError.message },
        { status: 500 }
      );
    }

    if (paymentMethod === "online" && paymentProof) {
      // Store the screenshot, then mark the order as waiting for staff verification.
      // Uploading proof never marks an order paid; staff/admin approve it after checking GCash.
      const adminSupabase = createAdminClient();
      let proofPath: string | null = null;

      try {
        proofPath = await uploadPaymentProof(adminSupabase, {
          customerId: user.id,
          orderId: order.id,
          proof: paymentProof,
        });

        const { error: paymentUpdateError } = await adminSupabase
          .from("orders")
          .update({
            payment_status: "pending_verification",
            payment_proof_path: proofPath,
            payment_submitted_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        if (paymentUpdateError) {
          throw paymentUpdateError;
        }

        return NextResponse.json({
          success: true,
          orderId: order.id,
          orderType,
          deliveryFee,
          paymentStatus: "pending_verification",
          totalAmount,
        });
      } catch (paymentError) {
        if (proofPath) {
          await removePaymentProof(adminSupabase, proofPath);
        }
        await adminSupabase.from("order_items").delete().eq("order_id", order.id);
        await adminSupabase.from("orders").delete().eq("id", order.id);

        return NextResponse.json(
          {
            error:
              getPaymentSetupMessage(paymentError as { message?: string }) ??
              "Your payment screenshot could not be saved. Please try again.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderType,
      deliveryFee,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong during checkout." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import {
  getDistanceBasedDeliveryFee,
  hasDeliveryCoordinates,
} from "@/lib/delivery-fee";
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

type PayMongoPaymentIntent = {
  id: string;
  attributes?: {
    client_key?: string;
    next_action?: {
      code?: {
        amount?: number;
        id?: string;
        image_url?: string;
        label?: string;
      };
      type?: string;
    } | null;
    status?: string;
  };
};

type PayMongoPaymentMethod = {
  id: string;
};

type PayMongoPaymentIntentResponse = {
  data?: PayMongoPaymentIntent;
  errors?: Array<{ detail?: string; message?: string }>;
};

type PayMongoPaymentMethodResponse = {
  data?: PayMongoPaymentMethod;
  errors?: Array<{ detail?: string; message?: string }>;
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

function toPayMongoAmount(value: number) {
  return Math.max(0, Math.round(value * 100));
}

function getPayMongoSecretKey() {
  return process.env.PAYMONGO_SECRET_KEY?.trim() || "";
}

function getPayMongoMode(secretKey: string) {
  return secretKey.startsWith("sk_live_") ? "live" : "test";
}

function getPayMongoErrorMessage(
  result:
    | PayMongoPaymentIntentResponse
    | PayMongoPaymentMethodResponse,
  fallback: string
) {
  return result.errors?.[0]?.detail || result.errors?.[0]?.message || fallback;
}

function getPayMongoHeaders(secretKey: string) {
  return {
    Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

async function createPayMongoQrPhPayment({
  orderId,
  customerEmail,
  customerName,
  customerPhone,
  deliveryAddress,
  totalAmount,
}: {
  orderId: string;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  totalAmount: number;
}) {
  const secretKey = getPayMongoSecretKey();

  if (!secretKey) {
    throw new Error("PayMongo secret key is not configured.");
  }

  const headers = getPayMongoHeaders(secretKey);
  const paymentIntentResponse = await fetch(
    "https://api.paymongo.com/v1/payment_intents",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          attributes: {
            amount: toPayMongoAmount(totalAmount),
            currency: "PHP",
            description: `KadaServe order ${orderId.slice(0, 8).toUpperCase()}`,
            metadata: {
              order_id: orderId,
            },
            payment_method_allowed: ["qrph"],
          },
        },
      }),
    }
  );
  const paymentIntentResult =
    (await paymentIntentResponse.json()) as PayMongoPaymentIntentResponse;
  const paymentIntent = paymentIntentResult.data;

  if (!paymentIntentResponse.ok || !paymentIntent?.id) {
    throw new Error(
      getPayMongoErrorMessage(
        paymentIntentResult,
        "PayMongo QR Ph payment intent could not be created."
      )
    );
  }

  const paymentMethodResponse = await fetch(
    "https://api.paymongo.com/v1/payment_methods",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              address: deliveryAddress ? { line1: deliveryAddress } : undefined,
              email: customerEmail ?? undefined,
              name: customerName || "KadaServe Customer",
              phone: customerPhone || undefined,
            },
            type: "qrph",
          },
        },
      }),
    }
  );
  const paymentMethodResult =
    (await paymentMethodResponse.json()) as PayMongoPaymentMethodResponse;
  const paymentMethod = paymentMethodResult.data;

  if (!paymentMethodResponse.ok || !paymentMethod?.id) {
    throw new Error(
      getPayMongoErrorMessage(
        paymentMethodResult,
        "PayMongo QR Ph payment method could not be created."
      )
    );
  }

  const attachResponse = await fetch(
    `https://api.paymongo.com/v1/payment_intents/${paymentIntent.id}/attach`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          attributes: {
            client_key: paymentIntent.attributes?.client_key,
            payment_method: paymentMethod.id,
          },
        },
      }),
    }
  );
  const attachResult =
    (await attachResponse.json()) as PayMongoPaymentIntentResponse;
  const attachedIntent = attachResult.data;
  const qrCode = attachedIntent?.attributes?.next_action?.code;

  if (!attachResponse.ok || !attachedIntent?.id || !qrCode?.image_url) {
    throw new Error(
      getPayMongoErrorMessage(
        attachResult,
        "PayMongo QR Ph code could not be generated."
      )
    );
  }

  return {
    mode: getPayMongoMode(secretKey),
    paymentIntentId: attachedIntent.id,
    paymentMethodId: paymentMethod.id,
    qrCodeId: qrCode.id ?? null,
    qrCodeImageUrl: qrCode.image_url,
    qrCodeLabel: qrCode.label ?? "KadaServe",
    totalAmount,
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

    const body = await request.json();

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

    if (paymentMethod === "online") {
      try {
        const payMongoQrPh = await createPayMongoQrPhPayment({
          orderId: order.id,
          customerEmail: profile?.email || user.email || null,
          customerName: profile?.full_name ?? null,
          customerPhone:
            orderType === "delivery"
              ? deliveryPhone || profile?.phone || null
              : profile?.phone ?? null,
          deliveryAddress: orderType === "delivery" ? deliveryAddress : null,
          totalAmount,
        });
        const qrExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        const { error: paymentUpdateError } = await supabase
          .from("orders")
          .update({
            paymongo_payment_intent_id: payMongoQrPh.paymentIntentId,
            paymongo_payment_method_used: "qrph",
            paymongo_qr_code_id: payMongoQrPh.qrCodeId,
            paymongo_qr_code_image_url: payMongoQrPh.qrCodeImageUrl,
            paymongo_qr_code_label: payMongoQrPh.qrCodeLabel,
            paymongo_qr_expires_at: qrExpiresAt,
          })
          .eq("id", order.id);

        if (paymentUpdateError) {
          throw new Error(paymentUpdateError.message);
        }

        return NextResponse.json({
          success: true,
          orderId: order.id,
          orderType,
          deliveryFee,
          paymentProvider: "paymongo",
          paymentFlow: "qrph",
          paymongoMode: payMongoQrPh.mode,
          qrCodeExpiresInMinutes: 30,
          qrCodeId: payMongoQrPh.qrCodeId,
          qrCodeImageUrl: payMongoQrPh.qrCodeImageUrl,
          qrCodeLabel: payMongoQrPh.qrCodeLabel,
          qrCodeExpiresAt: qrExpiresAt,
          paymentStatus: "pending_payment",
          totalAmount,
        });
      } catch (payMongoError) {
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);

        return NextResponse.json(
          {
            error:
              payMongoError instanceof Error
                ? payMongoError.message
                : "PayMongo QR Ph payment could not be created.",
          },
          { status: 502 }
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

import { NextResponse } from "next/server";
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

type PayMongoCheckoutSession = {
  id: string;
  attributes?: {
    checkout_url?: string;
  };
};

type PayMongoCheckoutResponse = {
  data?: PayMongoCheckoutSession;
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

function getAbsoluteUrl(requestUrl: URL, path: string) {
  return new URL(path, requestUrl.origin).toString();
}

function getPayMongoSecretKey() {
  return process.env.PAYMONGO_SECRET_KEY?.trim() || "";
}

async function createPayMongoCheckoutSession({
  requestUrl,
  orderId,
  customerEmail,
  items,
  totalAmount,
}: {
  requestUrl: URL;
  orderId: string;
  customerEmail: string | null;
  items: CheckoutItem[];
  totalAmount: number;
}) {
  const secretKey = getPayMongoSecretKey();

  if (!secretKey) {
    throw new Error("PayMongo secret key is not configured.");
  }

  const lineItems = items.map((item) => ({
    currency: "PHP",
    amount: toPayMongoAmount(item.base_price + item.addon_price),
    name: item.name,
    quantity: item.quantity,
    description: item.special_instructions || undefined,
  }));

  const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          billing: customerEmail ? { email: customerEmail } : undefined,
          description: `KadaServe order ${orderId.slice(0, 8).toUpperCase()}`,
          line_items: lineItems,
          metadata: {
            order_id: orderId,
          },
          payment_method_types: ["gcash", "paymaya", "card"],
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          success_url: getAbsoluteUrl(
            requestUrl,
            `/customer?tab=orders&orderId=${orderId}&payment=processing`
          ),
          cancel_url: getAbsoluteUrl(
            requestUrl,
            `/customer/cart?payment=cancelled&orderId=${orderId}`
          ),
        },
      },
    }),
  });

  const result = (await response.json()) as PayMongoCheckoutResponse;

  if (!response.ok || !result.data?.attributes?.checkout_url) {
    const errorMessage =
      result.errors?.[0]?.detail ||
      result.errors?.[0]?.message ||
      "PayMongo checkout could not be created.";

    throw new Error(errorMessage);
  }

  return {
    checkoutSessionId: result.data.id,
    checkoutUrl: result.data.attributes.checkout_url,
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
    const requestUrl = new URL(request.url);

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
    }

    const subtotal = items.reduce((sum, item) => {
      return sum + (item.base_price + item.addon_price) * item.quantity;
    }, 0);
    const baseDeliveryFee = 0;
    const deliveryFee = baseDeliveryFee;
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
        const payMongoCheckout = await createPayMongoCheckoutSession({
          requestUrl,
          orderId: order.id,
          customerEmail: profile?.email || user.email || null,
          items,
          totalAmount,
        });

        const { error: paymentUpdateError } = await supabase
          .from("orders")
          .update({
            paymongo_checkout_session_id:
              payMongoCheckout.checkoutSessionId,
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
          checkoutUrl: payMongoCheckout.checkoutUrl,
          paymentStatus: "pending_payment",
        });
      } catch (payMongoError) {
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);

        return NextResponse.json(
          {
            error:
              payMongoError instanceof Error
                ? payMongoError.message
                : "PayMongo checkout could not be created.",
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

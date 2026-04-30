import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const body = await request.json();

    const items = body.items as CheckoutItem[];
    const orderType = body.orderType as "pickup" | "delivery";
    const paymentMethod = body.paymentMethod as "cash" | "gcash";
    const deliveryAddress =
      typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
    const voucherCode = typeof body.voucherCode === "string" ? body.voucherCode : "";

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

    if (orderType === "delivery") {
      if (!deliveryAddress) {
        return NextResponse.json(
          { error: "Delivery address is required." },
          { status: 400 }
        );
      }
    }

    const subtotal = items.reduce((sum, item) => {
      return sum + (item.base_price + item.addon_price) * item.quantity;
    }, 0);
    const totalAmount = Math.max(0, subtotal - getVoucherDiscount(subtotal, voucherCode));

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: user.id,
        order_type: orderType,
        status: "pending",
        payment_method: paymentMethod,
        payment_status: "unpaid",
        total_amount: totalAmount,
        delivery_address: orderType === "delivery" ? deliveryAddress : null,
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

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderType,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong during checkout." },
      { status: 500 }
    );
  }
}

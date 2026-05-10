import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type StaffCartItem = {
  id: string;
  name: string;
  price?: number;
  base_price?: number;
  size: "regular" | "small" | "large";
  quantity: number;
  sugar_level?: number;
  ice_level?: string | null;
  addons?: string[];
  addon_price?: number;
  special_instructions?: string;
  temperature?: string;
};

type CreateStaffOrderBody = {
  orderType: "pickup" | "delivery";
  items: StaffCartItem[];
  totalAmount: number;
  deliveryFee?: number;
  walkinName?: string;
  deliveryAddress?: string;
  deliveryEmail?: string;
  deliveryPhone?: string;
  paymentMethod?: "cash" | "gcash";
  paymentStatus?: "unpaid" | "paid";
};





function normalizeSize(size: StaffCartItem["size"]) {
  if (size === "regular") return "small";

  return size;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    if (!profile || !["staff", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as CreateStaffOrderBody;

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    if (!["pickup", "delivery"].includes(body.orderType)) {
      return NextResponse.json(
        { error: "Invalid order type." },
        { status: 400 }
      );
    }

    const paymentMethod = body.paymentMethod ?? "cash";
    const paymentStatus = body.paymentStatus ?? "paid";

    if (!["cash", "gcash"].includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Invalid payment method." },
        { status: 400 }
      );
    }

    if (!["unpaid", "paid"].includes(paymentStatus)) {
      return NextResponse.json(
        { error: "Invalid payment status." },
        { status: 400 }
      );
    }


    if (body.orderType === "delivery") {
      if (
        !body.deliveryAddress?.trim() ||
        !body.deliveryPhone?.trim()
      ) {
        return NextResponse.json(
          { error: "Delivery address and phone are required." },
          { status: 400 }
        );
      }
    }

    if (body.orderType === "pickup" && !body.walkinName?.trim()) {
      return NextResponse.json(
        { error: "Customer name is required for walk-in pickup." },
        { status: 400 }
      );
    }


    const calculatedItemsTotal = body.items.reduce((sum, item) => {
      const basePrice = Number(item.base_price ?? item.price ?? 0);
      const addonPrice = Number(item.addon_price ?? 0);

      return sum + (basePrice + addonPrice) * item.quantity;
    }, 0);
    const deliveryFee =
      body.orderType === "delivery" ? Math.max(0, Number(body.deliveryFee ?? 0)) : 0;
    const calculatedTotal = calculatedItemsTotal + deliveryFee;

    if (calculatedTotal !== body.totalAmount) {
      return NextResponse.json(
        { error: "Order total does not match cart total." },
        { status: 400 }
      );
    }

    const orderPayload = {
        customer_id: null,
        order_type: body.orderType,
        status: "pending",
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        total_amount: calculatedTotal,
        delivery_fee: deliveryFee,
        walkin_name: body.walkinName?.trim() || null,
        delivery_address:
          body.orderType === "delivery" ? body.deliveryAddress?.trim() : null,
        delivery_email:
          body.orderType === "delivery" ? body.deliveryEmail?.trim() : null,
        delivery_phone:
          body.orderType === "delivery" ? body.deliveryPhone?.trim() : null,
        encoded_by: user.id,
      };

    let { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (orderError && orderError.message.toLowerCase().includes("encoded_by")) {
      const legacyOrderPayload: Omit<typeof orderPayload, "encoded_by"> = {
        customer_id: orderPayload.customer_id,
        order_type: orderPayload.order_type,
        status: orderPayload.status,
        payment_method: orderPayload.payment_method,
        payment_status: orderPayload.payment_status,
        total_amount: orderPayload.total_amount,
        delivery_fee: orderPayload.delivery_fee,
        walkin_name: orderPayload.walkin_name,
        delivery_address: orderPayload.delivery_address,
        delivery_email: orderPayload.delivery_email,
        delivery_phone: orderPayload.delivery_phone,
      };
      const retry = await supabase
        .from("orders")
        .insert(legacyOrderPayload)
        .select("id")
        .single();

      order = retry.data;
      orderError = retry.error;
    }


    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || "Failed to create order." },
        { status: 500 }
      );
    }

    const orderItems = body.items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      unit_price: Number(item.base_price ?? item.price ?? 0) + Number(item.addon_price ?? 0),
      sugar_level: Number(item.sugar_level ?? 100),
      ice_level: item.ice_level ?? "regular",
      size: normalizeSize(item.size),
      temperature: item.temperature ?? "iced",
      addons: item.addons ?? [],
      special_instructions: item.special_instructions?.trim() || null,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);

      return NextResponse.json(
        { error: itemsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while creating the staff order.",
      },
      { status: 500 }
    );
  }
}

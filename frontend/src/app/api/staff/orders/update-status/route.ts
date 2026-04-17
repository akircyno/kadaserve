import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

function getNextStatus(
  orderType: "pickup" | "delivery",
  currentStatus: OrderStatus
): OrderStatus | null {
  if (orderType === "pickup") {
    switch (currentStatus) {
      case "pending":
        return "preparing";
      case "preparing":
        return "ready";
      case "ready":
        return "completed";
      default:
        return null;
    }
  }

  switch (currentStatus) {
    case "pending":
      return "preparing";
    case "preparing":
      return "ready";
    case "ready":
      return "out_for_delivery";
    case "out_for_delivery":
      return "delivered";
    default:
      return null;
  }
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["staff", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const orderId = body.orderId as string;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_type, status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    const nextStatus = getNextStatus(
      order.order_type,
      order.status as OrderStatus
    );

    if (!nextStatus) {
      return NextResponse.json(
        { error: "No next status available for this order." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      nextStatus,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while updating status." },
      { status: 500 }
    );
  }
}

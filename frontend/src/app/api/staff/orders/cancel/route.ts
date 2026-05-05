import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CancelOrderRequest = {
  orderId?: string;
};

const blockedStatuses = [
  "ready",
  "out_for_delivery",
  "completed",
  "delivered",
  "cancelled",
];

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
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    if (!profile || !["staff", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as CancelOrderRequest;
    const orderId = body.orderId?.trim();

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (blockedStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: "This order can no longer be cancelled once it is ready." },
        { status: 400 }
      );
    }

    const { count, error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled" }, { count: "exact" })
      .eq("id", orderId)
      .not("status", "in", `(${blockedStatuses.join(",")})`);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (count === 0) {
      return NextResponse.json(
        { error: "This order can no longer be cancelled once it is ready." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        status: "cancelled",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while cancelling the order.",
      },
      { status: 500 }
    );
  }
}

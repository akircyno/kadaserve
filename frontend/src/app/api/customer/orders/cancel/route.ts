import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CancelOrderRequest = {
  orderId?: string;
};

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

    if (!profile || profile.role !== "customer") {
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
      .select("id, status, customer_id")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending orders can be cancelled." },
        { status: 400 }
      );
    }

    const { count, error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled" }, { count: "exact" })
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .eq("status", "pending");

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (count === 0) {
      return NextResponse.json(
        { error: "This order can no longer be cancelled." },
        { status: 409 }
      );
    }

    return NextResponse.json({
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

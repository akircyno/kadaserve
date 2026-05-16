import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type CancelOrderRequest = {
  orderId?: string;
};

function getCancelBlockReason(order: {
  status: string;
  payment_method: string | null;
  payment_status: string | null;
}) {
  if (order.status === "pending_payment") {
    return order.payment_method === "online" && order.payment_status !== "paid"
      ? null
      : "Only unpaid online orders can be cancelled while awaiting payment.";
  }

  if (order.status === "pending") {
    return order.payment_status === "paid"
      ? "Paid orders can no longer be cancelled from the customer app."
      : null;
  }

  if (["cancelled", "expired", "completed", "delivered"].includes(order.status)) {
    return "This order is already closed.";
  }

  return "This order can no longer be cancelled because staff has started processing it.";
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

    const adminSupabase = createAdminClient();

    const { data: order, error: orderError } = await adminSupabase
      .from("orders")
      .select("id, status, customer_id, payment_method, payment_status")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    const cancelBlockReason = getCancelBlockReason(order);

    if (cancelBlockReason) {
      return NextResponse.json(
        { error: cancelBlockReason },
        { status: 400 }
      );
    }

    let updateQuery = adminSupabase
      .from("orders")
      .update({ status: "cancelled" }, { count: "exact" })
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .eq("status", order.status);

    updateQuery = order.payment_status
      ? updateQuery.eq("payment_status", order.payment_status)
      : updateQuery.is("payment_status", null);

    const { count, error: updateError } = await updateQuery;

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

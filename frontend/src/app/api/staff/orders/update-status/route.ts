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

type PaymentStatus = "unpaid" | "paid";

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

async function triggerDispatchNotification(
  orderId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const smtpWebhookUrl = process.env.SMTPJS_WEBHOOK_URL;

  if (!smtpWebhookUrl) {
    return;
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      `
        id,
        delivery_email,
        delivery_phone,
        walkin_name,
        order_items (
          quantity,
          menu_items (
            name
          )
        )
      `
    )
    .eq("id", orderId)
    .single();

  if (!order?.delivery_email) {
    return;
  }

  const orderSummary =
    order.order_items
      ?.map((item) => {
        const menuItem = Array.isArray(item.menu_items)
          ? item.menu_items[0]
          : item.menu_items;
        const name = menuItem?.name ?? "Menu item";
        return `${name} x ${item.quantity}`;
      })
      .join("\n") ?? "";

  try {
    await fetch(smtpWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: order.delivery_email,
        phone: order.delivery_phone,
        orderId: order.id,
        customerName: order.walkin_name,
        orderSummary,
        status: "out_for_delivery",
      }),
    });
  } catch {
    // Status transitions should not fail if the notification service is offline.
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
    const expectedStatus = body.expectedStatus as OrderStatus | undefined;
    const action = body.action as "advance" | "mark_paid" | undefined;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_type, status, payment_status")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (action === "mark_paid") {
      const { error: paymentError } = await supabase
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("id", orderId);

      if (paymentError) {
        return NextResponse.json(
          { error: paymentError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        paymentStatus: "paid",
      });
    }

    if (expectedStatus && order.status !== expectedStatus) {
      return NextResponse.json(
        {
          error:
            "This order already moved. Refreshing orders to show the latest status.",
          currentStatus: order.status,
        },
        { status: 409 }
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

    const paymentStatus = order.payment_status as PaymentStatus;

    if (
      paymentStatus !== "paid" &&
      (nextStatus === "completed" || nextStatus === "delivered")
    ) {
      return NextResponse.json(
        { error: "Mark this order as paid before closing it." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId)
      .eq("status", expectedStatus ?? order.status);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (nextStatus === "out_for_delivery") {
      await triggerDispatchNotification(orderId, supabase);
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

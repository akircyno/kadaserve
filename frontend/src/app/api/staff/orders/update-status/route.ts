import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPendingExpirySetupMessage } from "@/lib/orders/expire-pending-orders";

type OrderStatus =
  | "pending_payment"
  | "pending"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "expired"
  | "delivered"
  | "completed"
  | "cancelled";

type PaymentStatus = "unpaid" | "paid";

const pendingOrderTimeoutMinutes = 45;

function getNumberValue(value: unknown) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getPendingOrderAgeMinutes(orderedAt: string) {
  return Math.floor(
    Math.max(0, Date.now() - new Date(orderedAt).getTime()) / 60000
  );
}

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
    const expectedStatus = body.expectedStatus as OrderStatus | undefined;
    const action = body.action as "advance" | "mark_paid" | "expire" | undefined;
    const finalDeliveryFee = Number(body.finalDeliveryFee);

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_type, status, payment_status, total_amount, delivery_fee, ordered_at")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (action === "mark_paid") {
      const canMarkPaid = 
        (order.order_type === "delivery" && order.status === "out_for_delivery") ||
        (order.order_type === "pickup" && (order.status === "ready" || order.status === "preparing"));

      if (!canMarkPaid) {
        return NextResponse.json(
          { 
            error: order.order_type === "delivery" 
              ? "Payment can only be marked paid when the order is out for delivery."
              : "Payment can only be marked paid when the order is being prepared or is ready for pickup."
          },
          { status: 400 }
        );
      }

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
        receiptSent: false,
      });
    }

    if (action === "expire") {
      if (order.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending orders can be expired." },
          { status: 400 }
        );
      }

      if (
        getPendingOrderAgeMinutes(String(order.ordered_at)) <
        pendingOrderTimeoutMinutes
      ) {
        return NextResponse.json(
          { error: "Pending order has not reached the 45-minute expiry limit." },
          { status: 400 }
        );
      }

      const { error: expireError } = await supabase
        .from("orders")
        .update({ status: "expired" })
        .eq("id", orderId)
        .eq("status", expectedStatus ?? "pending");

      if (expireError) {
        return NextResponse.json(
          { error: getPendingExpirySetupMessage(expireError) ?? expireError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        nextStatus: "expired",
        notificationSent: false,
        receiptSent: false,
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
    const shouldSetFinalDeliveryFee =
      order.order_type === "delivery" &&
      nextStatus === "out_for_delivery" &&
      getNumberValue(order.delivery_fee) <= 0;

    if (shouldSetFinalDeliveryFee) {
      if (!Number.isFinite(finalDeliveryFee) || finalDeliveryFee <= 0) {
        return NextResponse.json(
          { error: "Enter the final delivery fee before dispatch." },
          { status: 400 }
        );
      }

      if (finalDeliveryFee > 999) {
        return NextResponse.json(
          { error: "Final delivery fee must be below \u20B11,000." },
          { status: 400 }
        );
      }
    }

    if (
      paymentStatus !== "paid" &&
      (nextStatus === "delivered" || nextStatus === "completed")
    ) {
      return NextResponse.json(
        { error: "Mark this order as paid before closing it." },
        { status: 400 }
      );
    }

    const updatePayload: {
      status: OrderStatus;
      delivery_fee?: number;
      total_amount?: number;
    } = { status: nextStatus };

    if (shouldSetFinalDeliveryFee) {
      const previousDeliveryFee = getNumberValue(order.delivery_fee);
      updatePayload.delivery_fee = Math.round(finalDeliveryFee);
      updatePayload.total_amount =
        getNumberValue(order.total_amount) - previousDeliveryFee + updatePayload.delivery_fee;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
      .eq("status", expectedStatus ?? order.status);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      nextStatus,
      notificationSent: ["preparing", "ready", "out_for_delivery"].includes(
        nextStatus
      ),
      receiptSent: nextStatus === "delivered",
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while updating status." },
      { status: 500 }
    );
  }
}

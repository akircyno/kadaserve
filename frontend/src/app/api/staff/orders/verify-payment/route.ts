import { NextResponse } from "next/server";
import {
  DEFAULT_PAYMENT_REJECTION_REASON,
  isAwaitingPaymentReview,
  normalizeRejectionReason,
} from "@/lib/payments/gcash-payment";
import { getPaymentSetupMessage } from "@/lib/payments/payment-proof-storage";
import { createClient } from "@/lib/supabase/server";

type VerifyPaymentRequest = {
  orderId?: unknown;
  decision?: unknown;
  reason?: unknown;
};

// Staff/admin approve or reject a customer's GCash payment screenshot.
// Approving moves the order into the normal queue (pending); rejecting asks the customer for new proof.
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

    const body = (await request.json()) as VerifyPaymentRequest;
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const decision = body.decision;

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json(
        { error: "Choose whether to approve or reject the payment." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, payment_method, payment_status, payment_proof_path")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json(
        { error: getPaymentSetupMessage(orderError) ?? orderError.message },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (!isAwaitingPaymentReview(order)) {
      return NextResponse.json(
        { error: "This payment is no longer waiting for verification." },
        { status: 409 }
      );
    }

    if (!order.payment_proof_path) {
      return NextResponse.json(
        { error: "No payment screenshot is attached to this order." },
        { status: 409 }
      );
    }

    const reviewedAt = new Date().toISOString();
    const update =
      decision === "approve"
        ? {
            status: "pending",
            payment_status: "paid",
            paid_at: reviewedAt,
            payment_verified_at: reviewedAt,
            payment_verified_by: user.id,
            payment_rejection_reason: null,
          }
        : {
            payment_status: "rejected",
            payment_verified_at: reviewedAt,
            payment_verified_by: user.id,
            payment_rejection_reason:
              normalizeRejectionReason(body.reason) ?? DEFAULT_PAYMENT_REJECTION_REASON,
          };

    // Only update if the order is still waiting, so two reviewers can't both decide it.
    const { data: updatedOrders, error: updateError } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId)
      .eq("status", "pending_payment")
      .eq("payment_status", "pending_verification")
      .select(
        "id, status, payment_status, paid_at, payment_verified_at, payment_verified_by, payment_rejection_reason"
      );

    if (updateError) {
      return NextResponse.json(
        { error: getPaymentSetupMessage(updateError) ?? updateError.message },
        { status: 500 }
      );
    }

    const updatedOrder = updatedOrders?.[0];

    if (!updatedOrder) {
      return NextResponse.json(
        { error: "This payment was already reviewed. Refresh to see the latest status." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while reviewing the payment." },
      { status: 500 }
    );
  }
}

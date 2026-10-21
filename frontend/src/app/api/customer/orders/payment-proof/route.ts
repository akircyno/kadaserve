import { NextResponse } from "next/server";
import { canReuploadPaymentProof } from "@/lib/payments/gcash-payment";
import {
  getPaymentSetupMessage,
  readPaymentProof,
  removePaymentProof,
  uploadPaymentProof,
} from "@/lib/payments/payment-proof-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Lets a customer replace a rejected GCash payment screenshot on the same order.
// The order goes back to pending verification; it is never marked paid here.
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
      .maybeSingle();

    if (!profile || profile.role !== "customer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const orderIdField = formData.get("orderId");
    const orderId = typeof orderIdField === "string" ? orderIdField : "";

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const { proof, error: proofError } = await readPaymentProof(formData.get("paymentProof"));

    if (!proof) {
      return NextResponse.json({ error: proofError }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: order, error: orderError } = await adminSupabase
      .from("orders")
      .select("id, customer_id, status, payment_method, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json(
        { error: getPaymentSetupMessage(orderError) ?? "Could not load the order." },
        { status: 500 }
      );
    }

    if (!order || order.customer_id !== user.id) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (!canReuploadPaymentProof(order)) {
      return NextResponse.json(
        { error: "A new screenshot can only be uploaded after a payment is rejected." },
        { status: 409 }
      );
    }

    const proofPath = await uploadPaymentProof(adminSupabase, {
      customerId: user.id,
      orderId,
      proof,
    });
    const submittedAt = new Date().toISOString();

    // The rejected screenshot stays in storage as a record of what was reviewed.
    const { data: updatedOrders, error: updateError } = await adminSupabase
      .from("orders")
      .update({
        payment_status: "pending_verification",
        payment_proof_path: proofPath,
        payment_submitted_at: submittedAt,
        payment_verified_at: null,
        payment_verified_by: null,
        payment_rejection_reason: null,
      })
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .eq("status", "pending_payment")
      .eq("payment_status", "rejected")
      .select("id, status, payment_status, payment_submitted_at");

    if (updateError || !updatedOrders?.[0]) {
      await removePaymentProof(adminSupabase, proofPath);

      return NextResponse.json(
        {
          error: updateError
            ? getPaymentSetupMessage(updateError) ?? "Your screenshot could not be saved."
            : "This order is no longer waiting for a new screenshot.",
        },
        { status: updateError ? 500 : 409 }
      );
    }

    return NextResponse.json({ success: true, order: updatedOrders[0] });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while uploading your screenshot." },
      { status: 500 }
    );
  }
}

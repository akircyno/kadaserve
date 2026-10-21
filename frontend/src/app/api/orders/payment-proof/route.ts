import { NextResponse } from "next/server";
import {
  createPaymentProofUrl,
  getPaymentSetupMessage,
} from "@/lib/payments/payment-proof-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const noStore = { "Cache-Control": "no-store" };

// Returns a short-lived link to an order's payment screenshot.
// Only the customer who placed the order, staff and admin can see it.
export async function GET(request: Request) {
  try {
    const orderId = new URL(request.url).searchParams.get("orderId") ?? "";

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400, headers: noStore });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const adminSupabase = createAdminClient();
    const { data: order, error: orderError } = await adminSupabase
      .from("orders")
      .select("id, customer_id, payment_proof_path")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json(
        { error: getPaymentSetupMessage(orderError) ?? "Could not load the order." },
        { status: 500, headers: noStore }
      );
    }

    const isReviewer = profile?.role === "staff" || profile?.role === "admin";
    const isOwner = Boolean(order && order.customer_id === user.id);

    // Same answer for "missing" and "not yours", so order IDs can't be probed.
    if (!order || (!isReviewer && !isOwner)) {
      return NextResponse.json({ error: "Payment screenshot not found." }, { status: 404, headers: noStore });
    }

    if (!order.payment_proof_path) {
      return NextResponse.json(
        { error: "No payment screenshot was uploaded for this order." },
        { status: 404, headers: noStore }
      );
    }

    const link = await createPaymentProofUrl(adminSupabase, order.payment_proof_path);

    return NextResponse.json(link, { headers: noStore });
  } catch {
    return NextResponse.json(
      { error: "Could not open the payment screenshot." },
      { status: 500, headers: noStore }
    );
  }
}

import type { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";

const pendingOrderTimeoutMinutes = 45;
const onlinePaymentTimeoutMinutes = 5;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type SupabaseOrderClient = SupabaseServerClient | SupabaseAdminClient;

export async function expireOverduePendingOrders(
  supabase: SupabaseOrderClient
) {
  const pendingExpiresBefore = new Date(
    Date.now() - pendingOrderTimeoutMinutes * 60 * 1000
  ).toISOString();
  const onlinePaymentExpiresBefore = new Date(
    Date.now() - onlinePaymentTimeoutMinutes * 60 * 1000
  ).toISOString();
  // A GCash order only enters the pending queue once staff verify its payment,
  // so its 45 minutes count from that verification instead of from ordering.
  const { data: expiredPendingOrders, error: pendingError } = await supabase
    .from("orders")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lte("ordered_at", pendingExpiresBefore)
    .or(`payment_verified_at.is.null,payment_verified_at.lte."${pendingExpiresBefore}"`)
    .select("id");

  if (pendingError) {
    return {
      expiredOrderIds: [],
      cancelledOnlineOrderIds: [],
      error: pendingError,
    };
  }

  // Online orders that never got a payment screenshot (e.g. older PayMongo checkouts left unpaid).
  // Orders pending verification or rejected are left for staff and the customer to resolve.
  const { data: oldOnlineOrders, error: oldOnlineError } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("status", "pending_payment")
    .eq("payment_method", "online")
    .eq("payment_status", "unpaid")
    .lte("ordered_at", onlinePaymentExpiresBefore)
    .select("id");

  if (oldOnlineError) {
    return {
      expiredOrderIds: expiredPendingOrders?.map((order) => String(order.id)) ?? [],
      cancelledOnlineOrderIds: [],
      error: oldOnlineError,
    };
  }

  return {
    expiredOrderIds: expiredPendingOrders?.map((order) => String(order.id)) ?? [],
    cancelledOnlineOrderIds:
      oldOnlineOrders?.map((order) => String(order.id)) ?? [],
    error: null,
  };
}

// Staff dashboard and API use the same rule: count from payment verification when there is one.
export function getPendingQueueStartedAt(order: {
  ordered_at: string;
  payment_verified_at?: string | null;
}) {
  return order.payment_verified_at ?? order.ordered_at;
}

export function getPendingExpirySetupMessage(error: { message?: string } | null) {
  if (!error?.message) {
    return null;
  }

  if (
    error.message.includes("orders_status_check") ||
    error.message.includes("violates check constraint")
  ) {
    return "Database status constraint does not allow expired orders yet. Apply backend/seed/order-status-expired.sql in Supabase SQL Editor, then refresh the staff dashboard.";
  }

  if (error.message.includes("payment_verified_at")) {
    return "GCash payment setup is incomplete. Apply backend/seed/gcash-payment-proof.sql in the Supabase SQL Editor.";
  }

  return null;
}

export { onlinePaymentTimeoutMinutes, pendingOrderTimeoutMinutes };

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
  const now = new Date().toISOString();

  const { data: expiredPendingOrders, error: pendingError } = await supabase
    .from("orders")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lte("ordered_at", pendingExpiresBefore)
    .select("id");

  if (pendingError) {
    return {
      expiredOrderIds: [],
      cancelledOnlineOrderIds: [],
      error: pendingError,
    };
  }

  const { data: expiredQrOrders, error: expiredQrError } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("status", "pending_payment")
    .eq("payment_method", "online")
    .eq("payment_status", "unpaid")
    .lte("paymongo_qr_expires_at", now)
    .select("id");

  if (expiredQrError) {
    return {
      expiredOrderIds: expiredPendingOrders?.map((order) => String(order.id)) ?? [],
      cancelledOnlineOrderIds: [],
      error: expiredQrError,
    };
  }

  const { data: oldOnlineOrders, error: oldOnlineError } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("status", "pending_payment")
    .eq("payment_method", "online")
    .eq("payment_status", "unpaid")
    .is("paymongo_qr_expires_at", null)
    .lte("ordered_at", onlinePaymentExpiresBefore)
    .select("id");

  if (oldOnlineError) {
    return {
      expiredOrderIds: expiredPendingOrders?.map((order) => String(order.id)) ?? [],
      cancelledOnlineOrderIds:
        expiredQrOrders?.map((order) => String(order.id)) ?? [],
      error: oldOnlineError,
    };
  }

  return {
    expiredOrderIds: expiredPendingOrders?.map((order) => String(order.id)) ?? [],
    cancelledOnlineOrderIds: [
      ...(expiredQrOrders?.map((order) => String(order.id)) ?? []),
      ...(oldOnlineOrders?.map((order) => String(order.id)) ?? []),
    ],
    error: null,
  };
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

  return null;
}

export { onlinePaymentTimeoutMinutes, pendingOrderTimeoutMinutes };

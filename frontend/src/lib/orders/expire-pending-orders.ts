import type { createClient } from "@/lib/supabase/server";

const pendingOrderTimeoutMinutes = 45;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function expireOverduePendingOrders(
  supabase: SupabaseServerClient
) {
  const expiresBefore = new Date(
    Date.now() - pendingOrderTimeoutMinutes * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("orders")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lte("ordered_at", expiresBefore)
    .select("id");

  return {
    expiredOrderIds: data?.map((order) => String(order.id)) ?? [],
    error,
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

export { pendingOrderTimeoutMinutes };

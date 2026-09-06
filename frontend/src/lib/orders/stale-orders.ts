import type { OrderStatus } from "@/types/orders";

/**
 * Orders paid but stuck past `pending` have no automatic expiry (unlike
 * pending/pending_payment, see expire-pending-orders.ts) because staff must
 * physically hand off the order. This threshold only drives a UI flag for
 * staff attention, it never changes order data.
 */
export const staleInProgressThresholdMinutes = 120;

const inProgressStatuses: OrderStatus[] = [
  "preparing",
  "ready",
  "out_for_delivery",
];

type StaleCheckOrder = {
  status: OrderStatus;
  ordered_at: string;
  updated_at?: string | null;
};

function getStaleReferenceTime(order: StaleCheckOrder) {
  return order.updated_at ?? order.ordered_at;
}

export function isOrderStale(order: StaleCheckOrder, now: Date) {
  if (!inProgressStatuses.includes(order.status)) {
    return false;
  }

  const elapsedMinutes =
    (now.getTime() - new Date(getStaleReferenceTime(order)).getTime()) / 60000;

  return elapsedMinutes >= staleInProgressThresholdMinutes;
}

export function getStaleOrderLabel(order: StaleCheckOrder, now: Date) {
  if (!isOrderStale(order, now)) {
    return null;
  }

  const elapsedMs = now.getTime() - new Date(getStaleReferenceTime(order)).getTime();
  const hours = Math.floor(elapsedMs / 3600000);
  const duration = hours >= 24 ? `${Math.floor(hours / 24)}d` : `${Math.max(1, hours)}h`;

  return `Needs attention — stuck ${duration}`;
}

/**
 * Orders that reach "ready" and sit unclaimed (no pickup/dispatch) past this
 * threshold are auto-cancelled so they don't pile up on the board forever.
 * Only "ready" orders are affected — "preparing" and "out_for_delivery" are
 * left alone since staff are actively handling those.
 */
export const readyOrderAutoCancelThresholdMinutes = 45;

export function isReadyOrderStuck(order: StaleCheckOrder, now: Date) {
  if (order.status !== "ready") {
    return false;
  }

  const elapsedMinutes =
    (now.getTime() - new Date(getStaleReferenceTime(order)).getTime()) / 60000;

  return elapsedMinutes >= readyOrderAutoCancelThresholdMinutes;
}

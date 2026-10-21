"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, ImageOff, X } from "lucide-react";
import {
  PAYMENT_REJECTION_REASON_MAX_LENGTH,
  formatPaymentStatusLabel,
  isAwaitingPaymentReview,
} from "@/lib/payments/gcash-payment";
import type { StaffOrder } from "@/types/orders";

export type PaymentReviewUpdate = Pick<
  StaffOrder,
  "status" | "payment_status" | "payment_verified_at" | "payment_rejection_reason" | "payment_verified_by_name"
>;

function peso(value: number) {
  return `₱${Number(value).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusStyle(status: StaffOrder["payment_status"]) {
  switch (status) {
    case "paid":
      return "border-[#0F441D]/20 bg-[#E6F2E8] text-[#0F441D]";
    case "rejected":
      return "border-[#C55432]/20 bg-[#FFF1EC] text-[#C55432]";
    default:
      return "border-[#B76522]/30 bg-[#FFF0DA] text-[#684B35]";
  }
}

// Staff/admin panel for a GCash QR order: the screenshot, the amount to look for,
// and Approve / Reject. Approving requires confirming the money actually arrived.
// Render with key={order.id} so its state resets per order.
export function PaymentProofReview({
  order,
  onReviewed,
}: {
  order: StaffOrder;
  onReviewed: (update: PaymentReviewUpdate, decision: "approve" | "reject") => void;
}) {
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofError, setProofError] = useState("");
  const [hasConfirmedPayment, setHasConfirmedPayment] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const isAwaitingReview = isAwaitingPaymentReview(order);

  useEffect(() => {
    if (!order.has_payment_proof) {
      return;
    }

    let isCancelled = false;

    const loadProof = async () => {
      try {
        const response = await fetch(
          `/api/orders/payment-proof?orderId=${encodeURIComponent(order.id)}`,
          { cache: "no-store" }
        );
        const result = (await response.json()) as { url?: string; error?: string };

        if (isCancelled) return;

        if (!response.ok || !result.url) {
          setProofUrl(null);
          setProofError(result.error || "Could not load the screenshot.");
          return;
        }

        setProofUrl(result.url);
        setProofError("");
      } catch {
        if (!isCancelled) setProofError("Could not load the screenshot.");
      }
    };

    void loadProof();

    return () => {
      isCancelled = true;
    };
  }, [order.id, order.has_payment_proof, order.payment_submitted_at]);

  async function submitReview(decision: "approve" | "reject") {
    setSubmitting(decision);
    setError("");

    try {
      const response = await fetch("/api/staff/orders/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          decision,
          reason: decision === "reject" ? rejectionReason : undefined,
        }),
      });
      const result = (await response.json()) as {
        order?: {
          status: StaffOrder["status"];
          payment_status: StaffOrder["payment_status"];
          payment_verified_at: string | null;
          payment_rejection_reason: string | null;
        };
        error?: string;
      };

      if (!response.ok || !result.order) {
        setError(result.error || "Could not update this payment.");
        return;
      }

      onReviewed(
        {
          status: result.order.status,
          payment_status: result.order.payment_status,
          payment_verified_at: result.order.payment_verified_at,
          payment_rejection_reason: result.order.payment_rejection_reason,
          payment_verified_by_name: "You",
        },
        decision
      );
      setIsRejecting(false);
      setHasConfirmedPayment(false);
    } catch {
      setError("Could not update this payment. Check your connection and try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <section className="rounded-[14px] border border-[#DCCFB8] bg-white p-4 font-sans">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8C6C48]">
            GCash QR payment
          </p>
          <p className="mt-1 text-2xl font-black tabular-nums text-[#0D2E18]">
            {peso(order.total_amount)}
          </p>
          {order.payment_submitted_at ? (
            <p className="mt-0.5 text-xs font-semibold text-[#8C7A64]">
              Screenshot sent {formatDateTime(order.payment_submitted_at)}
            </p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.68rem] font-black ${getStatusStyle(
            order.payment_status
          )}`}
        >
          {formatPaymentStatusLabel(order.payment_status)}
        </span>
      </div>

      <div className="mt-3">
        {order.has_payment_proof && proofUrl ? (
          <a
            href={proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-[12px] border border-[#EFE3CF] bg-[#FFF8EF]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proofUrl}
              alt={`Payment screenshot for order ${order.id.slice(0, 8)}`}
              className="max-h-80 w-full object-contain"
            />
            <span className="flex items-center justify-center gap-1.5 border-t border-[#EFE3CF] py-2 text-xs font-bold text-[#684B35] group-hover:text-[#0D2E18]">
              <ExternalLink size={13} />
              Open full size
            </span>
          </a>
        ) : (
          <div className="flex items-center gap-2 rounded-[12px] border border-dashed border-[#DCCFB8] bg-[#FFF8EF] px-3 py-4 text-xs font-semibold text-[#8C7A64]">
            <ImageOff size={15} />
            {order.has_payment_proof
              ? proofError || "Loading screenshot..."
              : "No screenshot has been uploaded."}
          </div>
        )}
      </div>

      {isAwaitingReview ? (
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2.5 rounded-[12px] bg-[#FFF8EF] p-3 text-xs font-semibold leading-5 text-[#684B35]">
            <input
              type="checkbox"
              checked={hasConfirmedPayment}
              onChange={(event) => setHasConfirmedPayment(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#0D2E18]"
            />
            I checked the GCash account and {peso(order.total_amount)} from this order was received.
            The screenshot alone is not proof of payment.
          </label>

          {isRejecting ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#684B35]" htmlFor={`reject-reason-${order.id}`}>
                Reason shown to the customer (optional)
              </label>
              <textarea
                id={`reject-reason-${order.id}`}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                maxLength={PAYMENT_REJECTION_REASON_MAX_LENGTH}
                rows={2}
                placeholder="e.g. Amount does not match, or no matching transaction found."
                className="w-full rounded-[10px] border border-[#DCCFB8] bg-white px-3 py-2 text-sm text-[#0D2E18] outline-none focus:border-[#0D2E18]"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsRejecting(false)}
                  disabled={submitting !== null}
                  className="h-10 rounded-full border border-[#DCCFB8] bg-white text-sm font-bold text-[#684B35] transition hover:bg-[#FFF8EF] disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void submitReview("reject")}
                  disabled={submitting !== null}
                  className="h-10 rounded-full bg-[#9C543D] text-sm font-bold text-white transition hover:bg-[#8A4632] disabled:opacity-60"
                >
                  {submitting === "reject" ? "Rejecting..." : "Confirm Reject"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setIsRejecting(true);
                }}
                disabled={submitting !== null}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#C55432]/30 bg-[#FFF1EC] text-sm font-bold text-[#9C543D] transition hover:bg-white disabled:opacity-60"
              >
                <X size={15} />
                Reject
              </button>
              <button
                type="button"
                onClick={() => void submitReview("approve")}
                disabled={!hasConfirmedPayment || !order.has_payment_proof || submitting !== null}
                title={hasConfirmedPayment ? undefined : "Confirm the payment arrived in GCash first"}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#0D2E18] text-sm font-bold text-white transition hover:bg-[#0F441D] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size={15} />
                {submitting === "approve" ? "Approving..." : "Approve"}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {order.payment_status === "rejected" ? (
        <p className="mt-3 rounded-[12px] bg-[#FFF1EC] p-3 text-xs font-semibold leading-5 text-[#9C543D]">
          Rejected{order.payment_verified_by_name ? ` by ${order.payment_verified_by_name}` : ""}
          {order.payment_verified_at ? ` on ${formatDateTime(order.payment_verified_at)}` : ""}.{" "}
          {order.payment_rejection_reason ? `Reason: ${order.payment_rejection_reason} ` : ""}
          Waiting for the customer to upload a new screenshot.
        </p>
      ) : null}

      {order.payment_status === "paid" && order.payment_verified_at ? (
        <p className="mt-3 rounded-[12px] bg-[#E6F2E8] p-3 text-xs font-semibold leading-5 text-[#0F441D]">
          Verified{order.payment_verified_by_name ? ` by ${order.payment_verified_by_name}` : ""} on{" "}
          {formatDateTime(order.payment_verified_at)}.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-[12px] bg-[#FFF1EC] p-3 text-xs font-semibold text-[#9C543D]">
          {error}
        </p>
      ) : null}
    </section>
  );
}

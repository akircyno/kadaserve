// GCash QR payments: the static QR details, payment proof rules and status helpers.
// Kept free of imports so scripts/verify-gcash-payment.mjs can load it directly.

export const GCASH_QR_IMAGE_PATH = "/payments/gcash-qr.webp";
// Shown exactly as the GCash QR card masks it, so customers can match it in their app.
export const GCASH_RECIPIENT_NAME = "JO*N AN****Y V.";

export const PAYMENT_PROOF_BUCKET = "payment-proofs";
// Stays under Vercel's 4.5 MB request body limit.
export const PAYMENT_PROOF_MAX_BYTES = 4 * 1024 * 1024;
export const PAYMENT_PROOF_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const PAYMENT_PROOF_ACCEPT = "image/jpeg,image/png,.jpg,.jpeg,.png";
export const PAYMENT_REJECTION_REASON_MAX_LENGTH = 200;
export const DEFAULT_PAYMENT_REJECTION_REASON =
  "We could not confirm this payment. Please upload a clear screenshot of the successful GCash transaction.";

export type PaymentProofMimeType = (typeof PAYMENT_PROOF_MIME_TYPES)[number];
export type PaymentStatusValue = "unpaid" | "paid" | "pending_verification" | "rejected";

type PaymentOrderLike = {
  status: string;
  payment_method?: string | null;
  payment_status?: string | null;
};

function isAllowedMimeType(type: string): type is PaymentProofMimeType {
  return (PAYMENT_PROOF_MIME_TYPES as readonly string[]).includes(type);
}

// Checks the declared type and size. The server also checks the file's actual bytes.
export function getPaymentProofError(file: { type: string; size: number } | null) {
  if (!file) {
    return "Upload a screenshot of your successful GCash payment.";
  }

  if (!isAllowedMimeType(file.type)) {
    return "Upload a JPG or PNG screenshot.";
  }

  if (file.size === 0) {
    return "That screenshot is empty. Choose another image.";
  }

  if (file.size > PAYMENT_PROOF_MAX_BYTES) {
    return "Screenshot must be 4 MB or smaller.";
  }

  return null;
}

// Identifies JPG and PNG files by their first bytes, whatever the file claims to be.
export function detectPaymentProofType(bytes: Uint8Array): PaymentProofMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= pngSignature.length && pngSignature.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }

  return null;
}

export function getPaymentProofExtension(type: PaymentProofMimeType) {
  return type === "image/png" ? "png" : "jpg";
}

export function buildPaymentProofPath(
  customerId: string,
  orderId: string,
  type: PaymentProofMimeType,
  timestamp = Date.now()
) {
  return `${customerId}/${orderId}/${timestamp}.${getPaymentProofExtension(type)}`;
}

export function normalizeRejectionReason(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const reason = value.trim().replace(/\s+/g, " ").slice(0, PAYMENT_REJECTION_REASON_MAX_LENGTH);
  return reason || null;
}

export function formatPaymentStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending_verification":
      return "Pending Verification";
    case "rejected":
      return "Rejected";
    case "unpaid":
      return "Unpaid";
    default:
      return "No status";
  }
}

export function isAwaitingPaymentReview(order: PaymentOrderLike) {
  return (
    order.payment_method === "online" &&
    order.status === "pending_payment" &&
    order.payment_status === "pending_verification"
  );
}

export function canReuploadPaymentProof(order: PaymentOrderLike) {
  return (
    order.payment_method === "online" &&
    order.status === "pending_payment" &&
    order.payment_status === "rejected"
  );
}

// Customers may cancel before paying or after a rejected proof, but not while
// staff are checking a payment they say they made, and never once it is paid.
export function canCustomerCancelPayment(order: PaymentOrderLike) {
  if (order.payment_status === "paid" || order.payment_status === "pending_verification") {
    return false;
  }

  return order.status === "pending" || order.status === "pending_payment";
}

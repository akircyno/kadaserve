import type { createAdminClient } from "@/lib/supabase/admin";
import {
  PAYMENT_PROOF_BUCKET,
  PAYMENT_PROOF_MAX_BYTES,
  PAYMENT_PROOF_MIME_TYPES,
  buildPaymentProofPath,
  detectPaymentProofType,
  getPaymentProofError,
  type PaymentProofMimeType,
} from "@/lib/payments/gcash-payment";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

export type PaymentProofUpload = {
  bytes: Uint8Array;
  contentType: PaymentProofMimeType;
};

const signedUrlSeconds = 5 * 60;

// Validates an uploaded screenshot by its declared type, size and actual content.
export async function readPaymentProof(
  value: FormDataEntryValue | null
): Promise<{ proof: PaymentProofUpload; error: null } | { proof: null; error: string }> {
  if (!(value instanceof File)) {
    return { proof: null, error: "Upload a screenshot of your successful GCash payment." };
  }

  const declaredError = getPaymentProofError(value);
  if (declaredError) {
    return { proof: null, error: declaredError };
  }

  const bytes = new Uint8Array(await value.arrayBuffer());
  const contentType = detectPaymentProofType(bytes);

  if (!contentType) {
    return { proof: null, error: "That file is not a valid JPG or PNG image." };
  }

  return { proof: { bytes, contentType }, error: null };
}

// The bucket is normally created by backend/seed/gcash-payment-proof.sql; this covers a missing one.
async function ensurePaymentProofBucket(supabase: SupabaseAdminClient) {
  const { error } = await supabase.storage.getBucket(PAYMENT_PROOF_BUCKET);

  if (!error) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(PAYMENT_PROOF_BUCKET, {
    public: false,
    fileSizeLimit: PAYMENT_PROOF_MAX_BYTES,
    allowedMimeTypes: [...PAYMENT_PROOF_MIME_TYPES],
  });

  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw createError;
  }
}

export async function uploadPaymentProof(
  supabase: SupabaseAdminClient,
  { customerId, orderId, proof }: { customerId: string; orderId: string; proof: PaymentProofUpload }
) {
  await ensurePaymentProofBucket(supabase);

  const path = buildPaymentProofPath(customerId, orderId, proof.contentType);
  const { error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).upload(path, proof.bytes, {
    contentType: proof.contentType,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return path;
}

export async function removePaymentProof(supabase: SupabaseAdminClient, path: string) {
  await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
}

export async function createPaymentProofUrl(supabase: SupabaseAdminClient, path: string) {
  const { data, error } = await supabase.storage
    .from(PAYMENT_PROOF_BUCKET)
    .createSignedUrl(path, signedUrlSeconds);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Could not create a link to the payment screenshot.");
  }

  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + signedUrlSeconds * 1000).toISOString(),
  };
}

// Points to the SQL file when the payment columns or statuses are not in the database yet.
export function getPaymentSetupMessage(error: { message?: string } | null) {
  const message = error?.message ?? "";

  if (
    message.includes("payment_proof_path") ||
    message.includes("payment_submitted_at") ||
    message.includes("payment_verified") ||
    message.includes("payment_rejection_reason") ||
    message.includes("has_payment_proof") ||
    message.includes("orders_payment_status_check")
  ) {
    return "GCash payment setup is incomplete. Apply backend/seed/gcash-payment-proof.sql in the Supabase SQL Editor.";
  }

  return null;
}

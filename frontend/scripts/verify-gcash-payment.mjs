import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

async function importDataUrlModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const transpiled = transpile(source);
  const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled)}`;
  return import(moduleUrl);
}

console.log("Testing gcash-payment.ts...");

const {
  PAYMENT_PROOF_MAX_BYTES,
  buildPaymentProofPath,
  canCustomerCancelPayment,
  canReuploadPaymentProof,
  detectPaymentProofType,
  formatPaymentStatusLabel,
  getPaymentProofError,
  isAwaitingPaymentReview,
  normalizeRejectionReason,
} = await importDataUrlModule("../src/lib/payments/gcash-payment.ts");

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

// File content decides the type, not the file name or declared type.
{
  assert.equal(detectPaymentProofType(pngBytes), "image/png");
  assert.equal(detectPaymentProofType(jpgBytes), "image/jpeg");
  assert.equal(detectPaymentProofType(gifBytes), null);
  assert.equal(detectPaymentProofType(webpBytes), null);
  assert.equal(detectPaymentProofType(new Uint8Array([0x89, 0x50])), null);
  console.log("  PASS: only real JPG and PNG bytes are accepted");
}

// Declared type and size limits (checked in the browser and on the server).
{
  assert.equal(getPaymentProofError({ type: "image/png", size: 1024 }), null);
  assert.equal(getPaymentProofError({ type: "image/jpeg", size: PAYMENT_PROOF_MAX_BYTES }), null);
  assert.match(getPaymentProofError({ type: "image/png", size: PAYMENT_PROOF_MAX_BYTES + 1 }), /4 MB/);
  assert.match(getPaymentProofError({ type: "image/webp", size: 1024 }), /JPG or PNG/);
  assert.match(getPaymentProofError({ type: "application/pdf", size: 1024 }), /JPG or PNG/);
  assert.match(getPaymentProofError({ type: "image/png", size: 0 }), /empty/);
  assert.match(getPaymentProofError(null), /Upload/);
  console.log("  PASS: type and 4 MB size limits are enforced");
}

// Storage paths are grouped by customer and order, with the detected extension.
{
  assert.equal(
    buildPaymentProofPath("customer-1", "order-1", "image/png", 1700000000000),
    "customer-1/order-1/1700000000000.png"
  );
  assert.equal(
    buildPaymentProofPath("customer-1", "order-1", "image/jpeg", 5),
    "customer-1/order-1/5.jpg"
  );
  console.log("  PASS: proof paths are customer/order scoped");
}

// Review and re-upload only apply to GCash QR orders in the right state.
{
  const awaiting = { status: "pending_payment", payment_method: "online", payment_status: "pending_verification" };
  const rejected = { status: "pending_payment", payment_method: "online", payment_status: "rejected" };
  const paid = { status: "pending", payment_method: "online", payment_status: "paid" };
  const cash = { status: "pending", payment_method: "cash", payment_status: "unpaid" };

  assert.equal(isAwaitingPaymentReview(awaiting), true);
  assert.equal(isAwaitingPaymentReview(rejected), false);
  assert.equal(isAwaitingPaymentReview(paid), false);
  assert.equal(isAwaitingPaymentReview(cash), false);
  assert.equal(isAwaitingPaymentReview({ ...awaiting, payment_method: "gcash" }), false);

  assert.equal(canReuploadPaymentProof(rejected), true);
  assert.equal(canReuploadPaymentProof(awaiting), false);
  assert.equal(canReuploadPaymentProof(paid), false);
  assert.equal(canReuploadPaymentProof({ ...rejected, status: "cancelled" }), false);
  console.log("  PASS: approve/reject and re-upload are limited to the right states");
}

// Customers cannot cancel while a payment is being checked or after it is paid.
{
  assert.equal(canCustomerCancelPayment({ status: "pending_payment", payment_method: "online", payment_status: "pending_verification" }), false);
  assert.equal(canCustomerCancelPayment({ status: "pending_payment", payment_method: "online", payment_status: "rejected" }), true);
  assert.equal(canCustomerCancelPayment({ status: "pending", payment_method: "online", payment_status: "paid" }), false);
  assert.equal(canCustomerCancelPayment({ status: "pending", payment_method: "cash", payment_status: "unpaid" }), true);
  assert.equal(canCustomerCancelPayment({ status: "preparing", payment_method: "cash", payment_status: "unpaid" }), false);
  console.log("  PASS: customer cancellation follows the payment state");
}

// Labels and rejection reasons.
{
  assert.equal(formatPaymentStatusLabel("pending_verification"), "Pending Verification");
  assert.equal(formatPaymentStatusLabel("rejected"), "Rejected");
  assert.equal(formatPaymentStatusLabel("paid"), "Paid");
  assert.equal(normalizeRejectionReason("   Amount   does not match  "), "Amount does not match");
  assert.equal(normalizeRejectionReason("   "), null);
  assert.equal(normalizeRejectionReason(42), null);
  assert.equal(normalizeRejectionReason("x".repeat(500)).length, 200);
  console.log("  PASS: status labels and rejection reasons are normalized");
}

console.log("\nAll gcash-payment.ts checks passed.");

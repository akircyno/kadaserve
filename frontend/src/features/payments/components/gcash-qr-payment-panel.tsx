"use client";

import { Download } from "lucide-react";
import { PaymentProofPicker } from "@/features/payments/components/payment-proof-picker";
import { GCASH_QR_IMAGE_PATH, GCASH_RECIPIENT_NAME } from "@/lib/payments/gcash-payment";

// Checkout panel for Online Payment (GCash QR): the static QR, who to pay, how much,
// and the screenshot upload that Place Order requires.
export function GcashQrPaymentPanel({
  amountLabel,
  proof,
  onProofChange,
  disabled = false,
}: {
  amountLabel: string;
  proof: File | null;
  onProofChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-3 rounded-[20px] border border-[#D8C8A7] bg-[#FFF8EF] p-4 font-sans">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#684B35]">
          Amount to pay
        </p>
        <p className="text-2xl font-black tabular-nums text-[#0D2E18]">{amountLabel}</p>
      </div>

      <div className="mx-auto mt-3 w-full max-w-[300px]">
        {/* The QR is served exactly as provided (no resizing or re-encoding) so it stays scannable. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={GCASH_QR_IMAGE_PATH}
          alt={`GCash QR code for ${GCASH_RECIPIENT_NAME}`}
          width={1254}
          height={1254}
          className="aspect-square w-full rounded-[16px] border border-[#D8C8A7] bg-white object-contain"
        />
        <a
          href={GCASH_QR_IMAGE_PATH}
          download="kadaserve-gcash-qr.webp"
          className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#D8C8A7] bg-white text-sm font-bold text-[#0D2E18] transition hover:border-[#0D2E18]/40"
        >
          <Download size={15} />
          Save QR image
        </a>
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-semibold text-[#8A755D]">Recipient</dt>
        <dd className="font-black text-[#0D2E18]">{GCASH_RECIPIENT_NAME}</dd>
        <dt className="font-semibold text-[#8A755D]">Amount</dt>
        <dd className="font-black tabular-nums text-[#0D2E18]">{amountLabel}</dd>
      </dl>

      <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs font-semibold leading-5 text-[#684B35]">
        <li>Scan or save this QR in GCash (or a banking app that supports InstaPay QR).</li>
        <li>
          Pay exactly {amountLabel} to {GCASH_RECIPIENT_NAME}.
        </li>
        <li>Take a screenshot of the successful transaction and upload it below.</li>
      </ol>

      <div className="mt-4">
        <PaymentProofPicker file={proof} onChange={onProofChange} disabled={disabled} />
      </div>

      <p className="mt-3 rounded-[14px] bg-white/70 px-3 py-2 text-xs font-semibold leading-5 text-[#684B35]">
        Your order is placed right away as <span className="font-black">Pending Verification</span>.
        Staff confirm the payment in GCash before preparing it.
      </p>
    </div>
  );
}

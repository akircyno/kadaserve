"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageUp, RefreshCw, Trash2 } from "lucide-react";
import { PAYMENT_PROOF_ACCEPT, getPaymentProofError } from "@/lib/payments/gcash-payment";

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Picks a JPG/PNG payment screenshot with a preview, and lets the customer replace or remove it.
export function PaymentProofPicker({
  file,
  onChange,
  disabled = false,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleFiles(files: FileList | null) {
    const nextFile = files?.[0] ?? null;

    // Clear the input so choosing the same file again still triggers a change.
    if (inputRef.current) inputRef.current.value = "";
    if (!nextFile) return;

    const message = getPaymentProofError(nextFile);
    if (message) {
      setError(message);
      return;
    }

    setError("");
    onChange(nextFile);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={PAYMENT_PROOF_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(event) => handleFiles(event.target.files)}
      />

      {file && previewUrl ? (
        <div className="rounded-[16px] border border-[#D8C8A7] bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Your GCash payment screenshot"
            className="max-h-72 w-full rounded-[12px] bg-[#FFF8EF] object-contain"
          />
          <p className="mt-2 truncate font-sans text-xs font-semibold text-[#8A755D]">
            {file.name} · {formatFileSize(file.size)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#D8C8A7] bg-[#FFF8EF] font-sans text-sm font-bold text-[#0D2E18] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={15} />
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                onChange(null);
              }}
              disabled={disabled}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#F2C8BD] bg-[#FFF1EC] font-sans text-sm font-bold text-[#9C543D] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={15} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="flex w-full flex-col items-center gap-1.5 rounded-[16px] border-2 border-dashed border-[#D8C8A7] bg-white/80 px-4 py-6 text-center font-sans transition hover:border-[#0D2E18]/40 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ImageUp className="h-6 w-6 text-[#684B35]" />
          <span className="text-sm font-black text-[#0D2E18]">Upload payment screenshot</span>
          <span className="text-xs font-semibold text-[#8A755D]">JPG or PNG, up to 4 MB</span>
        </button>
      )}

      {error ? (
        <p role="alert" className="mt-2 font-sans text-xs font-semibold text-[#9C543D]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

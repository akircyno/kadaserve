"use client";

import Image from "next/image";
import { FormEvent, useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";

const LOGO_SRC = "/images/logo/logo.png";

export default function VerifyCodePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const email = searchParams.get("email") || "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    setError("");
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Verify the code against the password_resets table
      const response = await fetch("/api/verify-reset-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code: fullCode }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Invalid or expired code. Please try again.");
        return;
      }

      setSuccessMessage("Code verified! Redirecting to reset password...");
      setTimeout(() => {
        router.push(
          `/reset-password?email=${encodeURIComponent(email)}&code=${fullCode}&step=new_password`
        );
      }, 1500);
    } catch {
      setError("Unable to verify code right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!canResend || !email) return;

    setIsResending(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to resend code. Please try again later.");
        return;
      }

      setSuccessMessage("Verification code sent to your email!");
      setCanResend(false);
      setResendTimer(60);
    } catch {
      setError("Unable to resend code right now.");
    } finally {
      setIsResending(false);
    }
  }

  async function handleBackToSignIn() {
    await supabase.auth.signOut();
    await fetch("/api/logout", {
      method: "POST",
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,68,29,0.18),_transparent_32%),linear-gradient(180deg,_#FFF0DA_0%,_#FFF8EF_52%,_#0F441D_100%)] px-4 py-6 lg:flex lg:items-center lg:justify-center lg:px-8">
      <button
        type="button"
        onClick={handleBackToSignIn}
        className="fixed left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-[#DCCFB8] bg-white/85 px-4 py-2 font-sans text-sm font-bold text-[#0D2E18] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Sign in
      </button>

      <section className="mx-auto w-full max-w-[34rem] rounded-[2rem] bg-[#FFF8EF] px-6 py-8 shadow-[0_18px_44px_rgba(13,46,24,0.18)] sm:px-9 sm:py-10">
        <div className="mb-7 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#0D2E18]">
            <Image
              src={LOGO_SRC}
              alt="KadaServe logo"
              width={56}
              height={56}
              className="h-full w-full object-cover"
            />
          </div>

          <div>
            <p className="font-sans text-sm font-bold uppercase tracking-[0.16em] text-[#684B35]">
              Account Recovery
            </p>
            <h1 className="font-sans text-4xl font-semibold text-[#0D2E18]">
              Verify Code
            </h1>
          </div>
        </div>

        <div className="mb-7">
          <p className="font-sans text-base leading-7 text-[#684B35]">
            We&apos;ve sent a 6-digit code to <strong>{email}</strong>. Please enter
            it below to proceed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-4 block font-sans text-sm font-bold uppercase tracking-[0.08em] text-[#0F441D]">
              Verification Code
            </label>

            <div className="flex gap-3 justify-between">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  placeholder="0"
                  className="h-16 w-14 rounded-xl border-2 border-[#BFD1B5] bg-white text-center font-sans text-2xl font-bold text-[#0D2E18] outline-none transition placeholder:text-[#CDB898] focus:border-[#0F441D] focus:ring-2 focus:ring-[#0F441D]/15"
                />
              ))}
            </div>
          </div>

          {error ? (
            <p className="flex items-center gap-2 rounded-xl bg-[#FFF1EC] px-4 py-3 font-sans text-sm font-medium text-[#9C543D]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          {successMessage ? (
            <p className="flex items-center gap-2 rounded-xl bg-[#E7F4EA] px-4 py-3 font-sans text-sm font-medium text-[#0F7A40]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={code.some((digit) => !digit) || isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F441D] py-3 font-sans text-lg font-bold text-white shadow-lg shadow-[#0F441D]/15 transition hover:-translate-y-0.5 hover:bg-[#0D2E18] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isSubmitting ? "Verifying..." : "Verify Code"}
          </button>
        </form>

        <div className="mt-6 border-t border-[#DCCFB8] pt-6">
          <p className="mb-3 text-center font-sans text-sm text-[#684B35]">
            Didn&apos;t receive the code?
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={!canResend || isResending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0F441D] bg-white py-3 font-sans text-lg font-bold text-[#0F441D] transition hover:-translate-y-0.5 hover:bg-[#FFF8EF] disabled:cursor-not-allowed disabled:border-[#CDB898] disabled:text-[#CDB898] disabled:hover:translate-y-0"
          >
            {isResending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {isResending
              ? "Sending..."
              : canResend
                ? "Resend Code"
                : `Resend in ${resendTimer}s`}
          </button>
        </div>
      </section>
    </main>
  );
}

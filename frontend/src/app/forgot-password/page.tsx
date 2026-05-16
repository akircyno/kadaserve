"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Mail,
  Send,
} from "lucide-react";

const LOGO_SRC = "/images/logo/logo.png";

const emailPattern =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const emailInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const isEmailValid = emailPattern.test(normalizedEmail);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isEmailValid || isSubmitting) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to send reset instructions.");
        return;
      }

      setSuccessMessage(
        "We sent a 6-digit reset code to your email. Please check your inbox."
      );
      
      // Redirect to verify-code page after a few seconds
      setTimeout(() => {
        router.push(`/verify-code?email=${encodeURIComponent(normalizedEmail)}`);
      }, 3000);
    } catch {
      setError("Unable to send reset instructions right now.");
    } finally {
      setIsSubmitting(false);
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
              KadaServe
            </h1>
          </div>
        </div>

        <div className="mb-7">
          <h2 className="font-sans text-4xl font-bold tracking-tight text-[#0D2E18]">
            Reset your password
          </h2>
          <p className="mt-2 font-sans text-base leading-7 text-[#684B35]">
            Enter your account email and we’ll send a secure link to create a
            new password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block font-sans text-sm font-bold uppercase tracking-[0.08em] text-[#0F441D]"
            >
              Email Address
            </label>

            <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-3 transition focus-within:border-[#0F441D] focus-within:ring-2 focus-within:ring-[#0F441D]/15">
              <Mail className="mr-3 text-[#8C7A64]" size={18} />
              <input
                ref={emailInputRef}
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value.toLowerCase());
                  setError("");
                  setSuccessMessage("");
                }}
                onBlur={() =>
                  setEmail((currentEmail) => currentEmail.trim().toLowerCase())
                }
                placeholder="you@example.com"
                className="min-w-0 flex-1 bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74] autofill:shadow-[inset_0_0_0px_1000px_#FFFFFF] autofill:[-webkit-text-fill-color:#0D2E18]"
                required
              />

              <span className="ml-3 flex h-4 w-4 shrink-0 items-center justify-center">
                {isEmailValid ? (
                  <CheckCircle2 className="h-4 w-4 text-[#0F7A40]" />
                ) : null}
              </span>
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
            disabled={!isEmailValid || isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F441D] py-3 font-sans text-lg font-bold text-white shadow-lg shadow-[#0F441D]/15 transition hover:-translate-y-0.5 hover:bg-[#0D2E18] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
        </form>
      </section>
    </main>
  );
}

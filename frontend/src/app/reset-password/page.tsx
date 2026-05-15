"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const LOGO_SRC = "/images/logo/logo.png";

function getPasswordChecks(password: string) {
  return {
    length: password.length >= 8,
    number: /\d/.test(password),
    uppercase: /[A-Z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState<"verify_code" | "new_password">("verify_code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const passwordChecks = getPasswordChecks(password);
  const isPasswordStrong = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    
    if (code.length !== 6) {
      setError("Please enter the 6-digit reset code.");
      return;
    }

    if (!email) {
      setError("Email is missing. Please try requesting a code again.");
      return;
    }

    // We proceed to password entry step
    setStep("new_password");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isPasswordStrong || !passwordsMatch) {
      setError("Please complete the password requirements first.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Verification failed.");
        if (result.error?.toLowerCase().includes("code")) {
          setStep("verify_code");
        }
        return;
      }

      setSuccessMessage("Your password has been updated. You can sign in now.");
      setPassword("");
      setConfirmPassword("");
      setCode("");
    } catch {
      setError("Unable to update password right now.");
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
              {step === "verify_code" ? "Verify Code" : "New Password"}
            </h1>
          </div>
        </div>

        {step === "verify_code" ? (
          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div className="rounded-xl bg-[#FFF1EC]/50 p-4 mb-4">
              <p className="text-sm text-[#684B35]">
                We've sent a 6-digit code to <strong>{email}</strong>. Please enter it below to proceed.
              </p>
            </div>

            <div>
              <label
                htmlFor="code"
                className="mb-2 block font-sans text-sm font-bold uppercase tracking-[0.08em] text-[#0F441D]"
              >
                Reset Code
              </label>

              <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-3 transition focus-within:border-[#0F441D] focus-within:ring-2 focus-within:ring-[#0F441D]/15">
                <KeyRound className="mr-3 text-[#8C7A64]" size={18} />
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="min-w-0 flex-1 bg-transparent font-sans text-2xl font-bold tracking-[0.5em] text-[#0D2E18] outline-none placeholder:text-[#9B8A74] placeholder:tracking-normal placeholder:font-normal placeholder:text-sm"
                  required
                />
              </div>
            </div>

            {error ? (
              <p className="flex items-center gap-2 rounded-xl bg-[#FFF1EC] px-4 py-3 font-sans text-sm font-medium text-[#9C543D]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F441D] py-3 font-sans text-lg font-bold text-white shadow-lg shadow-[#0F441D]/15 transition hover:-translate-y-0.5 hover:bg-[#0D2E18] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              Continue
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block font-sans text-sm font-bold uppercase tracking-[0.08em] text-[#0F441D]">
                Email Address
              </label>
              <div className="flex items-center rounded-xl border border-[#DCCFB8] bg-[#f4f4f4] px-4 py-3">
                <Mail className="mr-3 text-[#8C7A64]" size={18} />
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="min-w-0 flex-1 bg-transparent font-sans text-sm text-[#684B35] outline-none cursor-not-allowed"
                />
                <span className="text-[10px] font-bold text-[#8C7A64] uppercase tracking-wider">View Only</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block font-sans text-sm font-bold uppercase tracking-[0.08em] text-[#0F441D]"
              >
                New Password
              </label>

              <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-3 transition focus-within:border-[#0F441D] focus-within:ring-2 focus-within:ring-[#0F441D]/15">
                <Lock className="mr-3 text-[#8C7A64]" size={18} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                    setSuccessMessage("");
                  }}
                  placeholder="New password"
                  className="min-w-0 flex-1 bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="ml-3 text-[#684B35]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block font-sans text-sm font-bold uppercase tracking-[0.08em] text-[#0F441D]"
              >
                Confirm Password
              </label>

              <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-3 transition focus-within:border-[#0F441D] focus-within:ring-2 focus-within:ring-[#0F441D]/15">
                <Lock className="mr-3 text-[#8C7A64]" size={18} />
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError("");
                    setSuccessMessage("");
                  }}
                  placeholder="Repeat new password"
                  className="min-w-0 flex-1 bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                  required
                />

                <span className="ml-3 flex h-4 w-4 shrink-0 items-center justify-center">
                  {passwordsMatch ? (
                    <CheckCircle2 className="h-4 w-4 text-[#0F7A40]" />
                  ) : null}
                </span>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl bg-white/65 p-4 font-sans text-sm text-[#684B35] sm:grid-cols-2">
              {[
                ["8 characters", passwordChecks.length],
                ["1 number", passwordChecks.number],
                ["1 uppercase letter", passwordChecks.uppercase],
                ["1 special character", passwordChecks.special],
              ].map(([label, isMet]) => (
                <div key={String(label)} className="flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 ${
                      isMet ? "text-[#0F7A40]" : "text-[#CDB898]"
                    }`}
                  />
                  {label}
                </div>
              ))}
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
              disabled={!isPasswordStrong || !passwordsMatch || isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F441D] py-3 font-sans text-lg font-bold text-white shadow-lg shadow-[#0F441D]/15 transition hover:-translate-y-0.5 hover:bg-[#0D2E18] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {isSubmitting ? <LoadingSpinner label="Updating password" /> : null}
              {isSubmitting ? "Updating..." : "Update password"}
            </button>

            <div className="flex justify-between items-center px-1 mt-4">
              <button
                type="button"
                onClick={() => setStep("verify_code")}
                className="text-sm font-semibold text-[#684B35] hover:text-[#0D2E18]"
              >
                Back to code entry
              </button>
              
              {successMessage ? (
                <button
                  type="button"
                  onClick={handleBackToSignIn}
                  className="font-sans text-sm font-semibold text-[#0F441D]"
                >
                  Back to sign in
                </button>
              ) : null}
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

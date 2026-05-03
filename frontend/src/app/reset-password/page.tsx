"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
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
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const passwordChecks = getPasswordChecks(password);
  const isPasswordStrong = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = isPasswordStrong && passwordsMatch && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!canSubmit) {
      setError("Please complete the password requirements first.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError("This reset link is invalid or expired. Please request a new one.");
        return;
      }

      await supabase.auth.signOut({
        scope: "global",
      });

      setSuccessMessage("Your password has been updated. You can sign in now.");
      setPassword("");
      setConfirmPassword("");
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
              Create new password
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                  setSuccessMessage("");
                }}
                placeholder="New password"
                className="min-w-0 flex-1 bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74] autofill:shadow-[inset_0_0_0px_1000px_#FFFFFF] autofill:[-webkit-text-fill-color:#0D2E18]"
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
                className="min-w-0 flex-1 bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74] autofill:shadow-[inset_0_0_0px_1000px_#FFFFFF] autofill:[-webkit-text-fill-color:#0D2E18]"
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
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F441D] py-3 font-sans text-lg font-bold text-white shadow-lg shadow-[#0F441D]/15 transition hover:-translate-y-0.5 hover:bg-[#0D2E18] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isSubmitting ? <LoadingSpinner label="Updating password" /> : null}
            {isSubmitting ? "Updating..." : "Update password"}
          </button>

          {successMessage ? (
            <button
              type="button"
              onClick={handleBackToSignIn}
              className="block w-full text-center font-sans text-sm font-semibold text-[#0F441D]"
            >
              Back to sign in
            </button>
          ) : null}
        </form>
      </section>
    </main>
  );
}

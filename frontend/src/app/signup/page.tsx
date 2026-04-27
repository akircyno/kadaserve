"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const LOGO_SRC = "/images/logo/logo.png";

const passwordRequirements = [
  {
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  {
    label: "At least one number",
    test: (value: string) => /\d/.test(value),
  },
  {
    label: "At least one uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: "At least one special character",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
];

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const requirementResults = useMemo(() => {
    return passwordRequirements.map((requirement) => ({
      ...requirement,
      isMet: requirement.test(password),
    }));
  }, [password]);

  const isPasswordValid = requirementResults.every((item) => item.isMet);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isPasswordValid) {
      setError("Please complete all password requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Account creation failed.");
        return;
      }

      if (result.needsEmailConfirmation) {
        setSuccessMessage(
          "Account created. Please check your email to confirm your account before signing in."
        );
        return;
      }

      router.push("/customer");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,68,29,0.18),_transparent_32%),linear-gradient(180deg,_#FFF0DA_0%,_#FFF8EF_52%,_#0F441D_100%)] px-4 py-6 lg:flex lg:items-center lg:justify-center lg:px-8">
      <div className="mx-auto w-full max-w-md lg:max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] bg-[#FFF8EF] shadow-[0_18px_44px_rgba(13,46,24,0.18)] lg:grid lg:min-h-[44rem] lg:grid-cols-[1.02fr_1fr]">
          <div className="hidden bg-[#0D2E18] text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white/10 shadow-lg shadow-black/20">
                <Image
                  src={LOGO_SRC}
                  alt="KadaServe logo"
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                />
              </div>

              <h1 className="font-display text-4xl font-semibold text-[#FFF0DA]">
                KadaServe
              </h1>
            </div>

            <div>
              <p className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-[#CDB898]">
                Customer Account
              </p>
              <h2 className="mt-4 max-w-lg font-display text-6xl font-semibold leading-[1.02] text-[#FFF0DA]">
                Order easier.
                <br />
                Track clearer.
              </h2>
              <p className="mt-5 max-w-md font-sans text-lg leading-relaxed text-[#FFF0DA]/75">
                Create a customer account for browsing, checkout, order
                tracking, and feedback. Staff access is managed separately by
                the cafe admin.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                "Customer role is automatic",
                "Google sign-up is supported",
                "Staff accounts are admin-managed",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 font-sans text-sm text-[#FFF0DA]"
                >
                  <ShieldCheck className="h-5 w-5 text-[#CDB898]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 py-8 sm:px-8 sm:py-10 lg:flex lg:flex-col lg:justify-center lg:px-10">
            <div className="mb-8 flex items-center gap-4 lg:hidden">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#0D2E18]">
                <Image
                  src={LOGO_SRC}
                  alt="KadaServe logo"
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              </div>

              <h1 className="font-display text-5xl font-semibold tracking-tight text-[#0D2E18]">
                KadaServe
              </h1>
            </div>

            <div className="mb-7">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#DCCFB8] bg-white px-4 py-2 font-sans text-sm font-bold text-[#0D2E18]">
                <Sparkles className="h-4 w-4 text-[#684B35]" />
                Get Started
              </div>
              <h2 className="font-sans text-4xl font-bold tracking-tight text-[#0D2E18] sm:text-5xl">
                Create your account
              </h2>
              <p className="mt-3 font-sans text-base leading-relaxed text-[#684B35]">
                Public sign-up is for customers. Staff and admin accounts are
                created by the cafe admin for security.
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

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-3">
                  <Mail className="mr-3 text-[#8C7A64]" size={18} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block font-sans text-sm font-bold uppercase tracking-[0.08em] text-[#0F441D]"
                >
                  Password
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-3">
                  <Lock className="mr-3 text-[#8C7A64]" size={18} />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create a secure password"
                    className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="ml-3 text-[#684B35]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block font-sans text-sm font-bold uppercase tracking-[0.08em] text-[#0F441D]"
                >
                  Confirm Password
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-3">
                  <Lock className="mr-3 text-[#8C7A64]" size={18} />

                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat your password"
                    className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2 rounded-2xl border border-[#DCCFB8] bg-[#FFF0DA]/60 p-4">
                {requirementResults.map((requirement) => (
                  <div
                    key={requirement.label}
                    className={`flex items-center gap-2 font-sans text-sm ${
                      requirement.isMet ? "text-[#0F441D]" : "text-[#8C7A64]"
                    }`}
                  >
                    <CheckCircle2
                      className={`h-4 w-4 ${
                        requirement.isMet ? "fill-[#0F441D] text-white" : ""
                      }`}
                    />
                    {requirement.label}
                  </div>
                ))}
              </div>

              {error ? (
                <p className="rounded-xl bg-[#FFF1EC] px-4 py-3 font-sans text-sm text-[#9C543D]">
                  {error}
                </p>
              ) : null}

              {successMessage ? (
                <p className="rounded-xl bg-[#E7F4EA] px-4 py-3 font-sans text-sm text-[#1E7A3D]">
                  {successMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-[#0F441D] py-3 font-sans text-lg font-bold text-white transition hover:bg-[#0D2E18] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? "Creating account..." : "Create customer account"}
              </button>
            </form>

            <div className="mt-8">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-[#DCCFB8]" />
                <span className="font-sans text-sm text-[#8C7A64]">or</span>
                <div className="h-px flex-1 bg-[#DCCFB8]" />
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/api/auth/google";
                }}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-[#BFD1B5] bg-white px-5 py-3 font-sans text-base font-semibold text-[#0D2E18] transition hover:bg-[#FFF0DA]"
              >
                <span className="text-lg">
                  <span className="text-[#4285F4]">G</span>
                  <span className="text-[#EA4335]">o</span>
                  <span className="text-[#FBBC05]">o</span>
                  <span className="text-[#4285F4]">g</span>
                  <span className="text-[#34A853]">l</span>
                  <span className="text-[#EA4335]">e</span>
                </span>
                Continue with Google
              </button>

              <p className="mt-6 text-center font-sans text-sm text-[#8C7A64]">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-[#0F441D]">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

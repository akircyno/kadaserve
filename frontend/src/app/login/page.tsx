"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";

const LOGO_SRC = "/images/logo/logo.png";

const inputClass =
  "min-w-0 flex-1 bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74] autofill:shadow-[inset_0_0_0px_1000px_#FFFFFF] autofill:[-webkit-text-fill-color:#0D2E18]";

const emailPattern =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export default function LoginPage() {
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const isEmailValid = emailPattern.test(normalizedEmail);
  const isPasswordValid = password.length > 0;
  const canSubmit = isEmailValid && isPasswordValid && !isLoading;

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isEmailValid || !isPasswordValid || isLoading) {
      setError("Enter a valid email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Invalid email or password.");
        return;
      }

      if (result.role === "admin") {
        router.push("/admin");
      } else if (result.role === "staff") {
        router.push("/staff");
      } else {
        router.push("/customer");
      }

      router.refresh();
    } catch {
      setError("Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,68,29,0.18),_transparent_32%),linear-gradient(180deg,_#FFF0DA_0%,_#FFF8EF_52%,_#0F441D_100%)] px-4 py-4 lg:flex lg:items-center lg:justify-center lg:px-8">
      <Link
        href="/"
        className="fixed left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-[#DCCFB8] bg-white/85 px-4 py-2 font-sans text-sm font-bold text-[#0D2E18] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to KadaServe
      </Link>

      <div className="mx-auto w-full max-w-md lg:max-w-5xl">
        <section className="overflow-hidden rounded-[1.75rem] bg-[#FFF8EF] shadow-[0_18px_44px_rgba(13,46,24,0.18)] lg:grid lg:min-h-[34.5rem] lg:grid-cols-[1.02fr_1fr]">
          <div className="hidden bg-[#0D2E18] text-white lg:flex lg:flex-col lg:justify-between lg:p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white/10 shadow-lg shadow-black/20">
                <Image
                  src={LOGO_SRC}
                  alt="KadaServe logo"
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              </div>

              <h1 className="font-display text-3xl font-semibold text-[#FFF2E2]">
                KadaServe
              </h1>
            </div>

            <div>
              <h2 className="font-display text-5xl font-semibold leading-tight text-[#FFF0DA]">
                Every cup
              </h2>
              <p className="font-display mt-1 text-5xl italic font-semibold leading-tight text-[#FFF0DA]">
                tells a story.
              </p>
            </div>

            <ul className="space-y-3 font-sans text-sm text-[#FFF0DA]/78">
              {[
                "Live Order Tracking",
                "Smart Inventory Insights",
                "Seamless Staff Management",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-[#CDB898]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="px-5 py-6 sm:px-7 sm:py-7 lg:flex lg:flex-col lg:justify-center lg:px-8">
            <div className="mb-6 flex items-center gap-4 lg:hidden">
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

            <div className="mb-5">
              <h2 className="font-sans text-4xl font-bold tracking-tight text-[#0D2E18]">
                Welcome back
              </h2>
              <p className="mt-1.5 font-sans text-base text-[#684B35]">
                Sign in to order, track, and enjoy your favorites
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#0F441D]"
                >
                  Email Address
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-2.5 transition focus-within:border-[#0F441D] focus-within:ring-2 focus-within:ring-[#0F441D]/15">
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
                    }}
                    onBlur={() => {
                      setEmail((currentEmail) =>
                        currentEmail.trim().toLowerCase()
                      );
                    }}
                    placeholder="you@example.com"
                    className={inputClass}
                    required
                  />

                  <span className="ml-3 flex h-4 w-4 shrink-0 items-center justify-center">
                    {isEmailValid ? (
                      <CheckCircle2 className="h-4 w-4 text-[#0F7A40]" />
                    ) : null}
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#0F441D]"
                >
                  Password
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-2.5 transition focus-within:border-[#0F441D] focus-within:ring-2 focus-within:ring-[#0F441D]/15">
                  <Lock className="mr-3 text-[#8C7A64]" size={18} />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="password"
                    className={inputClass}
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

                <div className="mt-1.5 text-right">
                  <Link
                    href="/forgot-password"
                    className="font-sans text-sm text-[#8C7A64] transition hover:text-[#0F441D]"
                  >
                    Forgot password?
                  </Link>
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
                disabled={!canSubmit}
                className="w-full rounded-xl bg-[#0F441D] py-2.5 font-sans text-base font-bold text-white shadow-lg shadow-[#0F441D]/15 transition hover:-translate-y-0.5 hover:bg-[#0D2E18] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="mt-5">
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
                className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-[#D6C6AC] bg-white px-5 py-2.5 font-sans text-base font-semibold text-[#0D2E18] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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

              <p className="mt-4 text-center font-sans text-sm text-[#8C7A64]">
                New to KadaServe?{" "}
                <Link href="/signup" className="font-semibold text-[#0F441D]">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

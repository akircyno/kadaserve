"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";

const LOGO_SRC = "/images/logo/logo.png";

const inputClass =
  "min-w-0 flex-1 bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74] autofill:shadow-[inset_0_0_0px_1000px_#FFFFFF] autofill:[-webkit-text-fill-color:#0D2E18]";

const emailPattern =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
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
  const callbackUrl = searchParams.get("callbackUrl");
  const loginIntent = searchParams.get("intent");
  const safeCallbackUrl =
    callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : null;

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isEmailValid || !isPasswordValid || isLoading) {
      const message = "Enter a valid email and password.";
      setError(message);
      showToast({
        title: "Sign in blocked",
        description: message,
        variant: "error",
      });
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
        const message = result.error || "Invalid email or password.";
        setError(message);
        showToast({
          title: "Sign in failed",
          description: message,
          variant: "error",
        });
        return;
      }

      if (result.role === "admin") {
        router.push("/admin");
      } else if (result.role === "staff") {
        router.push("/staff");
      } else if (safeCallbackUrl) {
        if (safeCallbackUrl.startsWith("/customer")) {
          window.sessionStorage.setItem("kadaserve_show_customer_splash", "true");
        }
        router.push(safeCallbackUrl);
      } else {
        window.sessionStorage.setItem("kadaserve_show_customer_splash", "true");
        router.push("/customer");
      }

      router.refresh();
    } catch {
      const message = "Invalid email or password.";
      setError(message);
      showToast({
        title: "Sign in failed",
        description: message,
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleGoogleAuth() {
    setError("");

    window.location.href = "/api/auth/google";
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(15,68,29,0.18),_transparent_32%),linear-gradient(180deg,_#FFF0DA_0%,_#FFF8EF_52%,_#0F441D_100%)] px-4 pb-4 pt-20 sm:pt-24 lg:flex lg:items-center lg:justify-center lg:px-8 lg:py-4">
      <Link
        href="/"
        className="fixed left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-[#DCCFB8] bg-white/85 px-4 py-2 font-sans text-sm font-bold text-[#0D2E18] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to KadaServe
      </Link>

      <div className="mx-auto w-[calc(100vw-2rem)] min-w-0 max-w-md lg:max-w-5xl">
        <section className="w-full min-w-0 overflow-hidden rounded-[1.75rem] bg-[#FFF8EF] shadow-[0_18px_44px_rgba(13,46,24,0.18)] lg:grid lg:min-h-[34.5rem] lg:grid-cols-[1.02fr_1fr]">
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

              <h1 className="font-sans text-3xl font-semibold text-[#FFF2E2]">
                KadaServe
              </h1>
            </div>

            <div>
              <h2 className="font-sans text-5xl font-semibold leading-tight text-[#FFF0DA]">
                Every cup
              </h2>
              <p className="font-sans mt-1 text-5xl italic font-semibold leading-tight text-[#FFF0DA]">
                tells a story.
              </p>
            </div>

            <ul className="space-y-3 font-sans text-sm text-[#FFF0DA]/78">
              {[
                "Live Order Tracking",
                "Nutrition Estimates",
                "Pick Your Favorite Drink",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-[#CDB898]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="px-5 py-6 sm:px-7 sm:py-7 lg:flex lg:flex-col lg:justify-center lg:px-8">
            <div className="mb-6 flex min-w-0 items-center gap-3 sm:gap-4 lg:hidden">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0D2E18] sm:h-16 sm:w-16">
                <Image
                  src={LOGO_SRC}
                  alt="KadaServe logo"
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              </div>

              <h1 className="min-w-0 font-sans text-4xl font-semibold tracking-tight text-[#0D2E18] sm:text-5xl">
                KadaServe
              </h1>
            </div>

            <div className="mb-5">
              <h2 className="font-sans text-4xl font-bold tracking-tight text-[#0D2E18]">
                Welcome back
              </h2>
              <p className="mt-1.5 font-sans text-base text-[#684B35]">
                {loginIntent === "login-to-order"
                  ? "Login to order and keep your taste profile accurate."
                  : "Sign in to order, track, and enjoy your favorites"}
              </p>
              {loginIntent === "login-to-order" ? (
                <p className="mt-3 rounded-xl border border-[#DCCFB8] bg-white px-4 py-3 font-sans text-sm font-bold text-[#0D2E18] shadow-sm">
                  Login to Order
                </p>
              ) : null}
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
                    suppressHydrationWarning
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
                    placeholder="Enter your email@example.com"
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
                    suppressHydrationWarning
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="Enter your password"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F441D] py-2.5 font-sans text-base font-bold text-white shadow-lg shadow-[#0F441D]/15 transition hover:-translate-y-0.5 hover:bg-[#0D2E18] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {isLoading ? <LoadingSpinner label="Signing in" /> : null}
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
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-[#D6C6AC] bg-white px-5 py-2.5 font-sans text-base font-semibold text-[#0D2E18] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

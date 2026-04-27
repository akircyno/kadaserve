"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

const LOGO_SRC = "/images/logo/logo.png";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Login failed.");
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
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#FFF0DA_0%,_#0F441D_100%)] px-4 py-6 lg:flex lg:items-center lg:justify-center lg:px-8">
      <div className="mx-auto w-full max-w-md lg:max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] bg-[#FFF2E2] shadow-[0_16px_40px_rgba(0,0,0,0.16)] lg:grid lg:min-h-[44rem] lg:grid-cols-[1.05fr_1fr]">
          <div className="hidden bg-[#174D25] text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
                <Image
                  src={LOGO_SRC}
                  alt="KadaServe logo"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              </div>

              <h1 className="font-display text-4xl font-semibold text-[#FFF2E2]">
                KadaServe
              </h1>
            </div>

            <div>
              <p className="font-sans text-sm font-bold uppercase tracking-[0.14em] text-[#9BBF92]">
                Cafe Management
              </p>
              <h2 className="mt-4 font-display text-6xl font-semibold leading-[1.05] text-white">
                Every cup
              </h2>
              <p className="font-display mt-2 text-6xl italic font-semibold leading-[1.05] text-white">
                tells a story.
              </p>
            </div>

            <ul className="space-y-4 text-lg text-[#D6E5CF]">
              <li className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[#9BBF92]" />
                Order & inventory tracking
              </li>
              <li className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[#9BBF92]" />
                Staff scheduling & roles
              </li>
              <li className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[#9BBF92]" />
                Multi-branch analytics
              </li>
            </ul>
          </div>

          <div className="px-5 py-8 sm:px-8 sm:py-10 lg:flex lg:flex-col lg:justify-center lg:px-10">
            <div className="mb-8 flex items-center gap-4 lg:hidden">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#165C28]">
                <Image
                  src={LOGO_SRC}
                  alt="KadaServe logo"
                  width={44}
                  height={44}
                  className="h-11 w-11 object-contain"
                />
              </div>

              <h1 className="font-display text-5xl font-semibold tracking-tight text-[#165C28]">
                KadaServe
              </h1>
            </div>

            <div className="mb-8">
              <h2 className="font-sans text-4xl font-bold tracking-tight text-[#123E26] sm:text-5xl">
                Welcome back
              </h2>
              <p className="mt-3 font-sans text-lg text-[#2A5B35]">
                Sign in to manage your cafe.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block font-sans text-sm font-bold uppercase tracking-[0.08em] text-[#165C28]"
                >
                  Email Address
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-3">
                  <Mail className="mr-3 text-[#93A08E]" size={18} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-transparent font-sans text-sm text-[#123E26] outline-none placeholder:text-[#9AA49B]"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block font-sans text-sm font-bold uppercase tracking-[0.08em] text-[#165C28]"
                >
                  Password
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-3">
                  <Lock className="mr-3 text-[#93A08E]" size={18} />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="password"
                    className="w-full bg-transparent font-sans text-sm text-[#123E26] outline-none placeholder:text-[#9AA49B]"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="ml-3 text-[#7F8A7D]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="mt-2 text-right">
                  <button
                    type="button"
                    className="font-sans text-sm text-[#6F8B6B]"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-xl bg-red-50 px-4 py-3 font-sans text-sm text-red-600">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-[#165C28] py-3 font-sans text-lg font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="mt-8">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-[#DCCFB6]" />
                <span className="font-sans text-sm text-[#8B7B66]">or</span>
                <div className="h-px flex-1 bg-[#DCCFB6]" />
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/api/auth/google";
                }}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-[#BFD1B5] bg-white px-5 py-3 font-sans text-base font-semibold text-[#123E26]"
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

              <p className="mt-6 text-center font-sans text-sm text-[#8B7B66]">
                New to KadaServe?{" "}
                <Link href="/signup" className="font-semibold text-[#165C28]">
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

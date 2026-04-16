"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Eye, EyeOff, Lock, Mail } from "lucide-react";

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
    <main
      className="min-h-screen px-4 py-10"
      style={{
        background: "linear-gradient(180deg, #FFF0DA 1%, #0F441D 100%)",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col items-center justify-start pt-8">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#165C28] text-[#FFF0DA] shadow-md">
            <Bike size={30} strokeWidth={2.2} />
          </div>

          <h1 className="font-display text-5xl font-semibold tracking-tight text-[#165C28]">
            KadaServe
          </h1>
        </div>

        <section className="w-full rounded-[2rem] bg-[#FFF2E2] px-5 py-8 shadow-[0_8px_20px_rgba(0,0,0,0.18)] sm:px-6 sm:py-10">
          <div className="mb-8">
            <h2 className="mb-2 font-display text-5xl font-semibold leading-none text-[#165C28]">
              Welcome!!
            </h2>
            <p className="max-w-xs font-sans text-[1.3rem] leading-tight text-[#165C28]">
              Order your favorite drinks anytime, anywhere
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block font-sans text-base font-semibold text-[#165C28]"
              >
                Email Address
              </label>

              <div className="flex items-center rounded-2xl bg-white px-4 py-3 shadow-sm">
                <Mail className="mr-3 text-gray-500" size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@gmail.com"
                  className="w-full bg-transparent font-sans text-base text-[#123E26] outline-none placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block font-sans text-base font-semibold text-[#165C28]"
              >
                Password
              </label>

              <div className="flex items-center rounded-2xl bg-white px-4 py-3 shadow-sm">
                <Lock className="mr-3 text-gray-500" size={20} />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="password"
                  className="w-full bg-transparent font-sans text-base text-[#123E26] outline-none placeholder:text-gray-400"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="ml-3 text-gray-500"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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
              className="mt-2 w-full rounded-2xl bg-[#165C28] py-3 font-sans text-2xl font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="font-sans text-sm text-[#5f5f5f]">or continue with</p>

            <p className="mt-5 font-sans text-xs text-[#777777]">
              new to Kadaserve?{" "}
              <span className="font-semibold text-[#165C28]">
                Create an account
              </span>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

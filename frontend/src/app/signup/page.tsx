"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User,
} from "lucide-react";

const LOGO_SRC = "/images/logo/logo.png";

const inputClass =
  "w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74] autofill:shadow-[inset_0_0_0px_1000px_#FFFFFF] autofill:[-webkit-text-fill-color:#0D2E18]";

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

const nameRegex = /^[A-Za-z\s.-]+$/;
const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function toTitleCaseName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) =>
      part
        .split("-")
        .map((segment) =>
          segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : ""
        )
        .join("-")
    )
    .join(" ");
}

function isValidName(value: string) {
  return nameRegex.test(value.trim());
}

function getPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("639")) {
    return `0${digits.slice(2, 12)}`;
  }

  return digits.slice(0, 11);
}

function formatPhoneNumber(value: string) {
  const digits = getPhoneDigits(value);

  if (digits.length <= 4) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
}

function isValidPhone(value: string) {
  return /^09\d{9}$/.test(getPhoneDigits(value));
}

function isValidEmail(value: string) {
  return emailRegex.test(value.trim());
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getAdultCutoffDate() {
  const today = new Date();
  return new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
}

function isAtLeast18(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const selectedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(selectedDate.getTime())) {
    return false;
  }

  return selectedDate <= getAdultCutoffDate();
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [touchedFields, setTouchedFields] = useState({
    fullName: false,
    phone: false,
    dateOfBirth: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const requirementResults = useMemo(() => {
    return passwordRequirements.map((requirement) => ({
      ...requirement,
      isMet: requirement.test(password),
    }));
  }, [password]);

  const isPasswordValid = requirementResults.every((item) => item.isMet);
  const trimmedFullName = fullName.trim();
  const trimmedEmail = email.trim();
  const isFullNameValid = isValidName(trimmedFullName);
  const isPhoneValid = isValidPhone(phone);
  const isDateOfBirthValid = isAtLeast18(dateOfBirth);
  const isEmailValid = isValidEmail(trimmedEmail);
  const passwordsMatch = password === confirmPassword && confirmPassword !== "";
  const adultCutoffDate = formatDateInput(getAdultCutoffDate());
  const canSubmit =
    isFullNameValid &&
    isPhoneValid &&
    isDateOfBirthValid &&
    isEmailValid &&
    isPasswordValid &&
    passwordsMatch &&
    !isLoading;

  const fieldErrors = {
    fullName:
      touchedFields.fullName && trimmedFullName && !isFullNameValid
        ? "Use letters, spaces, hyphens, and dots only."
        : "",
    phone:
      touchedFields.phone && phone && !isPhoneValid
        ? "Use a valid Philippine mobile number: 0917-123-4567."
        : "",
    dateOfBirth:
      touchedFields.dateOfBirth && dateOfBirth && !isDateOfBirthValid
        ? "You must be at least 18 years old to create an account."
        : "",
    email:
      touchedFields.email && trimmedEmail && !isEmailValid
        ? "Enter a valid email address."
        : "",
    confirmPassword:
      touchedFields.confirmPassword && confirmPassword && !passwordsMatch
        ? "Passwords do not match."
        : "",
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!isValidName(fullName)) {
      setError("Full name can only include letters, spaces, hyphens, and dots.");
      return;
    }

    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    if (!isValidPhone(phone)) {
      setError("Phone number must be a valid Philippine mobile number.");
      return;
    }

    if (!isAtLeast18(dateOfBirth)) {
      setError("You must be at least 18 years old to create an account.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

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
        body: JSON.stringify({
          fullName: trimmedFullName,
          phone: getPhoneDigits(phone),
          dateOfBirth,
          email: trimmedEmail,
          password,
        }),
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

      window.location.assign("/customer");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,68,29,0.18),_transparent_32%),linear-gradient(180deg,_#FFF0DA_0%,_#FFF8EF_52%,_#0F441D_100%)] px-4 py-3 lg:flex lg:items-center lg:justify-center lg:px-8">
      <Link
        href="/"
        className="fixed left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-[#DCCFB8] bg-white/85 px-4 py-2 font-sans text-sm font-bold text-[#0D2E18] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to KadaServe
      </Link>

      <div className="mx-auto w-full max-w-md lg:max-w-5xl">
        <section className="overflow-hidden rounded-[1.75rem] bg-[#FFF8EF] shadow-[0_18px_44px_rgba(13,46,24,0.18)] lg:grid lg:max-h-[calc(100vh-2rem)] lg:min-h-[34rem] lg:grid-cols-[1.02fr_1fr]">
          <div className="hidden bg-[#0D2E18] text-white lg:flex lg:flex-col lg:justify-between lg:p-7">
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

              <h1 className="font-sans text-3xl font-semibold text-[#FFF0DA]">
                KadaServe
              </h1>
            </div>

            <div>
              <p className="font-sans text-sm font-bold uppercase tracking-[0.18em] text-[#CDB898]">
                Customer Account
              </p>
              <h2 className="mt-3 max-w-lg font-sans text-4xl font-semibold leading-[1.02] text-[#FFF0DA] xl:text-5xl">
                Order easier.
                <br />
                Track clearer.
              </h2>
              <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-[#FFF0DA]/75">
                Create a customer account for browsing, checkout, order
                tracking, and feedback.
              </p>
            </div>

            <div className="grid gap-2">
              {[
                {
                  title: "Smart Order Monitoring",
                  description: "Real-time tracking for peace of mind.",
                },
                {
                  title: "Faster Checkout",
                  description: "Saved preferences for quick reordering.",
                },
                {
                  title: "Personalized Recommendations",
                  description: "Discover new drinks you'll love.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-2.5 font-sans text-xs leading-relaxed text-[#FFF0DA]"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#CDB898]" />
                  <p>
                    <span className="font-bold">{item.title}:</span>{" "}
                    <span className="text-[#FFF0DA]/72">
                      {item.description}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto px-5 py-5 sm:px-7 lg:flex lg:flex-col lg:justify-center lg:px-8">
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

              <h1 className="font-sans text-5xl font-semibold tracking-tight text-[#0D2E18]">
                KadaServe
              </h1>
            </div>

            <div className="mb-3">
              <h2 className="font-sans text-3xl font-bold tracking-tight text-[#0D2E18] xl:text-4xl">
                Create your account
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div>
                <label
                  htmlFor="full-name"
                  className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#0F441D]"
                >
                  Full Name
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-2">
                  <User className="mr-3 text-[#8C7A64]" size={18} />
                  <input
                    id="full-name"
                    type="text"
                    inputMode="text"
                    value={fullName}
                    onChange={(event) => {
                      const cleanedValue = event.target.value.replace(
                        /[^A-Za-z\s.-]/g,
                        ""
                      );

                      setFullName(toTitleCaseName(cleanedValue));
                    }}
                    onBlur={() =>
                      setTouchedFields((current) => ({
                        ...current,
                        fullName: true,
                      }))
                    }
                    placeholder="Your name"
                    className={inputClass}
                    pattern="[A-Za-z\s.-]+"
                    title="Use letters, spaces, hyphens, and dots only."
                    required
                  />
                  {isFullNameValid ? (
                    <CheckCircle2 className="ml-3 h-4 w-4 shrink-0 fill-[#0F441D] text-white" />
                  ) : null}
                </div>
                {fieldErrors.fullName ? (
                  <p className="mt-2 flex items-center gap-2 font-sans text-xs text-[#9C543D]">
                    <AlertTriangle className="h-4 w-4" />
                    {fieldErrors.fullName}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#0F441D]"
                >
                  Phone Number
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-2">
                  <Phone className="mr-3 text-[#8C7A64]" size={18} />
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => {
                      setPhone(formatPhoneNumber(event.target.value));
                    }}
                    onBlur={() =>
                      setTouchedFields((current) => ({
                        ...current,
                        phone: true,
                      }))
                    }
                    placeholder="0917-123-4567"
                    className={inputClass}
                    pattern="09[0-9]{2}-[0-9]{3}-[0-9]{4}"
                    title="Use a valid Philippine mobile number. Format: 0917-123-4567."
                    required
                  />
                  {isPhoneValid ? (
                    <CheckCircle2 className="ml-3 h-4 w-4 shrink-0 fill-[#0F441D] text-white" />
                  ) : null}
                </div>
                {fieldErrors.phone ? (
                  <p className="mt-2 flex items-center gap-2 font-sans text-xs text-[#9C543D]">
                    <AlertTriangle className="h-4 w-4" />
                    {fieldErrors.phone}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="date-of-birth"
                  className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#0F441D]"
                >
                  Date of Birth
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-2">
                  <CalendarDays className="mr-3 text-[#8C7A64]" size={18} />
                  <input
                    id="date-of-birth"
                    type="date"
                    value={dateOfBirth}
                    max={adultCutoffDate}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                    onBlur={() =>
                      setTouchedFields((current) => ({
                        ...current,
                        dateOfBirth: true,
                      }))
                    }
                    className={inputClass}
                    title="You must be at least 18 years old."
                    required
                  />
                  {isDateOfBirthValid ? (
                    <CheckCircle2 className="ml-3 h-4 w-4 shrink-0 fill-[#0F441D] text-white" />
                  ) : null}
                </div>
                {fieldErrors.dateOfBirth ? (
                  <p className="mt-2 flex items-center gap-2 font-sans text-xs text-[#9C543D]">
                    <AlertTriangle className="h-4 w-4" />
                    {fieldErrors.dateOfBirth}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#0F441D]"
                >
                  Email Address
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-2">
                  <Mail className="mr-3 text-[#8C7A64]" size={18} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value.toLowerCase())
                    }
                    onBlur={() => {
                      setEmail((current) => current.trim().toLowerCase());
                      setTouchedFields((current) => ({
                        ...current,
                        email: true,
                      }));
                    }}
                    placeholder="you@example.com"
                    className={`${inputClass} lowercase`}
                    title="Enter a valid email address, for example name@gmail.com."
                    required
                  />
                  {isEmailValid ? (
                    <CheckCircle2 className="ml-3 h-4 w-4 shrink-0 fill-[#0F441D] text-white" />
                  ) : null}
                </div>
                {fieldErrors.email ? (
                  <p className="mt-2 flex items-center gap-2 font-sans text-xs text-[#9C543D]">
                    <AlertTriangle className="h-4 w-4" />
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#0F441D]"
                >
                  Password
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-2">
                  <Lock className="mr-3 text-[#8C7A64]" size={18} />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setTouchedFields((current) => ({
                        ...current,
                        password: true,
                      }));
                    }}
                    placeholder="Create a secure password"
                    className={inputClass}
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
                  className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.08em] text-[#0F441D]"
                >
                  Confirm Password
                </label>

                <div className="flex items-center rounded-xl border border-[#BFD1B5] bg-white px-4 py-2">
                  <Lock className="mr-3 text-[#8C7A64]" size={18} />

                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    onBlur={() =>
                      setTouchedFields((current) => ({
                        ...current,
                        confirmPassword: true,
                      }))
                    }
                    placeholder="Repeat your password"
                    className={inputClass}
                    required
                  />
                  {passwordsMatch ? (
                    <CheckCircle2 className="ml-3 h-4 w-4 shrink-0 fill-[#0F441D] text-white" />
                  ) : null}
                </div>
                {fieldErrors.confirmPassword ? (
                  <p className="mt-2 flex items-center gap-2 font-sans text-xs text-[#9C543D]">
                    <AlertTriangle className="h-4 w-4" />
                    {fieldErrors.confirmPassword}
                  </p>
                ) : null}
                {passwordsMatch ? (
                  <p className="mt-2 flex items-center gap-2 font-sans text-xs text-[#0F441D]">
                    <CheckCircle2 className="h-4 w-4 fill-[#0F441D] text-white" />
                    Passwords match
                  </p>
                ) : null}
              </div>

              <div className="-mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
                {requirementResults.map((requirement) => (
                  <div
                    key={requirement.label}
                    className={`flex items-center gap-2 font-sans text-xs sm:text-sm ${
                      requirement.isMet ? "text-[#0F441D]" : "text-[#8C7A64]"
                    }`}
                  >
                    <CheckCircle2
                      className={`h-4 w-4 ${
                        requirement.isMet ? "fill-[#0F441D] text-white" : ""
                      }`}
                    />
                    {requirement.label
                      .replace("At least ", "")
                      .replace("one ", "1 ")}
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
                disabled={!canSubmit}
                className="w-full rounded-xl bg-[#0F441D] py-2.5 font-sans text-base font-bold text-white transition hover:bg-[#0D2E18] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <div className="mt-3">
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
                className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl border border-[#BFD1B5] bg-white px-5 py-2.5 font-sans text-base font-semibold text-[#0D2E18] transition hover:bg-[#FFF0DA]"
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

              <p className="mt-3 text-center font-sans text-sm text-[#8C7A64]">
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

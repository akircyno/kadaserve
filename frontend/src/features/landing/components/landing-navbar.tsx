"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#ratings", label: "Ratings" },
  { href: "#analytics", label: "Analytics" },
];

export function LandingNavbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-4">
      <div className="mx-auto w-full max-w-7xl rounded-full border border-[#DCCFB8] bg-white/75 px-3 shadow-lg shadow-[#0D2E18]/5 backdrop-blur-xl sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-lg shadow-kada-green/20 sm:h-11 sm:w-11">
              <Image
                src="/images/logo/logo.png"
                alt="KadaServe logo"
                width={44}
                height={44}
                priority
                className="h-full w-full object-cover"
              />
            </span>
            <span className="truncate font-sans text-xl font-bold tracking-tight text-[#0D2E18] sm:text-2xl">
              KadaServe
            </span>
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-sans text-sm font-bold text-[#684B35] transition hover:text-[#0F441D]"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="rounded-full border border-[#0D2E18]/20 px-6 py-3 font-sans text-sm font-bold text-[#0D2E18] transition hover:-translate-y-0.5 hover:bg-[#FFF0DA]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#0F441D] px-6 py-3 font-sans text-sm font-bold text-white shadow-lg shadow-[#0F441D]/20 transition hover:-translate-y-0.5 hover:bg-[#0D2E18]"
            >
              Get Started
            </Link>
          </div>

          <button
            type="button"
            aria-expanded={isOpen}
            aria-label="Toggle navigation menu"
            onClick={() => setIsOpen((current) => !current)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-[#0D2E18] transition hover:bg-[#0F441D]/10 lg:hidden"
          >
            {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="mx-auto mt-3 w-full max-w-7xl rounded-[1.5rem] border border-[#DCCFB8] bg-white/95 shadow-xl sm:rounded-[2rem] lg:hidden">
          <div className="flex flex-col gap-2 px-4 py-5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="min-h-11 rounded-2xl px-4 py-3 font-sans text-sm font-bold text-[#684B35] transition hover:bg-[#0F441D]/10"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="mt-2 min-h-11 rounded-2xl border border-[#0D2E18]/20 px-5 py-3 text-center font-sans text-sm font-bold text-[#0D2E18]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              onClick={() => setIsOpen(false)}
              className="min-h-11 rounded-2xl bg-[#0F441D] px-5 py-3 text-center font-sans text-sm font-bold text-white"
            >
              Get Started
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

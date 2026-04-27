"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#analytics", label: "Analytics" },
  { href: "#workflow", label: "Workflow" },
];

export function LandingNavbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed inset-x-0 top-4 z-50 px-4">
      <div className="mx-auto max-w-7xl rounded-full border border-[#DCCFB8] bg-white/75 px-4 shadow-lg shadow-[#0D2E18]/5 backdrop-blur-xl sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full shadow-lg shadow-kada-green/20">
              <Image
                src="/images/logo/logo.png"
                alt="KadaServe logo"
                width={44}
                height={44}
                priority
                className="h-full w-full object-cover"
              />
            </span>
            <span className="font-display text-2xl font-bold tracking-tight text-[#0D2E18]">
              KadaServe
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
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
            className="rounded-full p-2 text-[#0D2E18] transition hover:bg-[#0F441D]/10 md:hidden"
          >
            {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="mx-auto mt-3 max-w-7xl rounded-[2rem] border border-[#DCCFB8] bg-white/95 shadow-xl md:hidden">
          <div className="flex flex-col gap-2 px-4 py-5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="rounded-2xl px-4 py-3 font-sans text-sm font-bold text-[#684B35] transition hover:bg-[#0F441D]/10"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="mt-2 rounded-2xl border border-[#0D2E18]/20 px-5 py-3 text-center font-sans text-sm font-bold text-[#0D2E18]"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-2xl bg-[#0F441D] px-5 py-3 text-center font-sans text-sm font-bold text-white"
            >
              Get Started
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

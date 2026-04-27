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
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-kada-green/10 bg-kada-beige/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl shadow-lg shadow-kada-green/20">
              <Image
                src="/images/logo/logo.png"
                alt="KadaServe logo"
                width={44}
                height={44}
                priority
                className="h-full w-full object-cover"
              />
            </span>
            <span className="font-display text-2xl font-bold tracking-tight text-kada-forest">
              KadaServe
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-sans text-sm font-semibold text-kada-forest/75 transition hover:text-kada-green"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="rounded-full bg-kada-green px-6 py-3 font-sans text-sm font-bold text-white shadow-lg shadow-kada-green/20 transition hover:-translate-y-0.5 hover:bg-kada-forest"
            >
              Sign in
            </Link>
          </div>

          <button
            type="button"
            aria-expanded={isOpen}
            aria-label="Toggle navigation menu"
            onClick={() => setIsOpen((current) => !current)}
            className="rounded-full p-2 text-kada-forest transition hover:bg-kada-green/10 md:hidden"
          >
            {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="border-t border-kada-green/10 bg-kada-beige shadow-xl md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="rounded-2xl px-4 py-3 font-sans text-sm font-semibold text-kada-forest transition hover:bg-kada-green/10"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="mt-2 rounded-2xl bg-kada-green px-5 py-3 text-center font-sans text-sm font-bold text-white"
            >
              Sign in
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

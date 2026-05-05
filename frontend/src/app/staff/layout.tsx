"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  History,
  Menu as MenuIcon,
  Pencil,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const navItems = [
  {
    href: "/staff",
    label: "Order Queue",
    icon: ClipboardList,
  },
  {
    href: "/staff/encode-order",
    label: "Encode Order",
    icon: Pencil,
  },
  {
    href: "/staff/order-history",
    label: "Order History",
    icon: History,
  },
];

export default function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const activeNavItem =
    navItems.find(
      (item) =>
        pathname === item.href ||
        (item.href !== "/staff" && pathname.startsWith(item.href))
    ) ?? navItems[0];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    function syncSidebarState() {
      setIsMobileSidebarOpen(false);
    }

    syncSidebarState();
    mediaQuery.addEventListener("change", syncSidebarState);

    return () => mediaQuery.removeEventListener("change", syncSidebarState);
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/logout", {
        method: "POST",
      });

      router.push("/login");
      router.refresh();
    } finally {
      setIsMobileSidebarOpen(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FFF0DA] text-[#0D2E18]">
      {isMobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close staff navigation"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-[#0D2E18]/35 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col overflow-hidden rounded-r-[24px] bg-[#0D2E18] text-[#FFF0DA] shadow-[0_18px_40px_rgba(13,46,24,0.22)] transition-transform duration-300 lg:w-[232px] lg:translate-x-0 ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-6">
          <Link
            href="/staff"
            className="font-sans text-[1.7rem] font-bold leading-none tracking-[-0.04em] text-[#FFF0DA]"
          >
            KadaServe
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close staff navigation"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF0DA]/10 text-[#FFF0DA] transition hover:bg-[#FFF0DA]/18 lg:hidden"
          >
            <X size={17} />
          </button>
        </div>

        <nav className="mt-20 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/staff" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileSidebarOpen(false)}
                className={`flex min-h-11 items-center gap-3 rounded-[14px] px-4 py-3 font-sans text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#FFF0DA] text-[#0D2E18]"
                    : "text-[#FFF0DA]/88 hover:bg-[#FFF0DA]/10 hover:text-[#FFF0DA]"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-3 pb-5">
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="flex w-full items-center gap-3 rounded-[14px] px-4 py-3 font-sans text-sm font-semibold text-[#FFF0DA]/88 transition hover:bg-[#FFF0DA]/10 hover:text-[#FFF0DA]"
          >
            <ArrowLeft size={17} className="shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[232px]">
        <header className="sticky top-0 z-30 border-b border-[#DCCFB8] bg-[#FFF0DA]/96 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                aria-label="Open staff navigation"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D6C6AC] bg-white text-[#684B35] transition hover:bg-[#FFF8EF] lg:hidden"
              >
                <MenuIcon size={18} />
              </button>

              <div className="min-w-0">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
                  Staff Command Center
                </p>
                <h1 className="truncate font-sans text-[1.55rem] font-bold leading-tight text-[#0D2E18] sm:text-2xl">
                  {activeNavItem.label}
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  History,
  Menu as MenuIcon,
  ChevronLeft,
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    function syncSidebarState() {
      setIsMobileSidebarOpen(false);
    }

    syncSidebarState();
    mediaQuery.addEventListener("change", syncSidebarState);

    return () => mediaQuery.removeEventListener("change", syncSidebarState);
  }, []);

  function toggleSidebarCollapse() {
    setIsSidebarCollapsed((prev) => !prev);
  }

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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden rounded-r-[24px] bg-[#0D2E18] text-[#FFF0DA] shadow-[0_18px_40px_rgba(13,46,24,0.22)] transition-all duration-250 lg:translate-x-0 ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          isSidebarCollapsed ? "w-[70px] lg:w-[70px]" : "w-[250px] lg:w-[232px]"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-4 lg:px-4 lg:pt-5">
          <Link
            href="/staff"
            className={`flex-shrink-0 font-sans font-bold leading-none tracking-[-0.04em] text-[#FFF0DA] transition-all duration-250 ${
              isSidebarCollapsed
                ? "text-base opacity-0 w-0"
                : "text-[1.7rem] opacity-100"
            }`}
            style={{
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            KadaServe
          </Link>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF0DA]/10 text-[#FFF0DA] transition hover:bg-[#FFF0DA]/20"
            >
              <ChevronLeft
                size={16}
                className={`transition-transform duration-250 ${
                  isSidebarCollapsed ? "rotate-180" : ""
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close staff navigation"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF0DA]/10 text-[#FFF0DA] transition hover:bg-[#FFF0DA]/18 lg:hidden"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <nav
          className={`mt-12 space-y-1 transition-all duration-250 ${
            isSidebarCollapsed ? "px-2" : "px-3"
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/staff" && pathname.startsWith(item.href));

            return (
              <div
                key={item.href}
                className="group/nav relative"
              >
                <Link
                  href={item.href}
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className={`flex min-h-11 items-center justify-center rounded-[14px] px-3 py-3 font-sans text-sm font-semibold transition-all duration-250 lg:justify-start lg:gap-3 lg:px-4 ${
                    isActive
                      ? "bg-[#FFF0DA] text-[#0D2E18]"
                      : "text-[#FFF0DA]/88 hover:bg-[#FFF0DA]/10 hover:text-[#FFF0DA]"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span
                    className={`hidden font-sans text-sm font-semibold transition-all duration-250 lg:inline ${
                      isSidebarCollapsed
                        ? "w-0 overflow-hidden opacity-0"
                        : "w-auto overflow-visible opacity-100"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>

                {isSidebarCollapsed && (
                  <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0D2E18] px-2 py-1 font-sans text-xs font-semibold text-[#FFF0DA] opacity-0 shadow-lg transition-opacity duration-200 group-hover/nav:pointer-events-auto group-hover/nav:opacity-100">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div
          className={`mt-auto transition-all duration-250 ${
            isSidebarCollapsed ? "px-2 pb-4" : "px-3 pb-5"
          }`}
        >
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="group/logout relative flex w-full items-center justify-center rounded-[14px] px-3 py-3 font-sans text-sm font-semibold text-[#FFF0DA]/88 transition-all duration-250 hover:bg-[#FFF0DA]/10 hover:text-[#FFF0DA] lg:justify-start lg:gap-3 lg:px-4"
          >
            <ArrowLeft size={17} className="shrink-0" />
            <span
              className={`hidden font-sans text-sm font-semibold transition-all duration-250 lg:inline ${
                isSidebarCollapsed
                  ? "w-0 overflow-hidden opacity-0"
                  : "w-auto overflow-visible opacity-100"
              }`}
            >
              Logout
            </span>

            {isSidebarCollapsed && (
              <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0D2E18] px-2 py-1 font-sans text-xs font-semibold text-[#FFF0DA] opacity-0 shadow-lg transition-opacity duration-200 group-hover/logout:pointer-events-auto group-hover/logout:opacity-100">
                Logout
              </div>
            )}
          </button>
        </div>
      </aside>

      <div
        className={`min-h-screen transition-all duration-250 ${
          isSidebarCollapsed ? "lg:pl-[70px]" : "lg:pl-[232px]"
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-[#DCCFB8] bg-[#FFF0DA]/96 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-6">
            <div className="flex items-center gap-3 min-w-0">
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
                  {pathname.includes("encode-order")
                    ? "Encode Order"
                    : pathname.includes("order-history")
                    ? "Order History"
                    : "Order Queue"}
                </h1>
                <p className="mt-0.5 text-sm text-[#8C7A64]">
                  {pathname.includes("encode-order")
                    ? "Create walk-in pickup or delivery orders"
                    : pathname.includes("order-history")
                    ? "View past orders, search, and manage historical records"
                    : "Manage and monitor customer orders in real time"}
                </p>
              </div>
            </div>

            <div className="ml-2 flex shrink-0 items-center justify-end" id="staff-header-controls" />
          </div>
        </header>

        <main
          className={`min-w-0 px-4 sm:px-5 lg:px-6 ${pathname.includes("encode-order") ? "py-1 lg:py-1" : "py-4 lg:py-5"}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

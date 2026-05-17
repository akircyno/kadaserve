"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  History,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
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
    icon: PenLine,
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
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isEncodeOrder = pathname.includes("encode-order");
  const isOrderHistory = pathname.includes("order-history");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    function syncSidebarState() {
      setIsMobileSidebarOpen(false);
    }

    syncSidebarState();
    mediaQuery.addEventListener("change", syncSidebarState);

    return () => mediaQuery.removeEventListener("change", syncSidebarState);
  }, []);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setIsSidebarCollapsed(isMobile);
  }, []);

  function toggleSidebarCollapse() {
    setIsSidebarCollapsed((prev) => !prev);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/logout", {
        method: "POST",
      });

      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmOpen(false);
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
        className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-hidden rounded-r-[24px] bg-[#083C1F] text-[#FFF8EF] shadow-[12px_0_30px_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out lg:translate-x-0 ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          isSidebarCollapsed ? "w-16" : "w-56"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-5">
          <Link
            href="/staff"
            className={`min-w-0 font-sans transition-all duration-300 ${
              isSidebarCollapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
            }`}
          >
            <span className="block text-lg font-bold leading-none text-[#FFF8EF]">
              KadaServe
            </span>
            <span className="mt-1 block text-xs text-[#8C7A64]">
              Staff Workspace
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleSidebarCollapse}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden lg:flex items-center justify-center rounded-full p-1.5 text-[#8C7A64] transition hover:bg-[#FFF8EF]/10 hover:text-[#FFF8EF]"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-label="Close staff navigation"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF8EF]/10 text-[#FFF8EF] transition hover:bg-[#FFF8EF]/18 lg:hidden"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <nav
          className={`mb-2 mt-8 space-y-1 transition-all duration-300 ${
            isSidebarCollapsed ? "px-2" : "px-3"
          }`}
        >
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
                title={isSidebarCollapsed ? item.label : undefined}
                className={`flex w-full items-center rounded-xl px-3 py-2.5 font-sans text-sm transition-all duration-200 ${
                  isSidebarCollapsed ? "justify-center" : "justify-start gap-3"
                } ${
                  isActive
                    ? "bg-[#FFF8EF] font-medium text-[#0D2E18]"
                    : "text-[#8C7A64] hover:bg-[#FFF8EF]/10 hover:text-[#FFF8EF]"
                }`}
              >
                <Icon size={20} className="shrink-0" />
                <span
                  className={`text-sm transition-all duration-200 ${
                    isSidebarCollapsed
                      ? "w-0 overflow-hidden opacity-0"
                      : "w-auto opacity-100"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div
          className={`mt-auto transition-all duration-300 ${
            isSidebarCollapsed ? "px-2 pb-5" : "px-3 pb-5"
          }`}
        >
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            title={isSidebarCollapsed ? "Sign out" : undefined}
            className={`flex w-full items-center rounded-xl px-3 py-2.5 font-sans text-sm transition-all duration-200 ${
              isSidebarCollapsed ? "justify-center" : "justify-start gap-3"
            } text-[#FFF0D8]/76 hover:bg-[#9C543D]/18 hover:text-[#FFF8EF]`}
          >
            <LogOut size={20} className="shrink-0" />
            <span
              className={`text-sm transition-all duration-200 ${
                isSidebarCollapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
              }`}
            >
              Sign out
            </span>
          </button>
        </div>
      </aside>

      <div
        className={`min-h-screen transition-all duration-300 ${
          isSidebarCollapsed ? "lg:pl-16" : "lg:pl-56"
        } ${isEncodeOrder ? "lg:flex lg:h-screen lg:flex-col lg:overflow-hidden" : ""}`}
      >
        <header className="sticky top-0 z-30 shrink-0 border-b border-[#D8C5A8] bg-[linear-gradient(90deg,#FFF8EF_0%,#FFF4E6_55%,#F8E7CC_100%)] shadow-[0_12px_28px_rgba(104,75,53,0.09)] backdrop-blur">
          <div className="flex min-h-[84px] flex-col items-stretch justify-center gap-3 px-4 py-3 sm:px-5 lg:px-6 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="flex min-w-0 items-center gap-3 2xl:w-auto">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                aria-label="Open staff navigation"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D6C6AC] bg-[#FFFCF7]/85 text-[#684B35] shadow-[0_6px_14px_rgba(104,75,53,0.08)] transition hover:bg-[#FFF8EF] lg:hidden"
              >
                <MenuIcon size={18} />
              </button>

              <div className="hidden h-12 w-1.5 shrink-0 rounded-full bg-[#0D2E18] shadow-[0_0_0_4px_rgba(13,46,24,0.07)] sm:block" />

              <div className="min-w-0 flex-1 2xl:flex-none">
                <p className="font-sans text-[11px] font-black uppercase tracking-[0.18em] text-[#684B35]">
                  Staff Workspace
                </p>
                <h1 className="truncate font-sans text-[1.45rem] font-black leading-tight text-[#0D2E18] sm:text-[1.65rem]">
                  {isEncodeOrder
                    ? "Encode Order"
                    : isOrderHistory
                    ? "Order History"
                    : "Order Queue"}
                </h1>
                <p className="mt-0.5 max-w-[42rem] truncate font-sans text-sm font-medium text-[#7D6B55]">
                  {isEncodeOrder
                    ? "Create walk-in counter orders"
                    : isOrderHistory
                    ? "View past orders, search, and manage historical records"
                    : "Manage and monitor customer orders in real time"}
                </p>
              </div>
            </div>

            <div className="flex w-full max-w-full items-center justify-start overflow-x-auto rounded-full border border-[#D8C5A8] bg-[#FFFCF7]/78 px-2 py-1 shadow-[0_8px_18px_rgba(104,75,53,0.06)] empty:hidden sm:justify-end 2xl:ml-auto 2xl:w-auto 2xl:shrink-0" id="staff-header-controls" />
          </div>
        </header>

        <main
          className={`min-w-0 px-4 sm:px-5 lg:px-6 ${
            isEncodeOrder
              ? "py-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden"
              : "py-4 lg:py-5"
          }`}
        >
          {children}
        </main>
      </div>
      {isLogoutConfirmOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0D2E18]/45 backdrop-blur-sm"
            onClick={() => !isLoggingOut && setIsLogoutConfirmOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-[24px] border border-[#DCCFB8] bg-white p-5 shadow-[0_20px_50px_rgba(13,46,24,0.15)]">
            <h2 className="font-sans text-xl font-black text-[#0D2E18]">
              Log out?
            </h2>
            <p className="mt-2 font-sans text-sm font-semibold leading-6 text-[#684B35]">
              Are you sure you want to log out?
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-[14px] bg-[#9C543D] px-4 py-3 font-sans text-sm font-black text-[#FFF0D8] transition hover:bg-[#8A4632] disabled:opacity-60"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                disabled={isLoggingOut}
                className="rounded-[14px] border border-[#DCCFB8] bg-white px-4 py-3 font-sans text-sm font-black text-[#684B35] transition hover:bg-[#FFF0DA] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

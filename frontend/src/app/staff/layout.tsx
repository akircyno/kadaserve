"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, LogOut, Pencil } from "lucide-react";
import { useState } from "react";

export default function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
  ];

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
    }
  }

  return (
    <div className="min-h-screen bg-[#FFF0DA] pb-16 text-[#0D2E18] md:pb-0">
      <div className="min-h-screen md:grid md:grid-cols-[76px_minmax(0,1fr)]">
        <aside className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center border-t border-[#FFF0DA]/12 bg-[#0D2E18] px-3 text-[#FFF0DA] shadow-[0_-10px_24px_rgba(13,46,24,0.12)] md:sticky md:top-0 md:h-screen md:flex-col md:rounded-r-[20px] md:border-t-0 md:px-0 md:py-4 md:shadow-[8px_0_22px_rgba(13,46,24,0.12)]">
          <div className="hidden md:block">
            <Link
              href="/staff"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0DA] font-display text-lg font-semibold leading-none text-[#0D2E18]"
              aria-label="KadaServe Staff"
            >
              KS
            </Link>
          </div>

          <nav className="flex w-full flex-1 items-center justify-center gap-2 md:mt-8 md:flex-none md:flex-col md:px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/staff" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`group relative flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-2 font-sans text-xs font-semibold leading-tight transition md:w-12 md:flex-none md:px-0 ${
                    isActive
                      ? "bg-[#FFF0DA] text-[#0D2E18] shadow-[0_8px_18px_rgba(0,0,0,0.10)]"
                      : "text-[#FFF0DA]/82 hover:bg-[#FFF0DA]/10 hover:text-[#FFF0DA]"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="md:sr-only">{item.label}</span>
                  <span className="pointer-events-none absolute left-[58px] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-[#0D2E18] px-3 py-2 text-xs font-semibold text-[#FFF0DA] shadow-[0_8px_18px_rgba(13,46,24,0.18)] md:group-hover:block">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto md:mb-1 md:ml-0 md:mt-auto md:px-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Logout"
              className="group relative flex h-12 min-w-[84px] items-center justify-center gap-2 rounded-2xl px-3 font-sans text-xs font-semibold text-[#FFF0DA]/82 transition hover:bg-[#FFF0DA]/10 hover:text-[#FFF0DA] disabled:opacity-60 md:w-12 md:min-w-0 md:px-0"
            >
              <LogOut size={18} className="shrink-0" />
              <span className="md:sr-only">
                {isLoggingOut ? "Logging out..." : "Logout"}
              </span>
              <span className="pointer-events-none absolute left-[58px] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-[#0D2E18] px-3 py-2 text-xs font-semibold text-[#FFF0DA] shadow-[0_8px_18px_rgba(13,46,24,0.18)] md:group-hover:block">
                {isLoggingOut ? "Logging out..." : "Logout"}
              </span>
            </button>
          </div>
        </aside>

        <div className="min-w-0 bg-[#FFF0DA]">{children}</div>
      </div>
    </div>
  );
}

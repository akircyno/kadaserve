"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Pencil } from "lucide-react";
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
    <div className="min-h-screen bg-[#FFF0DA] text-[#0D2E18]">
      <div className="grid min-h-screen grid-cols-[156px_minmax(0,1fr)]">
        <aside
          className="sticky top-0 z-50 flex h-screen w-[156px] flex-col overflow-hidden rounded-r-[10px] bg-[#0D2E18] py-7 text-[#FFF0DA]"
        >
          <Link
            href="/staff"
            className="flex h-7 items-center overflow-hidden px-6 font-sans text-lg font-bold leading-none text-[#FFF0DA]"
          >
            <span className="shrink-0">KadaServe</span>
          </Link>

          <nav className="mt-[84px] flex w-full flex-col">
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
                  className={`ml-3 flex h-8 w-[calc(100%-12px)] items-center gap-2 overflow-hidden px-2 font-sans text-xs font-semibold leading-none transition ${
                    isActive
                      ? "rounded-l-[8px] bg-[#FFF0DA] text-[#0D2E18]"
                      : "text-[#FFF0DA]/82 hover:bg-[#FFF0DA]/10 hover:text-[#FFF0DA]"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="whitespace-nowrap">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto px-[30px] pb-1">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Logout"
              className="flex h-8 items-center gap-2 overflow-hidden font-sans text-xs font-semibold text-[#FFF0DA] transition hover:text-white disabled:opacity-60"
            >
              <ArrowLeft size={14} className="shrink-0" />
              <span className="whitespace-nowrap">
                {isLoggingOut ? "Leaving" : "Logout"}
              </span>
            </button>
          </div>
        </aside>

        <div className="min-w-0 bg-[#FFF0DA]">{children}</div>
      </div>
    </div>
  );
}

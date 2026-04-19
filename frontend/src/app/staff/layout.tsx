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
    <div className="min-h-screen bg-[#FFF0DA] text-[#0D2E18]">
      <div className="grid min-h-screen grid-cols-[188px_minmax(0,1fr)]">
        <aside className="sticky top-0 flex h-screen flex-col rounded-r-[26px] bg-[#0D2E18] text-[#FFF0DA] shadow-[10px_0_28px_rgba(13,46,24,0.14)]">
          <div className="px-7 pt-8">
            <Link
              href="/staff"
              className="block font-display text-[2rem] font-semibold leading-none tracking-[-0.04em] text-[#FFF0DA]"
            >
              KadaServe
            </Link>
          </div>

          <nav className="mt-28 space-y-2 pl-4 pr-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/staff" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 font-sans text-sm font-semibold leading-tight transition ${isActive
                      ? "relative -mr-0.8 rounded-l-[14px] rounded-r-none bg-[#FFF0DA] text-[#0D2E18] shadow-[0_8px_18px_rgba(0,0,0,0.10)]"
                      : "rounded-[14px] text-[#FFF0DA]/88 hover:bg-[#FFF0DA]/10 hover:text-[#FFF0DA]"
                    }`}

                >
                  <Icon size={17} className="shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto px-4 pb-7">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-3 rounded-[14px] px-4 py-3 font-sans text-sm font-semibold text-[#FFF0DA]/88 transition hover:bg-[#FFF0DA]/10 hover:text-[#FFF0DA] disabled:opacity-60"
            >
              <LogOut size={17} className="shrink-0" />
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </aside>

        <div className="min-w-0 bg-[#FFF0DA]">{children}</div>
      </div>
    </div>
  );
}

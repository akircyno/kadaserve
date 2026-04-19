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

  return (
    <div className="min-h-screen bg-[#FFF0DA] text-[#0D2E18]">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-30 flex w-[174px] flex-col justify-between rounded-r-[24px] bg-[#0D2E18] py-8 text-[#FFF0DA]">
          <div>
            <Link
              href="/staff"
              className="block px-8 font-display text-3xl font-semibold text-[#FFF0DA]"
            >
              KadaServe
            </Link>

            <nav className="mt-28 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/staff" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-6 py-3 font-sans text-base font-semibold transition ${
                      isActive
                        ? "bg-[#FFF0DA] text-[#0D2E18]"
                        : "text-[#FFF0DA] hover:bg-[#FFF0DA]/10"
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mx-6 flex items-center gap-3 rounded-[12px] px-3 py-3 font-sans text-base font-semibold text-[#FFF0DA] transition hover:bg-[#FFF0DA]/10 disabled:opacity-60"
          >
            <LogOut size={18} />
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </aside>

        <div className="ml-[174px] min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

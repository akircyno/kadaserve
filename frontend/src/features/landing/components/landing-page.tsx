import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardList,
  Coffee,
  Flame,
  Laptop,
  LineChart,
  PackageCheck,
  Smartphone,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { LandingNavbar } from "@/features/landing/components/landing-navbar";

const analyticsCards = [
  {
    icon: LineChart,
    label: "Orders",
    title: "Hourly Trend",
    value: "14 orders",
    helper: "4PM spike",
  },
  {
    icon: Flame,
    label: "Peak Hour",
    title: "Heatmap",
    value: "9AM-11AM",
    helper: "highest density",
  },
  {
    icon: Star,
    label: "Satisfaction",
    title: "Trend",
    value: "4.7 / 5",
    helper: "from feedback",
  },
  {
    icon: Brain,
    label: "Recommended",
    title: "Item",
    value: "Spanish Latte",
    helper: "preference score",
  },
];

const systemFlow = [
  { label: "Customer", detail: "Browse, customize, and place an order", icon: Smartphone },
  { label: "Order", detail: "Pickup, delivery, or walk-in data is captured", icon: Coffee },
  { label: "Staff Processing", detail: "Queue moves one clear status at a time", icon: ClipboardList },
  { label: "Admin Analytics", detail: "Trends, peaks, rankings, and scores update", icon: BarChart3 },
  { label: "Smarter Decisions", detail: "Menu, demand, and preferences become easier to analyze", icon: Brain },
];

const roleCards = [
  {
    icon: Smartphone,
    eyebrow: "Customer Experience",
    title: "Simple ordering. Transparent tracking. Better experience.",
    items: ["Browse menu", "Customize drink", "Track order", "Leave feedback"],
  },
  {
    icon: Users,
    eyebrow: "Staff Experience",
    title: "Clear queue. Faster workflow. Fewer mistakes.",
    items: ["Order queue", "Status updates", "Encode orders", "Payment visibility"],
  },
  {
    icon: Laptop,
    eyebrow: "Admin Experience",
    title: "Real data. Real insights. Better decisions.",
    items: ["Dashboard", "Analytics", "Peak hours", "Item ranking"],
  },
];

const dashboardRows = [
  { item: "Spanish Latte", orders: 42, score: "0.91" },
  { item: "Strawberry Matcha", orders: 36, score: "0.87" },
  { item: "Red Velvet Cookie", orders: 22, score: "0.74" },
];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FFF0DA] font-sans text-[#0D2E18] selection:bg-[#0F441D] selection:text-white">
      <LandingNavbar />

      <main>
        <section className="relative isolate px-4 pb-12 pt-28 md:px-8 lg:px-16 lg:pb-14 lg:pt-28">
          <div className="absolute left-[-12rem] top-20 -z-10 h-[36rem] w-[36rem] rounded-full bg-[#0F441D]/15 blur-3xl" />
          <div className="absolute bottom-[-8rem] right-[-10rem] -z-10 h-[34rem] w-[34rem] rounded-full bg-[#684B35]/12 blur-3xl" />

          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center xl:gap-12">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-3 rounded-full border border-[#0F441D]/20 bg-white/70 px-4 py-2 text-sm font-bold text-[#0F441D] shadow-sm">
                <Brain className="h-4 w-4" />
                Data-driven cafe system
              </div>

              <h1 className="mt-6 max-w-4xl break-words font-sans text-4xl font-bold leading-[1.02] tracking-tight text-[#0D2E18] sm:text-5xl md:text-6xl lg:mt-7 lg:text-7xl lg:leading-[0.92] lg:tracking-[-0.05em]">
                From guesswork to data-driven cafe decisions.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-[#684B35] md:text-lg md:leading-8 lg:mt-7 lg:text-xl">
                KadaServe connects customer ordering, staff processing, and
                admin analytics in one workflow for small cafe teams.
              </p>
              <p className="mt-4 max-w-2xl text-sm font-bold leading-6 text-[#0F441D] md:text-base md:leading-7 lg:text-lg">
                Powered by time-series analytics, customer preference scoring,
                and real transaction data.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/customer?splash=1"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0F441D] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#0F441D]/20 transition hover:-translate-y-0.5 hover:bg-[#0D2E18] sm:w-auto"
                >
                  Open KadaServe
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <a
                  href="#dashboard"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#0D2E18]/25 bg-white/45 px-8 py-4 text-base font-bold text-[#0D2E18] transition hover:bg-white sm:w-auto"
                >
                  See analytics preview
                </a>
              </div>
            </div>

            <div className="relative min-w-0">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-white/35 blur-2xl sm:-inset-8 sm:rounded-[3rem]" />
              <div className="w-full max-w-full rounded-[1.75rem] border border-white/80 bg-white/80 p-3 shadow-2xl shadow-[#0D2E18]/12 backdrop-blur sm:rounded-[2.5rem] sm:p-4">
                <div className="overflow-hidden rounded-[1.5rem] bg-[#0D2E18] p-4 text-[#FFF0DA] sm:rounded-[2rem] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#FFF0DA]/55">
                        Live analytics engine
                      </p>
                      <h2 className="mt-2 font-sans text-2xl font-bold sm:text-3xl">
                        Real cafe signals
                      </h2>
                    </div>
                    <div className="rounded-full bg-[#FFF0DA] px-4 py-2 text-sm font-bold text-[#0D2E18]">
                      Active
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-7 sm:grid-cols-2">
                    {analyticsCards.map((card) => {
                      const Icon = card.icon;

                      return (
                        <div
                          key={card.label}
                          className="min-w-0 rounded-[1.5rem] bg-[#FFF0DA] p-4 text-[#0D2E18]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <Icon className="h-5 w-5 text-[#684B35]" />
                            <span className="truncate rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0F441D]">
                              {card.label}
                            </span>
                          </div>
                          <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                            {card.title}
                          </p>
                          <p className="mt-1 break-words font-sans text-xl font-bold leading-none sm:text-2xl">
                            {card.value}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#684B35]">
                            {card.helper}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 max-w-full rounded-[1.5rem] border border-[#FFF0DA]/15 bg-white/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
                      <p className="font-bold">Hourly order trend</p>
                      <p className="text-sm font-semibold text-[#FFF0DA]/70">
                        time-series
                      </p>
                    </div>
                    <div className="mt-4 flex h-20 max-w-full items-end gap-1 sm:gap-2">
                      {[32, 44, 52, 78, 91, 64, 48, 72, 58, 36].map(
                        (height, index) => (
                          <div
                            key={`${height}-${index}`}
                            className="flex-1 rounded-t-lg bg-[#FFF0DA]"
                            style={{ height: `${height}%` }}
                          />
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-y border-[#DCCFB8] bg-white/70 px-4 py-14 md:px-8 md:py-20 lg:px-16 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#684B35]">
                  System flow
                </p>
                <h2 className="mt-4 font-sans text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl lg:tracking-[-0.04em]">
                  One system, different roles in one workflow.
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-[#684B35] md:text-lg md:leading-8">
                KadaServe is not just a customer page, staff board, or admin
                report. It connects the full path from order placement to
                smarter cafe decisions.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 md:mt-12 md:grid-cols-2 lg:grid-cols-5">
              {systemFlow.map((item, index) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="relative min-w-0 rounded-[2rem] border border-[#DCCFB8] bg-[#FFF0DA] p-6 shadow-sm"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F441D] text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-[#684B35]">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-3 break-words font-sans text-xl font-bold lg:text-2xl">
                      {item.label}
                    </h3>
                    <p className="mt-4 text-sm leading-6 text-[#684B35]">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="features" className="px-4 py-14 md:px-8 md:py-20 lg:px-16 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#684B35]">
                Role experiences
              </p>
              <h2 className="mt-4 font-sans text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl lg:tracking-[-0.04em]">
                Customer, staff, and admin all see the same operation from the
                right angle.
              </h2>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 md:mt-12 md:grid-cols-2 lg:grid-cols-3">
              {roleCards.map((role) => {
                const Icon = role.icon;

                return (
                  <div
                    key={role.eyebrow}
                    className="min-w-0 rounded-[2rem] border border-[#DCCFB8] bg-white/70 p-6 shadow-sm md:p-7"
                  >
                    <Icon className="h-10 w-10 text-[#0F441D]" />
                    <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-[#684B35]">
                      {role.eyebrow}
                    </p>
                    <h3 className="mt-3 break-words font-sans text-2xl font-bold md:text-3xl">
                      {role.title}
                    </h3>
                    <ul className="mt-6 space-y-3">
                      {role.items.map((item) => (
                        <li key={item} className="flex items-center gap-3 font-semibold text-[#684B35]">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0F441D]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="dashboard" className="bg-[#0D2E18] px-4 py-14 text-[#FFF0DA] md:px-8 md:py-16 lg:px-16">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="min-w-0 space-y-6 md:space-y-7">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#FFF0DA]/60">
                Admin dashboard
              </p>
              <h2 className="break-words font-sans text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl lg:tracking-[-0.04em]">
                Analytics powered by real café transaction data.
              </h2>
              <span className="inline-flex rounded-full border border-[#FFF0DA]/18 bg-white/10 px-3 py-1 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-[#FFF0DA]/70">
                Sample data — preview only
              </span>
              <p className="text-base leading-7 text-[#FFF0DA]/75 md:text-lg md:leading-8">
                This is where the panel can see the logic: time-series
                analytics, peak-hour detection, satisfaction trend, item ranking,
                and recommendation scoring.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  "Time-series analytics",
                  "Peak-hour detection",
                  "Customer preference scoring",
                  "Recommendation engine",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#FFF0DA]/15 bg-white/10 p-4"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#FFF0DA]" />
                    <span className="font-bold">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-[1.75rem] border border-[#FFF0DA]/20 bg-[#FFF0DA] p-4 text-[#0D2E18] shadow-2xl shadow-black/20 sm:rounded-[2.5rem] sm:p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                {[
                  ["Orders", "142"],
                  ["Gross", "\u20B112.4k"],
                  ["Peak", "9AM"],
                  ["Rating", "4.7"],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-3xl bg-white p-4">
                    <p className="text-sm font-bold text-[#684B35]">{label}</p>
                    <p className="mt-2 break-words font-sans text-2xl font-bold sm:text-3xl">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="min-w-0 rounded-[2rem] bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#684B35]">
                        Orders
                      </p>
                      <h3 className="font-sans text-xl font-bold sm:text-2xl">
                        Hourly Trend
                      </h3>
                    </div>
                    <LineChart className="h-7 w-7 shrink-0 text-[#0F441D]" />
                  </div>
                  <div className="mt-6 flex h-36 max-w-full items-end gap-1 rounded-3xl bg-[#FFF0DA] p-3 sm:h-44 sm:gap-2 sm:p-4">
                    {[34, 52, 44, 78, 91, 64, 48, 88, 70, 42].map(
                      (height, index) => (
                        <div
                          key={`${height}-${index}`}
                          className="flex-1 rounded-t-lg bg-[#684B35]"
                          style={{ height: `${height}%` }}
                        />
                      )
                    )}
                  </div>
                </div>

                <div className="min-w-0 space-y-5">
                  <div className="rounded-[2rem] bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-sans text-xl font-bold sm:text-2xl">
                        Peak Heatmap
                      </h3>
                      <Flame className="h-7 w-7 shrink-0 text-[#684B35]" />
                    </div>
                    <div className="mt-5 grid grid-cols-5 gap-2">
                      {Array.from({ length: 25 }).map((_, index) => (
                        <div
                          key={index}
                          className={`h-8 rounded-lg ${
                            [6, 7, 11, 12, 13, 17].includes(index)
                              ? "bg-[#684B35]"
                              : [2, 8, 16, 18, 22].includes(index)
                                ? "bg-[#0F441D]/60"
                                : "bg-[#0F441D]/10"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[2rem] bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-sans text-xl font-bold sm:text-2xl">
                        Recommended Item
                      </h3>
                      <Brain className="h-7 w-7 shrink-0 text-[#0F441D]" />
                    </div>
                    <p className="mt-4 text-lg font-bold">Spanish Latte</p>
                    <p className="text-sm font-semibold text-[#684B35]">
                      Preference score: 0.91
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[2rem] bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-sans text-xl font-bold sm:text-2xl">
                    Item Ranking
                  </h3>
                  <PackageCheck className="h-7 w-7 shrink-0 text-[#0F441D]" />
                </div>
                <div className="mt-5 space-y-3">
                  {dashboardRows.map((row, index) => (
                    <div
                      key={row.item}
                      className="grid grid-cols-[28px_minmax(0,1fr)_44px_54px] items-center gap-2 rounded-2xl bg-[#FFF0DA] px-3 py-3 text-xs font-bold sm:grid-cols-[40px_minmax(0,1fr)_70px_80px] sm:gap-3 sm:px-4 sm:text-sm"
                    >
                      <span>{index + 1}</span>
                      <span className="min-w-0 truncate">{row.item}</span>
                      <span>{row.orders}</span>
                      <span>{row.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#DCCFB8] bg-[#FFF0DA] px-4 py-8 text-center">
        <p className="text-sm font-semibold text-[#684B35]">
          (c) {new Date().getFullYear()} KadaServe. Cafe ordering and analytics system.
        </p>
      </footer>
    </div>
  );
}

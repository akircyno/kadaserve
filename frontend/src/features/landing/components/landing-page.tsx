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
  MessageSquareText,
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
  { label: "Smarter Decisions", detail: "Menu, staffing, and inventory become easier to plan", icon: Brain },
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
    <div className="min-h-screen overflow-hidden bg-[#FFF0DA] font-sans text-[#0D2E18] selection:bg-[#0F441D] selection:text-white">
      <LandingNavbar />

      <main>
        <section className="relative isolate px-4 pb-14 pt-28 sm:px-6 lg:px-8 lg:pb-20 lg:pt-32">
          <div className="absolute left-[-12rem] top-20 -z-10 h-[36rem] w-[36rem] rounded-full bg-[#0F441D]/15 blur-3xl" />
          <div className="absolute bottom-[-8rem] right-[-10rem] -z-10 h-[34rem] w-[34rem] rounded-full bg-[#684B35]/12 blur-3xl" />

          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-[#0F441D]/20 bg-white/70 px-4 py-2 text-sm font-bold text-[#0F441D] shadow-sm">
                <Brain className="h-4 w-4" />
                Data-driven cafe system
              </div>

              <h1 className="mt-7 max-w-4xl font-display text-[clamp(3.2rem,6.2vw,6rem)] font-bold leading-[0.92] tracking-[-0.05em] text-[#0D2E18]">
                From guesswork to data-driven cafe decisions.
              </h1>

              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#684B35] md:text-xl">
                KadaServe connects customer ordering, staff processing, and
                admin analytics in one workflow for small cafe teams.
              </p>
              <p className="mt-4 max-w-2xl text-base font-bold leading-7 text-[#0F441D] md:text-lg">
                Powered by time-series analytics, customer preference scoring,
                and real transaction data.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/customer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0F441D] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#0F441D]/20 transition hover:-translate-y-0.5 hover:bg-[#0D2E18]"
                >
                  Open KadaServe
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <a
                  href="#dashboard"
                  className="inline-flex items-center justify-center rounded-full border border-[#0D2E18]/25 bg-white/45 px-8 py-4 text-base font-bold text-[#0D2E18] transition hover:bg-white"
                >
                  See analytics preview
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-white/35 blur-2xl" />
              <div className="rounded-[2.5rem] border border-white/80 bg-white/80 p-4 shadow-2xl shadow-[#0D2E18]/12 backdrop-blur">
                <div className="rounded-[2rem] bg-[#0D2E18] p-5 text-[#FFF0DA]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#FFF0DA]/55">
                        Live analytics engine
                      </p>
                      <h2 className="mt-2 font-display text-3xl font-bold">
                        Real cafe signals
                      </h2>
                    </div>
                    <div className="rounded-full bg-[#FFF0DA] px-4 py-2 text-sm font-bold text-[#0D2E18]">
                      Active
                    </div>
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {analyticsCards.map((card) => {
                      const Icon = card.icon;

                      return (
                        <div
                          key={card.label}
                          className="rounded-[1.5rem] bg-[#FFF0DA] p-4 text-[#0D2E18]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <Icon className="h-5 w-5 text-[#684B35]" />
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#0F441D]">
                              {card.label}
                            </span>
                          </div>
                          <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-[#684B35]">
                            {card.title}
                          </p>
                          <p className="mt-1 font-display text-2xl font-bold leading-none">
                            {card.value}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#684B35]">
                            {card.helper}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-[1.5rem] border border-[#FFF0DA]/15 bg-white/10 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-bold">Hourly order trend</p>
                      <p className="text-sm font-semibold text-[#FFF0DA]/70">
                        time-series
                      </p>
                    </div>
                    <div className="mt-4 flex h-20 items-end gap-2">
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

        <section id="workflow" className="border-y border-[#DCCFB8] bg-white/70 px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#684B35]">
                  System flow
                </p>
                <h2 className="mt-4 font-display text-5xl font-bold leading-tight tracking-[-0.04em]">
                  One system, different roles in one workflow.
                </h2>
              </div>
              <p className="max-w-2xl text-lg leading-8 text-[#684B35]">
                KadaServe is not just a customer page, staff board, or admin
                report. It connects the full path from order placement to
                smarter cafe decisions.
              </p>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-5">
              {systemFlow.map((item, index) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="relative rounded-[2rem] border border-[#DCCFB8] bg-[#FFF0DA] p-6 shadow-sm"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F441D] text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <p className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-[#684B35]">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-3 font-display text-2xl font-bold">
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

        <section id="features" className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#684B35]">
                Role experiences
              </p>
              <h2 className="mt-4 font-display text-5xl font-bold leading-tight tracking-[-0.04em]">
                Customer, staff, and admin all see the same operation from the
                right angle.
              </h2>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {roleCards.map((role) => {
                const Icon = role.icon;

                return (
                  <div
                    key={role.eyebrow}
                    className="rounded-[2rem] border border-[#DCCFB8] bg-white/70 p-7 shadow-sm"
                  >
                    <Icon className="h-10 w-10 text-[#0F441D]" />
                    <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-[#684B35]">
                      {role.eyebrow}
                    </p>
                    <h3 className="mt-3 font-display text-3xl font-bold">
                      {role.title}
                    </h3>
                    <ul className="mt-6 space-y-3">
                      {role.items.map((item) => (
                        <li key={item} className="flex items-center gap-3 font-semibold text-[#684B35]">
                          <CheckCircle2 className="h-5 w-5 text-[#0F441D]" />
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

        <section id="dashboard" className="bg-[#0D2E18] px-4 py-24 text-[#FFF0DA] sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="space-y-7">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#FFF0DA]/60">
                Admin dashboard
              </p>
              <h2 className="font-display text-5xl font-bold leading-tight tracking-[-0.04em]">
                The CS core: analytics from real transaction data.
              </h2>
              <p className="text-lg leading-8 text-[#FFF0DA]/75">
                This is where the panel can see the logic: time-series
                analytics, peak-hour detection, satisfaction trend, item ranking,
                and recommendation scoring.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Time-series analytics",
                  "Peak-hour detection",
                  "Customer preference scoring",
                  "Recommendation engine",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-[#FFF0DA]/15 bg-white/10 p-4"
                  >
                    <CheckCircle2 className="h-5 w-5 text-[#FFF0DA]" />
                    <span className="font-bold">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-[#FFF0DA]/20 bg-[#FFF0DA] p-6 text-[#0D2E18] shadow-2xl shadow-black/20">
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["Orders", "142"],
                  ["Gross", "\u20B112.4k"],
                  ["Peak", "9AM"],
                  ["Rating", "4.7"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-3xl bg-white p-4">
                    <p className="text-sm font-bold text-[#684B35]">{label}</p>
                    <p className="mt-2 font-display text-3xl font-bold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[2rem] bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#684B35]">
                        Orders
                      </p>
                      <h3 className="font-display text-2xl font-bold">
                        Hourly Trend
                      </h3>
                    </div>
                    <LineChart className="h-7 w-7 text-[#0F441D]" />
                  </div>
                  <div className="mt-6 flex h-44 items-end gap-2 rounded-3xl bg-[#FFF0DA] p-4">
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

                <div className="space-y-5">
                  <div className="rounded-[2rem] bg-white p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-2xl font-bold">
                        Peak Heatmap
                      </h3>
                      <Flame className="h-7 w-7 text-[#684B35]" />
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

                  <div className="rounded-[2rem] bg-white p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-2xl font-bold">
                        Recommended Item
                      </h3>
                      <Brain className="h-7 w-7 text-[#0F441D]" />
                    </div>
                    <p className="mt-4 text-lg font-bold">Spanish Latte</p>
                    <p className="text-sm font-semibold text-[#684B35]">
                      Preference score: 0.91
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[2rem] bg-white p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl font-bold">
                    Item Ranking
                  </h3>
                  <PackageCheck className="h-7 w-7 text-[#0F441D]" />
                </div>
                <div className="mt-5 space-y-3">
                  {dashboardRows.map((row, index) => (
                    <div
                      key={row.item}
                      className="grid grid-cols-[40px_1fr_70px_80px] items-center gap-3 rounded-2xl bg-[#FFF0DA] px-4 py-3 text-sm font-bold"
                    >
                      <span>{index + 1}</span>
                      <span>{row.item}</span>
                      <span>{row.orders}</span>
                      <span>{row.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative px-4 py-28 text-center sm:px-6 lg:px-8">
          <div className="absolute inset-x-0 top-0 -z-10 mx-auto h-64 max-w-5xl rounded-full bg-[#0F441D]/10 blur-3xl" />
          <div className="mx-auto max-w-4xl">
            <MessageSquareText className="mx-auto h-12 w-12 text-[#0F441D]" />
            <h2 className="mt-7 font-display text-5xl font-bold leading-tight tracking-[-0.04em] md:text-6xl">
              One workflow.
              <span className="block italic text-[#0F441D]">
                Different roles. Better decisions.
              </span>
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#684B35]">
              KadaServe is designed as one connected cafe system, not separate
              screens pretending to work together.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0F441D] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#0F441D]/20 transition hover:bg-[#0D2E18]"
              >
                Sign in to KadaServe
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#workflow"
                className="rounded-full border border-[#0D2E18]/25 bg-white/60 px-8 py-4 text-base font-bold text-[#0D2E18] transition hover:bg-white"
              >
                Review system flow
              </a>
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

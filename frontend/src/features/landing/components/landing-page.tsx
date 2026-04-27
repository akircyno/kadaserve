import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Coffee,
  Laptop,
  Smartphone,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { LandingNavbar } from "@/features/landing/components/landing-navbar";

const workflowSteps = [
  {
    step: "01",
    title: "Customer Order",
    description: "Placed through the customer app or encoded by staff.",
  },
  {
    step: "02",
    title: "Data Captured",
    description: "Timestamps, items, order type, and preferences are saved.",
  },
  {
    step: "03",
    title: "Analytics Engine",
    description: "Trends, peaks, and top menu items become visible.",
  },
  {
    step: "04",
    title: "Smarter Decisions",
    description: "Adjust staffing, menu availability, and inventory with proof.",
  },
];

const roleCards = [
  {
    icon: Smartphone,
    title: "Customer App",
    items: ["Digital PWA ordering", "Live order tracking", "Personalized recommendations"],
  },
  {
    icon: Users,
    title: "Staff Portal",
    items: ["Live queue monitoring", "One-tap status updates", "Walk-in order encoding"],
  },
  {
    icon: Laptop,
    title: "Admin Hub",
    items: ["Time-series analytics", "Item performance ranking", "Menu and inventory control"],
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#FFF0DA_0%,#FFF8EF_46%,#FFF0DA_100%)] font-sans text-kada-forest selection:bg-kada-green selection:text-white">
      <LandingNavbar />

      <main>
        <section className="relative mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8 lg:pb-32 lg:pt-44">
          <div className="absolute left-8 top-32 h-72 w-72 rounded-full bg-kada-green/15 blur-3xl" />
          <div className="absolute bottom-10 right-8 h-80 w-80 rounded-full bg-kada-brown/10 blur-3xl" />
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-kada-green/25 bg-white/70 px-4 py-2 text-sm font-bold text-kada-green shadow-sm">
                <Activity className="h-4 w-4" />
                Analytics-first cafe platform
              </div>

              <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-kada-forest md:text-6xl lg:text-7xl">
                From guesswork to{" "}
                <span className="text-kada-green">data-driven</span> cafe
                decisions.
              </h1>

              <p className="max-w-2xl text-lg leading-8 text-kada-forest/75 lg:text-xl">
                KadaServe connects digital ordering, staff queue management,
                menu control, and admin analytics so small cafes can see what is
                really happening behind the counter.
              </p>

              <div className="flex flex-col gap-4 pt-2 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-kada-green px-8 py-4 font-bold text-white shadow-lg shadow-kada-green/25 transition hover:-translate-y-0.5 hover:bg-kada-forest"
                >
                  Start managing smarter
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <a
                  href="#dashboard"
                  className="inline-flex items-center justify-center rounded-full border-2 border-kada-forest/20 px-8 py-4 font-bold text-kada-forest transition hover:border-kada-forest"
                >
                  View dashboard preview
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-kada-green/25 to-transparent blur-3xl" />
              <div className="relative space-y-4 rounded-[2rem] border border-white bg-[linear-gradient(145deg,#FFFFFF_0%,#FFF8EF_55%,#FFF0DA_100%)] p-6 shadow-2xl shadow-kada-forest/10 backdrop-blur-xl transition duration-500 hover:rotate-0 lg:rotate-2">
                <div className="flex items-center justify-between border-b border-kada-forest/10 pb-4">
                  <div>
                    <p className="text-sm font-semibold text-kada-forest/60">
                      Live Intelligence
                    </p>
                    <h2 className="font-display text-2xl font-bold">
                      Today&apos;s Overview
                    </h2>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kada-green/10 ring-1 ring-kada-green/15">
                    <span className="h-3 w-3 rounded-full bg-kada-green" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-kada-brown/10 bg-white/70 p-5">
                    <TrendingUp className="mb-3 h-5 w-5 text-kada-brown" />
                    <p className="font-display text-3xl font-bold">
                      {"\u20B1"}45,200
                    </p>
                    <p className="text-sm text-kada-forest/70">
                      Gross sales preview
                    </p>
                  </div>
                  <div className="rounded-3xl border border-kada-green/10 bg-white/70 p-5">
                    <Clock className="mb-3 h-5 w-5 text-kada-green" />
                    <p className="font-display text-3xl font-bold">8:30 AM</p>
                    <p className="text-sm text-kada-forest/70">
                      Peak hour detected
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-3xl border border-kada-forest/10 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold">Top ranked item</span>
                    <span className="font-bold text-kada-brown">
                      Spanish Latte
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-kada-beige">
                    <div className="h-2 w-[85%] rounded-full bg-kada-brown" />
                  </div>
                  <div className="flex items-center justify-between pt-2 text-sm">
                    <span className="font-bold">Avg. satisfaction</span>
                    <span className="inline-flex items-center gap-1 font-bold text-kada-green">
                      <Star className="h-4 w-4 fill-current" /> 4.8/5
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-kada-forest/10 bg-white/65 py-24">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="mx-auto max-w-4xl font-display text-4xl font-bold text-kada-forest md:text-5xl">
              Running a cafe on feelings is not a sustainable strategy.
            </h2>

            <div className="mt-14 grid gap-6 text-left md:grid-cols-3">
              {[
                ["Guessing the rush", "Overstaffing when quiet, then scrambling during spikes.", Clock],
                ["Blind menu changes", "Keeping items because they seem popular, not because the data says so.", BarChart3],
                ["Lost customer context", "Regulars become strangers when ordering stays fully manual.", Users],
              ].map(([title, description, Icon]) => (
                <div
                  key={title as string}
                  className="rounded-[2rem] border border-kada-forest/10 bg-[#FFF0DA]/70 p-8 shadow-sm transition hover:-translate-y-1 hover:bg-white"
                >
                  <Icon className="mb-5 h-8 w-8 text-kada-brown/70" />
                  <h3 className="text-xl font-bold">{title as string}</h3>
                  <p className="mt-3 leading-7 text-kada-forest/70">
                    {description as string}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="overflow-hidden bg-kada-green py-24 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-4xl font-bold text-kada-beige md:text-5xl">
                Turn every transaction into intelligence.
              </h2>
              <p className="mt-5 text-lg leading-8 text-kada-beige/80">
                KadaServe turns daily cafe operations into clear business
                signals: what sells, when demand peaks, and what customers
                prefer.
              </p>
            </div>

            <div className="relative mt-16 grid gap-5 md:grid-cols-4">
              <div className="absolute left-0 top-1/2 hidden h-px w-full bg-kada-beige/20 md:block" />
              {workflowSteps.map((item) => (
                <div
                  key={item.step}
                  className="relative rounded-[2rem] border border-kada-beige/10 bg-kada-forest/55 p-6 text-center shadow-xl backdrop-blur-sm"
                >
                  <p className="font-display text-5xl font-bold text-kada-beige/35">
                    {item.step}
                  </p>
                  <h3 className="mt-3 text-lg font-bold text-kada-beige">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-kada-beige/70">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="analytics" className="mx-auto max-w-7xl space-y-28 px-4 py-24 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="rounded-[2rem] border border-kada-forest/10 bg-white p-8 shadow-xl shadow-kada-forest/5">
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-kada-forest/50">
                    Volume
                  </p>
                  <h3 className="font-display text-2xl font-bold">
                    Hourly Trends
                  </h3>
                </div>
                <span className="rounded-full bg-kada-beige px-4 py-2 text-sm font-bold">
                  Today
                </span>
              </div>
              <div className="flex h-52 items-end gap-2">
                {[40, 60, 100, 85, 45, 30, 20, 50, 70, 90, 65, 40].map((height, index) => (
                  <div
                    key={`${height}-${index}`}
                    className="flex-1 rounded-t-md bg-kada-brown/25 transition hover:bg-kada-brown"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-display text-4xl font-bold">
                See the rhythm of your cafe.
              </h2>
              <p className="mt-5 text-lg leading-8 text-kada-forest/70">
                Time-series analytics track when orders come in, so you can
                plan staffing and prep around real demand instead of instinct.
              </p>
            </div>
          </div>

          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="order-2 md:order-1">
              <h2 className="font-display text-4xl font-bold">
                Never understaff the rush again.
              </h2>
              <p className="mt-5 text-lg leading-8 text-kada-forest/70">
                Peak-hour heatmaps show your busiest windows, helping the team
                reduce wait times and prepare before the pressure hits.
              </p>
            </div>
            <div className="order-1 rounded-[2rem] border border-kada-forest/10 bg-white p-8 shadow-xl shadow-kada-forest/5 md:order-2">
              <h3 className="font-display text-2xl font-bold">Traffic Heatmap</h3>
              <div className="mt-6 grid grid-cols-7 gap-2">
                {Array.from({ length: 28 }).map((_, index) => (
                  <div
                    key={index}
                    className={`aspect-square rounded-lg ${
                      [2, 3, 9, 10, 16].includes(index)
                        ? "bg-kada-green"
                        : [1, 4, 8, 11, 15, 17].includes(index)
                          ? "bg-kada-green/60"
                          : "bg-kada-green/10"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="dashboard" className="overflow-hidden bg-kada-forest py-24 text-white">
          <div className="mx-auto mb-14 max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="font-display text-4xl font-bold text-kada-beige md:text-5xl">
              The command center
            </h2>
            <p className="mt-4 text-lg text-kada-beige/75">
              A full view of orders, sales, menu performance, and operations.
            </p>
          </div>

          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="overflow-hidden rounded-t-[2rem] border-8 border-kada-beige/20 bg-white shadow-2xl">
              <div className="flex h-10 items-center gap-2 border-b bg-kada-beige/70 px-4">
                <span className="h-3 w-3 rounded-full bg-[#C55432]" />
                <span className="h-3 w-3 rounded-full bg-[#C96A12]" />
                <span className="h-3 w-3 rounded-full bg-kada-green" />
              </div>

              <div className="flex h-[500px] bg-kada-beige/15 text-kada-forest">
                <aside className="hidden w-52 border-r border-kada-forest/10 bg-white p-5 md:block">
                  <p className="font-display text-xl font-bold text-kada-green">
                    KadaServe OS
                  </p>
                  <div className="mt-8 space-y-3 text-sm font-bold text-kada-forest/55">
                    <div className="flex items-center gap-2 rounded-xl bg-kada-green/10 p-3 text-kada-green">
                      <Activity className="h-4 w-4" /> Overview
                    </div>
                    <div className="flex items-center gap-2 p-3">
                      <Clock className="h-4 w-4" /> Live Orders
                    </div>
                    <div className="flex items-center gap-2 p-3">
                      <BarChart3 className="h-4 w-4" /> Analytics
                    </div>
                    <div className="flex items-center gap-2 p-3">
                      <Coffee className="h-4 w-4" /> Menu
                    </div>
                  </div>
                </aside>

                <div className="flex-1 overflow-hidden p-6">
                  <h3 className="font-display text-2xl font-bold">
                    Today&apos;s Performance
                  </h3>
                  <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {["Total Orders: 142", "Gross: \u20B112.4k", "Active Prep: 8", "Rating: 4.8"].map((kpi) => (
                      <div
                        key={kpi}
                        className="rounded-2xl border border-kada-forest/10 bg-white p-4 text-sm font-bold shadow-sm"
                      >
                        {kpi}
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex h-52 items-end gap-3 rounded-2xl border border-kada-forest/10 bg-white p-5 shadow-sm">
                    {[30, 50, 40, 70, 90, 60, 80].map((height, index) => (
                      <div
                        key={`${height}-${index}`}
                        className="flex-1 rounded-t-md bg-kada-brown/80"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-kada-beige py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center font-display text-4xl font-bold text-kada-forest md:text-5xl">
              One platform. Three experiences.
            </h2>

            <div className="mt-14 grid gap-7 md:grid-cols-3">
              {roleCards.map((role) => {
                const Icon = role.icon;

                return (
                  <div
                    key={role.title}
                    className="rounded-[2rem] bg-white p-8 shadow-lg shadow-kada-forest/5"
                  >
                    <Icon className="mb-6 h-10 w-10 text-kada-green" />
                    <h3 className="font-display text-2xl font-bold">
                      {role.title}
                    </h3>
                    <ul className="mt-6 space-y-3 text-kada-forest/70">
                      {role.items.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-kada-brown" />
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

        <section className="bg-kada-forest px-4 py-28 text-center">
          <h2 className="font-display text-5xl font-bold text-kada-beige md:text-6xl">
            Built for small cafes.
            <br />
            Powered by real data.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-xl leading-8 text-kada-beige/70">
            Stop guessing. Start knowing. Digitize your ordering and unlock the
            analytics behind your counter.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="rounded-full bg-kada-green px-8 py-4 text-lg font-bold text-white shadow-xl transition hover:bg-white hover:text-kada-forest"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="rounded-full border-2 border-kada-beige/30 px-8 py-4 text-lg font-bold text-kada-beige transition hover:border-kada-beige"
            >
              Open live demo
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-kada-beige/10 bg-kada-forest py-8 text-center">
        <p className="text-sm text-kada-beige/50">
          © {new Date().getFullYear()} KadaServe Analytics and PWA. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

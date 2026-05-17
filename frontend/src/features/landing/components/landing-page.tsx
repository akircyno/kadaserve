import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Coffee,
  ExternalLink,
  Heart,
  LineChart,
  MessageCircle,
  Star,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { LandingNavbar } from "@/features/landing/components/landing-navbar";

const facebookUrl = "https://www.facebook.com/KadaCafePh";

const featureCards = [
  {
    icon: Coffee,
    title: "Pick your drink",
    copy: "Browse coffee, non-coffee drinks, and pastries in one menu.",
  },
  {
    icon: CheckCircle2,
    title: "See nutrition facts",
    copy: "Check calories, protein, sugar, sodium, and more before ordering.",
  },
  {
    icon: Clock3,
    title: "Track your order",
    copy: "Follow your order from checkout to ready for pickup or delivery.",
  },
  {
    icon: Star,
    title: "Read real ratings",
    copy: "See what customers liked before choosing your next cup.",
  },
];

const nutritionFacts = [
  ["Calories", "221 kcal"],
  ["Protein", "4.2g"],
  ["Sugar", "38.1g"],
  ["Sodium", "32mg"],
];

const popularDrinks = [
  { name: "Spanish Latte", rating: "4.9", orders: "42" },
  { name: "Strawberry Matcha", rating: "4.8", orders: "36" },
  { name: "Brown Sugar Latte", rating: "4.7", orders: "31" },
];

const hourlyBars = [28, 35, 42, 64, 78, 91, 86, 72];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FFF0DA] font-sans text-[#0D2E18] selection:bg-[#0F441D] selection:text-white">
      <LandingNavbar />

      <main>
        <section className="relative isolate px-4 pb-14 pt-28 md:px-8 lg:px-16 lg:pb-16 lg:pt-32">
          <div className="absolute left-[-12rem] top-20 -z-10 h-[34rem] w-[34rem] rounded-full bg-[#0F441D]/14 blur-3xl" />
          <div className="absolute bottom-[-8rem] right-[-10rem] -z-10 h-[32rem] w-[32rem] rounded-full bg-[#684B35]/12 blur-3xl" />

          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center xl:gap-12">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-3 rounded-full border border-[#0F441D]/20 bg-white/75 px-4 py-2 text-sm font-bold text-[#0F441D] shadow-sm">
                <Coffee className="h-4 w-4" />
                Kada Cafe PH online ordering
              </div>

              <h1 className="mt-6 max-w-4xl break-words font-sans text-4xl font-bold leading-[1.02] tracking-tight text-[#0D2E18] sm:text-5xl md:text-6xl lg:mt-7 lg:text-7xl lg:leading-[0.92]">
                Your next Kada coffee is easier to choose.
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-[#684B35] md:text-lg md:leading-8 lg:mt-7 lg:text-xl">
                Order your favorite drink, check nutrition facts, track your
                order live, and read customer ratings before you buy.
              </p>
              <p className="mt-4 max-w-2xl text-sm font-bold leading-6 text-[#0F441D] md:text-base md:leading-7 lg:text-lg">
                Built for Kada Cafe customers who want coffee that is simple to
                browse, easy to order, and clear to follow.
              </p>

              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/customer?splash=1"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0F441D] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#0F441D]/20 transition hover:-translate-y-0.5 hover:bg-[#0D2E18] sm:w-auto"
                >
                  Order Now
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#0D2E18]/25 bg-white/55 px-8 py-4 text-base font-bold text-[#0D2E18] transition hover:bg-white sm:w-auto"
                >
                  Visit Facebook
                  <ExternalLink className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div className="relative min-w-0">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-white/35 blur-2xl sm:-inset-8 sm:rounded-[3rem]" />
              <div className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/85 p-3 shadow-2xl shadow-[#0D2E18]/12 backdrop-blur sm:rounded-[2.5rem] sm:p-4">
                <div className="rounded-[1.5rem] bg-[#0D2E18] p-4 text-[#FFF0DA] sm:rounded-[2rem] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#FFF0DA]/60">
                        Customer preview
                      </p>
                      <h2 className="mt-2 font-sans text-2xl font-bold sm:text-3xl">
                        French Vanilla Latte
                      </h2>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-[#FFF0DA] px-4 py-2 text-sm font-bold text-[#0D2E18]">
                      <Star className="h-4 w-4 fill-[#0D2E18]" />
                      4.8 (12)
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-[1.5rem] bg-[#FFF0DA] p-4 text-[#0D2E18]">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
                        Nutrition Facts
                      </p>
                      <div className="mt-4 space-y-3">
                        {nutritionFacts.map(([label, value]) => (
                          <div
                            key={label}
                            className="flex items-center justify-between gap-4 border-b border-[#DCCFB8] pb-2 last:border-0 last:pb-0"
                          >
                            <span className="text-sm font-semibold text-[#684B35]">
                              {label}
                            </span>
                            <span className="font-bold">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-[1.5rem] bg-white p-4 text-[#0D2E18]">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
                          Live Tracking
                        </p>
                        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs font-bold text-[#684B35]">
                          {["Paid", "Preparing", "Ready", "Pickup"].map(
                            (step, index) => (
                              <div key={step} className="min-w-0">
                                <div
                                  className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full ${
                                    index < 2
                                      ? "bg-[#0F441D] text-white"
                                      : "bg-[#FFF0DA] text-[#684B35]"
                                  }`}
                                >
                                  {index + 1}
                                </div>
                                <span className="block truncate">{step}</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] bg-white p-4 text-[#0D2E18]">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-5 w-5 text-[#0F441D]" />
                          <p className="font-bold">Customer comment</p>
                        </div>
                        <p className="mt-3 text-sm font-semibold leading-6 text-[#684B35]">
                          Creamy, sweet, and easy to reorder.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="border-y border-[#DCCFB8] bg-white/70 px-4 py-14 md:px-8 md:py-20 lg:px-16"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#684B35]">
                What customers can do
              </p>
              <h2 className="mt-4 font-sans text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
                Choose with more confidence before you order.
              </h2>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {featureCards.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="min-w-0 rounded-[2rem] border border-[#DCCFB8] bg-[#FFF8EF] p-6 shadow-sm"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F441D] text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-7 break-words font-sans text-2xl font-bold">
                      {feature.title}
                    </h3>
                    <p className="mt-4 text-sm font-semibold leading-6 text-[#684B35]">
                      {feature.copy}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="ratings" className="px-4 py-14 md:px-8 md:py-20 lg:px-16">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#684B35]">
                Ratings and feedback
              </p>
              <h2 className="mt-4 font-sans text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
                See what other customers enjoy.
              </h2>
              <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#684B35] md:text-lg md:leading-8">
                Drinks can show ratings and recent comments, so choosing a new
                favorite feels less like guessing.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {popularDrinks.map((drink, index) => (
                <div
                  key={drink.name}
                  className="rounded-[2rem] border border-[#DCCFB8] bg-white/80 p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F441D] font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0DA] px-3 py-1 text-sm font-bold text-[#0D2E18]">
                      <Star className="h-4 w-4 fill-[#0D2E18]" />
                      {drink.rating}
                    </span>
                  </div>
                  <h3 className="mt-5 font-sans text-xl font-bold">
                    {drink.name}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-[#684B35]">
                    {drink.orders} recent orders
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="analytics"
          className="bg-[#0D2E18] px-4 py-14 text-[#FFF0DA] md:px-8 md:py-16 lg:px-16"
        >
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="min-w-0 space-y-6">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#FFF0DA]/60">
                KadaServe learns from orders
              </p>
              <h2 className="break-words font-sans text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">
                Kada Cafe can see what customers love.
              </h2>
              <p className="max-w-xl text-base font-semibold leading-7 text-[#FFF0DA]/75 md:text-lg md:leading-8">
                Orders, peak hours, ratings, and feedback help show which drinks
                are popular and when customers order most.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  "Demand growth",
                  "Hourly orders",
                  "Popular drinks",
                  "Feedback summary",
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ["Demand", "+18%"],
                  ["Peak", "7PM"],
                  ["Rating", "4.8"],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-3xl bg-white p-4">
                    <p className="text-sm font-bold text-[#684B35]">{label}</p>
                    <p className="mt-2 break-words font-sans text-3xl font-bold">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="min-w-0 rounded-[2rem] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#684B35]">
                        Hourly Orders
                      </p>
                      <h3 className="font-sans text-2xl font-bold">
                        5PM to 12AM
                      </h3>
                    </div>
                    <LineChart className="h-7 w-7 shrink-0 text-[#0F441D]" />
                  </div>
                  <div className="mt-6 flex h-40 items-end gap-2 rounded-3xl bg-[#FFF0DA] p-4">
                    {hourlyBars.map((height, index) => (
                      <div
                        key={`${height}-${index}`}
                        className="flex-1 rounded-t-lg bg-[#684B35]"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[2rem] bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-sans text-xl font-bold">
                        Demand Growth
                      </h3>
                      <TrendingUp className="h-7 w-7 shrink-0 text-[#0F441D]" />
                    </div>
                    <p className="mt-4 text-3xl font-bold">+18%</p>
                    <p className="text-sm font-semibold text-[#684B35]">
                      stronger evening demand
                    </p>
                  </div>

                  <div className="rounded-[2rem] bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-sans text-xl font-bold">
                        Feedback
                      </h3>
                      <Heart className="h-7 w-7 shrink-0 text-[#9C543D]" />
                    </div>
                    <p className="mt-4 text-sm font-semibold leading-6 text-[#684B35]">
                      Customers often mention creamy lattes, matcha drinks, and
                      quick order tracking.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[2rem] bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-sans text-xl font-bold">
                    Popular Drinks
                  </h3>
                  <BarChart3 className="h-7 w-7 shrink-0 text-[#0F441D]" />
                </div>
                <div className="mt-5 space-y-3">
                  {popularDrinks.map((drink, index) => (
                    <div
                      key={drink.name}
                      className="grid grid-cols-[28px_minmax(0,1fr)_56px] items-center gap-3 rounded-2xl bg-[#FFF0DA] px-4 py-3 text-sm font-bold"
                    >
                      <span>{index + 1}</span>
                      <span className="min-w-0 truncate">{drink.name}</span>
                      <span>{drink.rating}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#DCCFB8] bg-[#FFF0DA] px-4 py-8 text-center">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm font-semibold text-[#684B35]">
            (c) {new Date().getFullYear()} KadaServe. Kada Cafe PH ordering and customer insights.
          </p>
          <a
            href={facebookUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#0F441D] hover:text-[#0D2E18]"
          >
            Kada Cafe PH Facebook
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </footer>
    </div>
  );
}

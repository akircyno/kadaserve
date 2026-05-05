import Link from "next/link";

const sections = [
  {
    title: "Account Use",
    body: "You are responsible for keeping your KadaServe account details accurate and secure. Accounts should be used only for lawful ordering, tracking, feedback, and reward activities within KadaServe.",
  },
  {
    title: "Ordering, Delivery, and Pickup",
    body: "Orders placed through KadaServe may be prepared for pickup or delivery depending on store availability. Delivery details, pickup instructions, order status, and estimated times are provided to help coordinate service.",
  },
  {
    title: "Payment and Rewards",
    body: "Payments, vouchers, discounts, and rewards are processed according to the options available during checkout. KadaServe may validate reward eligibility before applying a discount or benefit.",
  },
  {
    title: "Cancellations",
    body: "Cancellation availability may depend on the current order status. Once preparation or delivery has started, an order may no longer be cancellable through the app.",
  },
  {
    title: "Responsible Use",
    body: "Users must not misuse KadaServe, submit false information, interfere with ordering operations, or attempt to access areas of the system they are not authorized to use.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#FFF0DA] px-4 py-6 text-[#0D2E18]">
      <div className="mx-auto max-w-3xl rounded-[24px] border border-[#DCCFB8] bg-[#FFF8EF] p-5 shadow-[0_18px_44px_rgba(13,46,24,0.12)] sm:p-8">
        <Link
          href="/login"
          className="font-sans text-sm font-bold text-[#684B35] transition hover:text-[#0F441D]"
        >
          Back to Login
        </Link>

        <div className="mt-5">
          <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
            KadaServe
          </p>
          <h1 className="mt-2 font-sans text-4xl font-black tracking-tight">
            Terms and Conditions
          </h1>
          <p className="mt-3 font-sans text-sm leading-6 text-[#684B35]">
            These placeholder terms explain the basic responsibilities for using
            KadaServe while the final legal copy is being prepared.
          </p>
        </div>

        <div className="mt-7 space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="rounded-[18px] bg-white p-4">
              <h2 className="font-sans text-lg font-black">{section.title}</h2>
              <p className="mt-2 font-sans text-sm leading-6 text-[#684B35]">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

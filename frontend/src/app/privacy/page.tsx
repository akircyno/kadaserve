import Link from "next/link";

const sections = [
  {
    title: "Data We Collect",
    body: "KadaServe may collect your name, email address, phone number, delivery address, order history, feedback, reward activity, and system usage data when you use the app.",
  },
  {
    title: "How We Use Data",
    body: "Your data is used for order processing, delivery or pickup coordination, customer support, analytics, customer preference scoring, recommendations, rewards, and service improvement.",
  },
  {
    title: "Authentication and Database",
    body: "KadaServe uses Supabase for authentication, database storage, and related account services. Account access is managed through Supabase Auth.",
  },
  {
    title: "Notifications",
    body: "KadaServe may use email notifications to send account messages, order updates, delivery or pickup updates, and other service-related information.",
  },
  {
    title: "Your Choices",
    body: "You may edit your profile details, delivery information, and feedback where the app provides those controls. Some order records may be retained for analytics, reporting, and service reliability.",
  },
];

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-3 font-sans text-sm leading-6 text-[#684B35]">
            This placeholder policy describes how KadaServe handles customer
            information while the final privacy policy is being prepared.
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

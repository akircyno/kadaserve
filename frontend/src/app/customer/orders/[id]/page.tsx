import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type OrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  addons: string[] | null;
  size: string;
  temperature: string;
  menu_items: {
    name: string;
  } | null;
};

type Order = {
  id: string;
  order_type: "pickup" | "delivery";
  status:
    | "pending"
    | "preparing"
    | "ready"
    | "out_for_delivery"
    | "delivered"
    | "completed"
    | "cancelled";
  total_amount: number;
  ordered_at: string;
  order_items: OrderItem[];
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function peso(value: number) {
  return `₱${Math.round(value)}`;
}

function formatOrderCode(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function formatStatus(status: Order["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready";
    case "out_for_delivery":
      return "Out for Delivery";
    case "delivered":
      return "Delivered";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function getOrderSteps(orderType: Order["order_type"]) {
  if (orderType === "pickup") {
    return [
      { key: "pending", label: "Pending" },
      { key: "preparing", label: "Preparing" },
      { key: "ready", label: "Ready for Pickup" },
      { key: "completed", label: "Completed" },
    ];
  }

  return [
    { key: "pending", label: "Pending" },
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: "Ready" },
    { key: "out_for_delivery", label: "Out for Delivery" },
    { key: "delivered", label: "Delivered" },
  ];
}

function getCurrentStepIndex(order: Order) {
  const steps = getOrderSteps(order.order_type);
  return steps.findIndex((step) => step.key === order.status);
}

function formatAddons(addons: string[] | null) {
  if (!addons || addons.length === 0) return "";

  return addons
    .map((addon) =>
      addon
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    )
    .join(", ");
}

export default async function OrderTrackingPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
        id,
        order_type,
        status,
        total_amount,
        ordered_at,
        order_items (
          id,
          quantity,
          unit_price,
          addons,
          size,
          temperature,
          menu_items (
            name
          )
        )
      `
    )
    .eq("id", id)
    .eq("customer_id", user.id)
    .single();

  if (error || !order) {
    notFound();
  }

  const typedOrder = order as Order;
  const steps = getOrderSteps(typedOrder.order_type);
  const currentStepIndex = getCurrentStepIndex(typedOrder);
  const isCancelled = typedOrder.status === "cancelled";

  return (
    <main className="min-h-screen bg-[#F8EBCF] px-4 py-6 text-[#123E26]">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[28px] bg-[#4A250F] px-6 py-6 text-[#FFF4E7] shadow-[0_16px_40px_rgba(40,18,8,0.25)]">
          <h1 className="font-display text-4xl font-semibold">Track Order</h1>
          <p className="mt-2 text-lg text-[#F2D1A5]">
            {formatOrderCode(typedOrder.id)}
          </p>
        </div>

        <section className="mt-5 rounded-[28px] bg-white/90 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
          <div className="mb-6">
            <span
              className={`inline-flex rounded-full px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] ${
                isCancelled
                  ? "bg-[#FBE9E2] text-[#9C543D]"
                  : "bg-[#F6E8D6] text-[#C68733]"
              }`}
            >
              {formatStatus(typedOrder.status)}
            </span>
          </div>

          {isCancelled ? (
            <div className="rounded-[20px] bg-[#FFF4F0] px-5 py-4 text-[#9C543D]">
              <p className="text-lg font-bold">This order was cancelled.</p>
              <p className="mt-1 text-sm">
                Please contact staff if you need more details.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
                          isCompleted || isCurrent
                            ? "bg-[#C6863A] text-white"
                            : "bg-[#F1ECE3] text-[#8C7B64]"
                        }`}
                      >
                        {isCompleted ? "✓" : isCurrent ? "•" : ""}
                      </div>

                      {index < steps.length - 1 ? (
                        <div
                          className={`mt-1 w-0.5 flex-1 ${
                            index < currentStepIndex
                              ? "bg-[#C6863A]"
                              : "bg-[#E7D9C1]"
                          }`}
                        />
                      ) : null}
                    </div>

                    <div className="pb-5">
                      <p className="text-2xl font-bold text-[#2A2018]">
                        {step.label}
                      </p>
                      <p className="mt-1 text-sm text-[#8A755D]">
                        {isCurrent
                          ? "Current order status"
                          : isCompleted
                          ? "Completed"
                          : "Waiting"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-[28px] bg-white/90 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
          <p className="text-xs uppercase tracking-[0.18em] text-[#9D6D48]">
            Your Order • {typedOrder.order_type.toUpperCase()}
          </p>

          <div className="mt-5 space-y-4">
            {typedOrder.order_items.map((item) => (
              <div
                key={item.id}
                className="border-b border-[#E7D9C1] pb-4 last:border-b-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-[#1F1711]">
                      {item.menu_items?.name ?? "Menu Item"}
                      {" "}
                      <span className="text-lg text-[#8A755D]">
                        ({item.size})
                      </span>
                    </p>

                    <p className="mt-1 text-sm text-[#8A755D]">
                      {item.temperature.charAt(0).toUpperCase() +
                        item.temperature.slice(1)}
                    </p>

                    {item.addons && item.addons.length > 0 ? (
                      <p className="mt-1 text-sm text-[#8A755D]">
                        Add-ons: {formatAddons(item.addons)}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-[#9D6D48]">×{item.quantity}</p>
                    <p className="text-xl font-bold text-[#9D6D48]">
                      {peso(item.unit_price * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-[#E7D9C1] pt-4">
            <span className="text-2xl font-bold text-[#2A2018]">TOTAL</span>
            <span className="text-3xl font-black text-[#C6863A]">
              {peso(typedOrder.total_amount)}
            </span>
          </div>
        </section>

        <Link
          href="/customer?tab=orders"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-[20px] border border-[#D9C4A3] bg-[#FAECD3] px-5 py-4 text-lg font-semibold text-[#7A4A25]"
        >
          <ArrowLeft size={18} />
          Back to Orders
        </Link>
      </div>
    </main>
  );
}

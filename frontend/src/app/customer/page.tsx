import { createClient } from "@/lib/supabase/server";
import { CustomerDashboard } from "@/features/customer/components/customer-dashboard";
import type { CustomerOrder } from "@/types/orders";
import type { FeedbackItem } from "@/types/feedback";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

const fallbackOrders: CustomerOrder[] = [];

export default async function CustomerPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const initialSection =
    resolvedSearchParams.tab === "orders"
      ? "orders"
      : resolvedSearchParams.tab === "menu"
      ? "menu"
      : resolvedSearchParams.tab === "rewards"
      ? "rewards"
      : "home";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: menuData, error: menuError } = await supabase
    .from("menu_items")
    .select(
      "id, name, description, category, base_price, image_url, is_available, has_sugar_level, has_ice_level, has_size_option, has_temp_option"
    )
    .order("name", { ascending: true });

  const menuItems = !menuError && menuData ? menuData : [];

  let orders: CustomerOrder[] = fallbackOrders;
  let feedbackItems: FeedbackItem[] = [];
  let preferenceSignals: Array<{
    menuItemId: string;
    overallRating: number;
  }> = [];
  let customerProfile = {
    fullName: "KadaServe Customer",
    email: user?.email ?? null,
    phone: null as string | null,
    avatarUrl: null as string | null,
    satisfactionAverage: null as number | null,
  };

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    customerProfile = {
      fullName:
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "KadaServe Customer",
      email: profile?.email || user.email || null,
      phone: profile?.phone || null,
      avatarUrl:
        profile?.avatar_url ||
        (typeof user.user_metadata?.avatar_url === "string"
          ? user.user_metadata.avatar_url
          : null),
      satisfactionAverage: null,
    };

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(
        `
          id,
          order_type,
          status,
          payment_method,
          payment_status,
          total_amount,
          ordered_at,
          delivery_address,
          delivery_lat,
          delivery_lng,
          delivery_email,
          delivery_phone,
          order_items (
            id,
            quantity,
            unit_price,
            menu_items (
              id,
              name,
              category
            )
          )
        `
      )
      .eq("customer_id", user.id)
      .order("ordered_at", { ascending: false });

    if (!ordersError && ordersData) {
      orders = ordersData as unknown as CustomerOrder[];
    }

    const eligibleStatuses = ["delivered", "completed"];

    const eligibleOrderItems =
      orders
        .filter((order) => eligibleStatuses.includes(order.status))
        .flatMap((order) =>
          order.order_items
            .flatMap((item) => {
              if (!item.menu_items?.id || !item.menu_items.name) {
                return [];
              }

              return [
                {
                  order_id: order.id,
                  order_item_id: item.id,
                  menu_item_id: item.menu_items.id,
                  item_name: item.menu_items.name,
                },
              ];
            })
        ) ?? [];

    if (eligibleOrderItems.length > 0) {
      const { data: existingFeedback } = await supabase
        .from("feedback")
        .select("order_item_id")
        .eq("customer_id", user.id);

      const submittedIds = new Set(
        (existingFeedback ?? []).map((item) => item.order_item_id)
      );

      feedbackItems = eligibleOrderItems.filter(
        (item) => !submittedIds.has(item.order_item_id)
      );
    }

    const { data: submittedFeedback } = await supabase
      .from("feedback")
      .select("menu_item_id, overall_rating")
      .eq("customer_id", user.id);

    preferenceSignals =
      submittedFeedback
        ?.map((item) => ({
          menuItemId: String(item.menu_item_id),
          overallRating: Number(item.overall_rating),
        }))
        .filter(
          (item) =>
            item.menuItemId &&
            item.menuItemId !== "null" &&
            Number.isFinite(item.overallRating)
        ) ?? [];

    const ratings =
      submittedFeedback
        ?.map((item) => Number(item.overall_rating))
        .filter((rating) => Number.isFinite(rating)) ?? [];

    customerProfile.satisfactionAverage =
      ratings.length > 0
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        : null;
  }

  return (
    <CustomerDashboard
      menuItems={menuItems}
      orders={orders}
      feedbackItems={feedbackItems}
      preferenceSignals={preferenceSignals}
      initialSection={initialSection}
      customerProfile={customerProfile}
      isAuthenticated={Boolean(user)}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { CustomerDashboard } from "@/features/customer/components/customer-dashboard";
import type { CustomerMenuItem } from "@/types/menu";
import type { CustomerOrder } from "@/types/orders";
import type { FeedbackItem } from "@/types/feedback";

type PageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

const fallbackMenuItems: CustomerMenuItem[] = [
  {
    id: "1",
    name: "Matcha",
    description: "Ceremonial grade matcha",
    category: "non_coffee",
    base_price: 145,
    image_url: null,
    is_available: true,
    has_sugar_level: true,
    has_ice_level: true,
    has_size_option: true,
    has_temp_option: true,
  },
  {
    id: "2",
    name: "Espresso",
    description: "Double shot",
    category: "hot_coffee",
    base_price: 145,
    image_url: null,
    is_available: true,
    has_sugar_level: true,
    has_ice_level: false,
    has_size_option: true,
    has_temp_option: true,
  },
  {
    id: "3",
    name: "Strawberry Matcha",
    description: "Fresh strawberries",
    category: "non_coffee",
    base_price: 145,
    image_url: null,
    is_available: true,
    has_sugar_level: true,
    has_ice_level: true,
    has_size_option: true,
    has_temp_option: true,
  },
  {
    id: "4",
    name: "Salted Caramel",
    description: "Smooth caramel espresso",
    category: "iced_coffee",
    base_price: 145,
    image_url: null,
    is_available: true,
    has_sugar_level: true,
    has_ice_level: true,
    has_size_option: true,
    has_temp_option: true,
  },
];

const fallbackOrders: CustomerOrder[] = [];

export default async function CustomerPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const initialSection =
    resolvedSearchParams.tab === "orders"
      ? "orders"
      : resolvedSearchParams.tab === "feedback"
      ? "feedback"
      : "menu";

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

  const menuItems = !menuError && menuData?.length ? menuData : fallbackMenuItems;

  let orders: CustomerOrder[] = fallbackOrders;
  let feedbackItems: FeedbackItem[] = [];
  let customerProfile = {
    fullName: "KadaServe Customer",
    email: user?.email ?? null,
    phone: null as string | null,
    defaultDeliveryAddress: null as string | null,
    satisfactionAverage: null as number | null,
  };

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .maybeSingle();
    const { data: deliveryProfile } = await supabase
      .from("profiles")
      .select("default_delivery_address")
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
      defaultDeliveryAddress:
        deliveryProfile?.default_delivery_address ?? null,
      satisfactionAverage: null,
    };

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(
        `
          id,
          order_type,
          status,
          total_amount,
          ordered_at,
          delivery_address,
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
      customerProfile.defaultDeliveryAddress =
        customerProfile.defaultDeliveryAddress ||
        orders.find((order) => order.delivery_address)?.delivery_address ||
        null;
    }

    const eligibleStatuses = ["delivered", "completed"];

    const eligibleOrderItems =
      orders
        .filter((order) => eligibleStatuses.includes(order.status))
        .flatMap((order) =>
          order.order_items
            .filter((item) => item.menu_items?.id && item.menu_items?.name)
            .map((item) => ({
              order_id: order.id,
              order_item_id: item.id,
              menu_item_id: item.menu_items!.id,
              item_name: item.menu_items!.name,
            }))
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
      .select("overall_rating")
      .eq("customer_id", user.id);

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
      initialSection={initialSection}
      customerProfile={customerProfile}
    />
  );
}

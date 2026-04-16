import { createClient } from "@/lib/supabase/server";
import { CustomerDashboard } from "./customer-dashboard";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  base_price: number;
  image_url: string | null;
  is_available: boolean;
};

type OrderItemRow = {
  id: string;
  quantity: number;
  unit_price: number;
  menu_items: {
    id: string;
    name: string;
  } | null;
};

type OrderRow = {
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
  order_items: OrderItemRow[];
};

type FeedbackItem = {
  order_id: string;
  order_item_id: string;
  menu_item_id: string;
  item_name: string;
};

type PageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

const fallbackMenuItems: MenuItem[] = [
  {
    id: "1",
    name: "Matcha",
    description: "Ceremonial grade matcha",
    category: "non_coffee",
    base_price: 145,
    image_url: null,
    is_available: true,
  },
  {
    id: "2",
    name: "Espresso",
    description: "Double shot",
    category: "hot_coffee",
    base_price: 145,
    image_url: null,
    is_available: true,
  },
  {
    id: "3",
    name: "Strawberry Matcha",
    description: "Fresh strawberries",
    category: "non_coffee",
    base_price: 145,
    image_url: null,
    is_available: true,
  },
  {
    id: "4",
    name: "Salted Caramel",
    description: "Smooth caramel espresso",
    category: "iced_coffee",
    base_price: 145,
    image_url: null,
    is_available: true,
  },
];

const fallbackOrders: OrderRow[] = [];

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
    .select("id, name, description, category, base_price, image_url, is_available")
    .order("name", { ascending: true });

  const menuItems = !menuError && menuData?.length ? menuData : fallbackMenuItems;

  let orders: OrderRow[] = fallbackOrders;
  let feedbackItems: FeedbackItem[] = [];

  if (user) {
    const { data: ordersData, error: ordersError } = await supabase
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
            menu_items (
              id,
              name
            )
          )
        `
      )
      .eq("customer_id", user.id)
      .order("ordered_at", { ascending: false });

    if (!ordersError && ordersData) {
      orders = ordersData as unknown as OrderRow[];
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
  }

  return (
    <CustomerDashboard
      menuItems={menuItems}
      orders={orders}
      feedbackItems={feedbackItems}
      initialSection={initialSection}
    />
  );
}

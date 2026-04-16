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

const fallbackOrders: OrderRow[] = [
  {
    id: "KD-0046",
    order_type: "pickup",
    status: "out_for_delivery",
    total_amount: 280,
    ordered_at: new Date().toISOString(),
    order_items: [
      {
        id: "oi-1",
        quantity: 2,
        unit_price: 140,
        menu_items: { name: "Matcha Latte" },
      },
    ],
  },
];

export default async function CustomerPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const initialSection =
    resolvedSearchParams.tab === "orders" ? "orders" : "menu";

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
  }

  return (
    <CustomerDashboard
      menuItems={menuItems}
      orders={orders}
      initialSection={initialSection}
    />
  );
}

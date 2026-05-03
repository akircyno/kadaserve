import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AdminOrderRow = {
  id: string;
  customer_id: string | null;
  order_type: string;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  total_amount: number;
  delivery_fee: number | null;
  reward_code: string | null;
  reward_discount_amount: number | null;
  ordered_at: string;
  walkin_name: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_email: string | null;
  delivery_phone: string | null;
  encoded_by: string | null;
  encoded_by_full_name: string | null;
  encoded_by_email: string | null;
  customer_full_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  quantity: number;
  unit_price: number;
  sugar_level: number;
  ice_level: string | null;
  size: string;
  temperature: string;
  addons: string[] | null;
  special_instructions: string | null;
  menu_items: { name: string } | { name: string }[] | null;
};

function normalizeMenuItem(
  menuItem: OrderItemRow["menu_items"]
): { name: string } | null {
  return Array.isArray(menuItem) ? menuItem[0] ?? null : menuItem;
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email, phone, role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    if (!profile || !["staff", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: orders, error: ordersError } = await supabase
      .from("admin_orders_view")
      .select(
        `
          id,
          customer_id,
          order_type,
          status,
          payment_method,
          payment_status,
          total_amount,
          delivery_fee,
          reward_code,
          reward_discount_amount,
          ordered_at,
          walkin_name,
          delivery_address,
          delivery_lat,
          delivery_lng,
          delivery_email,
          delivery_phone,
          encoded_by,
          encoded_by_full_name,
          encoded_by_email,
          customer_full_name,
          customer_email,
          customer_phone
        `
      )
      .order("ordered_at", { ascending: false })
      .returns<AdminOrderRow[]>();

    if (ordersError) {
      return NextResponse.json(
        { error: ordersError.message },
        { status: 500 }
      );
    }

    const orderIds = (orders ?? []).map((order) => order.id);
    const { data: orderItems, error: orderItemsError } = orderIds.length
      ? await supabase
          .from("order_items")
          .select(
            `
              id,
              order_id,
              quantity,
              unit_price,
              sugar_level,
              ice_level,
              size,
              temperature,
              addons,
              special_instructions,
              menu_items (
                name
              )
            `
          )
          .in("order_id", orderIds)
          .returns<OrderItemRow[]>()
      : { data: [], error: null };

    if (orderItemsError) {
      return NextResponse.json(
        { error: orderItemsError.message },
        { status: 500 }
      );
    }

    const orderItemsByOrderId = new Map<string, OrderItemRow[]>();

    (orderItems ?? []).forEach((item) => {
      const currentItems = orderItemsByOrderId.get(item.order_id) ?? [];
      currentItems.push(item);
      orderItemsByOrderId.set(item.order_id, currentItems);
    });

    const enrichedOrders =
      orders?.map((order) => ({
        id: order.id,
        customer_id: order.customer_id,
        order_type: order.order_type,
        status: order.status,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        total_amount: order.total_amount,
        delivery_fee: order.delivery_fee,
        reward_code: order.reward_code,
        reward_discount_amount: order.reward_discount_amount,
        ordered_at: order.ordered_at,
        walkin_name: order.walkin_name,
        delivery_address: order.delivery_address,
        delivery_lat: order.delivery_lat,
        delivery_lng: order.delivery_lng,
        delivery_email: order.delivery_email,
        delivery_phone: order.delivery_phone,
        encoded_by: order.encoded_by,
        encoded_by_profile: order.encoded_by
          ? {
              full_name: order.encoded_by_full_name,
              email: order.encoded_by_email,
            }
          : null,
        customer_profile: order.customer_id
          ? {
              full_name: order.customer_full_name,
              email: order.customer_email,
              phone: order.customer_phone,
            }
          : null,
        order_items: (orderItemsByOrderId.get(order.id) ?? []).map((item) => ({
          id: item.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          sugar_level: item.sugar_level,
          ice_level: item.ice_level,
          size: item.size,
          temperature: item.temperature,
          addons: item.addons,
          special_instructions: item.special_instructions,
          menu_items: normalizeMenuItem(item.menu_items),
        })),
      })) ?? [];

    return NextResponse.json({
      orders: enrichedOrders,
      staffProfile: {
        fullName: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while loading orders.",
      },
      { status: 500 }
    );
  }
}

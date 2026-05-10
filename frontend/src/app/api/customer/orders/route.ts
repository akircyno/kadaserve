import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CustomerOrder } from "@/types/orders";

export { POST } from "@/app/api/checkout/route";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
        id,
        order_type,
        status,
        payment_method,
        payment_status,
        total_amount,
        delivery_fee,
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
            description,
            category,
            base_price,
            image_url,
            is_available,
            has_sugar_level,
            has_ice_level,
            has_size_option,
            has_temp_option
          )
        )
      `
    )
    .eq("customer_id", user.id)
    .order("ordered_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load customer orders." },
      { status: 500 }
    );
  }

  return NextResponse.json({ orders: (data ?? []) as unknown as CustomerOrder[] });
}

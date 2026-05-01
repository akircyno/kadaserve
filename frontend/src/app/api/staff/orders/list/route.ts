import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      .from("orders")
      .select(
        `
          id,
          customer_id,
          order_type,
          status,
          payment_method,
          payment_status,
          total_amount,
          ordered_at,
          walkin_name,
          delivery_address,
          delivery_lat,
          delivery_lng,
          delivery_email,
          delivery_phone,
          order_items (
            id,
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
          )
        `
      )
      .order("ordered_at", { ascending: false });


    if (ordersError) {
      return NextResponse.json(
        { error: ordersError.message },
        { status: 500 }
      );
    }

    const customerIds = Array.from(
      new Set(
        (orders ?? [])
          .map((order) => order.customer_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const customerProfilesById = new Map<
      string,
      { full_name: string | null; email: string | null; phone: string | null }
    >();

    if (customerIds.length > 0) {
      const { data: customerProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", customerIds);

      customerProfiles?.forEach((customerProfile) => {
        customerProfilesById.set(customerProfile.id, {
          full_name: customerProfile.full_name,
          email: customerProfile.email,
          phone: customerProfile.phone,
        });
      });
    }

    const enrichedOrders =
      orders?.map((order) => ({
        ...order,
        customer_profile: order.customer_id
          ? customerProfilesById.get(order.customer_id) ?? null
          : null,
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

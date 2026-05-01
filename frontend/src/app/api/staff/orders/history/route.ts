import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const finalStatuses = ["completed", "delivered", "cancelled"];
const defaultPageSize = 40;
const maxPageSize = 80;
const maxCsvRows = 5000;

type HistoryRange = "today" | "yesterday" | "custom" | "all";
type CustomerProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};
type HistoryOrderItem = {
  id: string;
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
type EnrichedHistoryOrder = {
  id: string;
  customer_id: string | null;
  order_type: string;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  total_amount: number;
  ordered_at: string;
  walkin_name: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_email: string | null;
  delivery_phone: string | null;
  customer_profile: CustomerProfile | null;
  order_items: HistoryOrderItem[];
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function cleanSearch(value: string) {
  return value.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ");
}

function manilaDate(offsetDays = 0) {
  const base = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function toManilaIso(date: string, edge: "start" | "end") {
  const time =
    edge === "start" ? "00:00:00.000+08:00" : "23:59:59.999+08:00";

  return new Date(`${date}T${time}`).toISOString();
}

function getDateBounds(
  range: HistoryRange,
  customFrom: string | null,
  customTo: string | null
) {
  if (range === "all") {
    return null;
  }

  if (range === "yesterday") {
    const date = manilaDate(-1);
    return {
      from: toManilaIso(date, "start"),
      to: toManilaIso(date, "end"),
    };
  }

  if (range === "custom" && customFrom && customTo) {
    return {
      from: toManilaIso(customFrom, "start"),
      to: toManilaIso(customTo, "end"),
    };
  }

  const date = manilaDate();
  return {
    from: toManilaIso(date, "start"),
    to: toManilaIso(date, "end"),
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function formatOrderCode(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function getOrderCustomer(order: {
  walkin_name: string | null;
  delivery_email: string | null;
  customer_profile: Pick<CustomerProfile, "full_name" | "email"> | null;
}) {
  return (
    order.walkin_name?.trim() ||
    order.customer_profile?.full_name?.trim() ||
    order.delivery_email ||
    order.customer_profile?.email ||
    "Customer"
  );
}

function getOrderPhone(order: {
  delivery_phone: string | null;
  customer_profile: Pick<CustomerProfile, "phone"> | null;
}) {
  return order.delivery_phone || order.customer_profile?.phone || "";
}

function buildCsv(orders: EnrichedHistoryOrder[]) {
  const rows = [
    [
      "Order ID",
      "Customer",
      "Phone",
      "Status",
      "Type",
      "Payment",
      "Total",
      "Time",
      "Items",
      "Special Remarks",
    ],
    ...orders.map((order) => {
      const items =
        order.order_items
          ?.map((item) => {
            const menuItem = Array.isArray(item.menu_items)
              ? item.menu_items[0]
              : item.menu_items;
            return `${menuItem?.name ?? "Menu item"} x ${item.quantity}`;
          })
          .join("; ") ?? "";
      const remarks =
        order.order_items
          ?.map((item) => item.special_instructions)
          .filter(Boolean)
          .join("; ") ?? "";

      return [
        formatOrderCode(order.id),
        getOrderCustomer(order),
        getOrderPhone(order),
        order.status,
        order.order_type,
        `${order.payment_method ?? "pending"} / ${
          order.payment_status ?? "pending"
        }`,
        order.total_amount,
        order.ordered_at,
        items,
        remarks,
      ];
    }),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["staff", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const search = cleanSearch(url.searchParams.get("q") ?? "");
    const range = (url.searchParams.get("range") ?? "today") as HistoryRange;
    const customFrom = url.searchParams.get("from");
    const customTo = url.searchParams.get("to");
    const isCsv = url.searchParams.get("export") === "csv";
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const pageSize = Math.min(
      maxPageSize,
      Math.max(10, Number(url.searchParams.get("pageSize") ?? defaultPageSize))
    );
    const dateBounds = getDateBounds(range, customFrom, customTo);

    let matchingProfileIds: string[] = [];

    if (search) {
      const searchPattern = `%${search}%`;
      const { data: matchingProfiles } = await supabase
        .from("profiles")
        .select("id")
        .or(
          `full_name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern}`
        )
        .limit(100);

      matchingProfileIds = matchingProfiles?.map((item) => item.id) ?? [];
    }

    let query = supabase
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
        `,
        { count: "exact" }
      )
      .in("status", finalStatuses)
      .order("ordered_at", { ascending: false });

    if (dateBounds) {
      query = query.gte("ordered_at", dateBounds.from).lte("ordered_at", dateBounds.to);
    }

    if (search) {
      const filters = [
        ...(isUuid(search) ? [`id.eq.${search}`] : []),
        `walkin_name.ilike.%${search}%`,
        `delivery_phone.ilike.%${search}%`,
        `delivery_email.ilike.%${search}%`,
        ...(matchingProfileIds.length > 0
          ? [`customer_id.in.(${matchingProfileIds.join(",")})`]
          : []),
      ];

      query = query.or(filters.join(","));
    }

    const from = isCsv ? 0 : page * pageSize;
    const to = isCsv ? maxCsvRows - 1 : from + pageSize - 1;
    const { data: orders, error, count } = await query.range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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

    if (isCsv) {
      return new NextResponse(buildCsv(enrichedOrders), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="kadaserve-order-history-${manilaDate()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      orders: enrichedOrders,
      count: count ?? 0,
      page,
      pageSize,
      hasMore: from + enrichedOrders.length < (count ?? 0),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while loading order history.",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const finalStatuses = ["completed", "delivered", "cancelled", "expired"];
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
type EnrichedHistoryOrder = {
  id: string;
  customer_id: string | null;
  order_type: string;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  total_amount: number;
  delivery_fee: number | null;
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
type AdminHistoryOrderRow = {
  id: string;
  customer_id: string | null;
  order_type: string;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  total_amount: number;
  delivery_fee: number | null;
  ordered_at: string;
  walkin_name: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_email: string | null;
  delivery_phone: string | null;
  customer_full_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function cleanSearch(value: string) {
  return value.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ");
}

function cleanOrderCodeSearch(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").trim();
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

function normalizeMenuItem(
  menuItem: HistoryOrderItem["menu_items"]
): { name: string } | null {
  return Array.isArray(menuItem) ? menuItem[0] ?? null : menuItem;
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
      "Delivery Fee",
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
        order.delivery_fee ?? 0,
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
    const orderCodeSearch = cleanOrderCodeSearch(search);
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

    let query = supabase
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
          ordered_at,
          walkin_name,
          delivery_address,
          delivery_lat,
          delivery_lng,
          delivery_email,
          delivery_phone,
          customer_full_name,
          customer_email,
          customer_phone
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
        ...(orderCodeSearch ? [`id.ilike.%${orderCodeSearch}%`] : []),
        `walkin_name.ilike.%${search}%`,
        `delivery_phone.ilike.%${search}%`,
        `delivery_email.ilike.%${search}%`,
        `customer_full_name.ilike.%${search}%`,
        `customer_phone.ilike.%${search}%`,
        `customer_email.ilike.%${search}%`,
      ];

      query = query.or(filters.join(","));
    }

    const from = isCsv ? 0 : page * pageSize;
    const to = isCsv ? maxCsvRows - 1 : from + pageSize - 1;
    const { data: orders, error, count } = await query
      .range(from, to)
      .returns<AdminHistoryOrderRow[]>();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
          .returns<HistoryOrderItem[]>()
      : { data: [], error: null };

    if (orderItemsError) {
      return NextResponse.json(
        { error: orderItemsError.message },
        { status: 500 }
      );
    }

    const orderItemsByOrderId = new Map<string, HistoryOrderItem[]>();

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
        ordered_at: order.ordered_at,
        walkin_name: order.walkin_name,
        delivery_address: order.delivery_address,
        delivery_lat: order.delivery_lat,
        delivery_lng: order.delivery_lng,
        delivery_email: order.delivery_email,
        delivery_phone: order.delivery_phone,
        customer_profile: order.customer_id
          ? {
              full_name: order.customer_full_name,
              email: order.customer_email,
              phone: order.customer_phone,
            }
          : null,
        order_items: (orderItemsByOrderId.get(order.id) ?? []).map((item) => ({
          ...item,
          menu_items: normalizeMenuItem(item.menu_items),
        })),
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

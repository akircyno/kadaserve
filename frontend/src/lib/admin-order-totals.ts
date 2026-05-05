import type { OrderStatus, StaffOrder } from "@/types/orders";

export type AdminTimeFilter = "today" | "week" | "month" | "year";
export type AdminStatusFilter = "all" | OrderStatus;
export type AdminTypeFilter = "all" | StaffOrder["order_type"];
export type AdminPaymentFilter = "all" | "paid" | "unpaid" | "cash" | "gcash";

export function getManilaDateOnly(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return new Date(year, month - 1, day);
}

export function isWithinAdminTimeFilter(value: string, timeFilter: AdminTimeFilter) {
  const today = getManilaDateOnly(new Date());
  const orderDate = getManilaDateOnly(new Date(value));

  if (timeFilter === "today") {
    return orderDate.getTime() === today.getTime();
  }

  if (timeFilter === "week") {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    return orderDate >= startOfWeek && orderDate <= today;
  }

  if (timeFilter === "month") {
    return (
      orderDate.getFullYear() === today.getFullYear() &&
      orderDate.getMonth() === today.getMonth()
    );
  }

  return orderDate.getFullYear() === today.getFullYear();
}

export function getAdminReportRangeLabel(timeFilter: AdminTimeFilter) {
  const today = getManilaDateOnly(new Date());

  if (timeFilter === "today") {
    return today.toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  if (timeFilter === "week") {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    return `${startOfWeek.toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
    })} - ${today.toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  if (timeFilter === "month") {
    return today.toLocaleDateString("en-PH", {
      month: "long",
      year: "numeric",
    });
  }

  return today.getFullYear().toString();
}

export function getAdminOrdersMetricLabel(timeFilter: AdminTimeFilter) {
  return `${getAdminReportRangeLabel(timeFilter)} Orders`;
}

export function getAdminReportOrders(
  orders: StaffOrder[],
  {
    paymentFilter = "all",
    statusFilter = "all",
    timeFilter,
    typeFilter = "all",
  }: {
    paymentFilter?: AdminPaymentFilter;
    statusFilter?: AdminStatusFilter;
    timeFilter: AdminTimeFilter;
    typeFilter?: AdminTypeFilter;
  }
) {
  return orders.filter((order) => {
    const matchesTime = isWithinAdminTimeFilter(order.ordered_at, timeFilter);
    const matchesStatus =
      statusFilter === "all"
        ? order.status !== "cancelled"
        : order.status === statusFilter;
    const matchesType = typeFilter === "all" || order.order_type === typeFilter;
    const matchesPayment =
      paymentFilter === "all" ||
      order.payment_status === paymentFilter ||
      order.payment_method === paymentFilter;

    return matchesTime && matchesStatus && matchesType && matchesPayment;
  });
}

export function getAdminOrderTotals(orders: StaffOrder[]) {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.total_amount ?? 0),
    0
  );

  return {
    totalOrders,
    totalRevenue,
    averageOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
  };
}

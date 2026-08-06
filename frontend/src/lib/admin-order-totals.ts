import type { OrderStatus, StaffOrder } from "@/types/orders";

export type AdminTimeFilter = "today" | "week" | "month" | "year" | "custom";
export type AdminStatusFilter = "all" | "active" | OrderStatus;
export type AdminTypeFilter = "all" | StaffOrder["order_type"];
export type AdminPaymentFilter =
  | "all"
  | "paid"
  | "unpaid"
  | "cash"
  | "gcash"
  | "online";

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

function getDateFromInput(value?: string) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function isWithinAdminTimeFilter(
  value: string,
  timeFilter: AdminTimeFilter,
  customStartDate?: string,
  customEndDate?: string,
  referenceDate: Date = new Date()
) {
  const today = getManilaDateOnly(referenceDate);
  const orderDate = getManilaDateOnly(new Date(value));

  if (timeFilter === "custom") {
    const start = getDateFromInput(customStartDate);
    const end = getDateFromInput(customEndDate);

    if (start && end) {
      const [from, to] = start <= end ? [start, end] : [end, start];
      return orderDate >= from && orderDate <= to;
    }

    if (start) {
      return orderDate >= start;
    }

    if (end) {
      return orderDate <= end;
    }

    return true;
  }

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

export function getAdminReportRangeLabel(
  timeFilter: AdminTimeFilter,
  customStartDate?: string,
  customEndDate?: string
) {
  const today = getManilaDateOnly(new Date());

  if (timeFilter === "custom") {
    const start = getDateFromInput(customStartDate);
    const end = getDateFromInput(customEndDate);
    const format = (date: Date) =>
      date.toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

    if (start && end) {
      const [from, to] = start <= end ? [start, end] : [end, start];
      return `${format(from)} - ${format(to)}`;
    }

    if (start) {
      return `From ${format(start)}`;
    }

    if (end) {
      return `Until ${format(end)}`;
    }

    return "Custom Range";
  }

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

export function getAdminOrdersMetricLabel(
  timeFilter: AdminTimeFilter,
  customStartDate?: string,
  customEndDate?: string
) {
  return `${getAdminReportRangeLabel(timeFilter, customStartDate, customEndDate)} Orders`;
}

export function getAdminReportOrders(
  orders: StaffOrder[],
  {
    paymentFilter = "all",
    statusFilter = "all",
    timeFilter,
    typeFilter = "all",
    customStartDate,
    customEndDate,
    referenceDate = new Date(),
  }: {
    customEndDate?: string;
    customStartDate?: string;
    paymentFilter?: AdminPaymentFilter;
    statusFilter?: AdminStatusFilter;
    timeFilter: AdminTimeFilter;
    typeFilter?: AdminTypeFilter;
    referenceDate?: Date;
  }
) {
  const activeStatuses = new Set<OrderStatus>([
    "pending_payment",
    "pending",
    "preparing",
    "ready",
    "out_for_delivery",
  ]);

  return orders.filter((order) => {
    const matchesTime = isWithinAdminTimeFilter(
      order.ordered_at,
      timeFilter,
      customStartDate,
      customEndDate,
      referenceDate
    );
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
          ? activeStatuses.has(order.status)
          : order.status === statusFilter;
    const matchesType = typeFilter === "all" || order.order_type === typeFilter;
    const matchesPayment =
      paymentFilter === "all" ||
      order.payment_status === paymentFilter ||
      order.payment_method === paymentFilter;

    return matchesTime && matchesStatus && matchesType && matchesPayment;
  });
}

export function computeAdminDashboardRange(
  validOrders: StaffOrder[],
  referenceDate: Date = new Date()
): {
  timeFilter: "month" | "custom";
  customStartDate: string | undefined;
  customEndDate: string | undefined;
} {
  const currentMonthOrders = getAdminReportOrders(validOrders, {
    timeFilter: "month",
    referenceDate,
  });

  if (currentMonthOrders.length > 0) {
    return {
      timeFilter: "month" as const,
      customStartDate: undefined as string | undefined,
      customEndDate: undefined as string | undefined,
    };
  }

  const mostRecentOrder = [...validOrders].sort(
    (left, right) => new Date(right.ordered_at).getTime() - new Date(left.ordered_at).getTime()
  )[0];

  if (!mostRecentOrder) {
    return {
      timeFilter: "month" as const,
      customStartDate: undefined as string | undefined,
      customEndDate: undefined as string | undefined,
    };
  }

  const recentDate = getManilaDateOnly(new Date(mostRecentOrder.ordered_at));
  const firstDayOfMonth = new Date(recentDate.getFullYear(), recentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(recentDate.getFullYear(), recentDate.getMonth() + 1, 0);
  const toDateInput = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;

  return {
    timeFilter: "custom" as const,
    customStartDate: toDateInput(firstDayOfMonth),
    customEndDate: toDateInput(lastDayOfMonth),
  };
}

export function isValidAdminOrder(order: StaffOrder) {
  return order.status !== "cancelled" && order.status !== "expired";
}

export function isAdminRevenueOrder(order: StaffOrder) {
  return isValidAdminOrder(order) && order.payment_status === "paid";
}

export function getAdminOrderTotals(orders: StaffOrder[]) {
  const totalOrders = orders.length;
  const revenueOrders = orders.filter(isAdminRevenueOrder);
  const totalRevenue = revenueOrders.reduce(
    (sum, order) => sum + Number(order.total_amount ?? 0),
    0
  );

  return {
    totalOrders,
    totalRevenue,
    averageOrderValue: revenueOrders.length ? totalRevenue / revenueOrders.length : 0,
  };
}

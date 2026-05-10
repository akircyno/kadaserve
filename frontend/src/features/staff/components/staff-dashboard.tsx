"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  StoreOverrideStatus,
  StoreStatusPayload,
} from "@/lib/store-status";
import {
  ClipboardList,
  Clock3,
  CircleDollarSign,
  ArrowRight,
  ExternalLink,
  MapPin,
  RefreshCw,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { OrderStatus, StaffOrder } from "@/types/orders";

type OrderFilter = "all" | "pickup" | "delivery";
type StationStatus = "accepting" | "busy" | "closed";
type StaffProfile = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
};
type BoardOrderStatus = Exclude<
  OrderStatus,
  "completed" | "delivered" | "cancelled" | "expired"
>;

const fallbackOrders: StaffOrder[] = [];
const pendingOrderTimeoutMinutes = 45;
const finalStatuses: OrderStatus[] = [
  "completed",
  "delivered",
  "cancelled",
  "expired",
];


const boardColumns: Array<{
  key: BoardOrderStatus;
  label: string;
  caption: string;
  accent: string;
  header: string;
  count: string;
}> = [
    {
      key: "pending_payment",
      label: "Awaiting Payment",
      caption: "Online checkout not paid",
      accent: "bg-[#B76522]",
      header: "border-[#E7C08A] bg-[#FFF7E8]",
      count: "bg-[#FFF0DA] text-[#684B35]",
    },
    {
      key: "pending",
      label: "Pending",
      caption: "New orders to accept",
      accent: "bg-[#0D2E18]",
      header: "border-[#DCCFB8] bg-[#F9F1E4]",
      count: "bg-[#EFE3CF] text-[#684B35]",
    },
    {
      key: "preparing",
      label: "Preparing",
      caption: "In kitchen workflow",
      accent: "bg-[#2D7A40]",
      header: "border-[#CFE4CB] bg-[#EFF8EC]",
      count: "bg-[#E6F2E8] text-[#0D2E18]",
    },
    {
      key: "ready",
      label: "Ready",
      caption: "Pickup or dispatch next",
      accent: "bg-[#0F441D]",
      header: "border-[#BFD9C0] bg-[#EAF5E8]",
      count: "bg-[#DFF0E1] text-[#0F441D]",
    },
    {
      key: "out_for_delivery",
      label: "Out for Delivery",
      caption: "Rider/customer handoff",
      accent: "bg-[#684B35]",
      header: "border-[#E6C79E] bg-[#FFF0DA]",
      count: "bg-[#FFF8EF] text-[#684B35]",
    },
  ];

function formatOrderCode(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function formatNameFromEmail(email: string | null) {
  if (!email) return null;

  const name = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();

  if (!name) return null;

  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getOrderDisplayName(order: StaffOrder) {
  return (
    order.walkin_name?.trim() ||
    order.customer_profile?.full_name?.trim() ||
    formatNameFromEmail(order.delivery_email) ||
    formatNameFromEmail(order.customer_profile?.email ?? null) ||
    (order.order_type === "delivery" ? "Delivery Customer" : "Walk-in Customer")
  );
}

function getOrderEmail(order: StaffOrder) {
  return order.delivery_email || order.customer_profile?.email || null;
}

function getOrderPhone(order: StaffOrder) {
  return order.delivery_phone || order.customer_profile?.phone || null;
}

function hasDeliveryPin(order: StaffOrder) {
  return (
    typeof order.delivery_lat === "number" &&
    typeof order.delivery_lng === "number"
  );
}

function buildOpenStreetMapUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatElapsed(value: string, now: Date) {
  const elapsedMs = Math.max(0, now.getTime() - new Date(value).getTime());
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${Math.max(1, minutes)}m`;
}

function getElapsedMinutes(value: string, now: Date) {
  return Math.floor(
    Math.max(0, now.getTime() - new Date(value).getTime()) / 60000
  );
}

function getQueueAgeStyle(minutes: number) {
  if (minutes >= 45) {
    return "border-[#C55432]/25 bg-[#FFF1EC] text-[#A6422A]";
  }

  if (minutes >= 25) {
    return "border-[#B76522]/25 bg-[#FFF0DA] text-[#684B35]";
  }

  return "border-[#0F441D]/15 bg-[#E6F2E8] text-[#0D2E18]";
}

function getQueueHeatmapStyle(minutes: number) {
  if (minutes >= 45) {
    return {
      card:
        "border-[#C55432]/45 bg-[#FFF1EC] shadow-[0_14px_30px_rgba(166,66,42,0.16)]",
      rail: "bg-[#C55432]",
      panel: "border-[#F2C8BD] bg-white/75",
      label: "Critical wait",
    };
  }

  if (minutes >= 31) {
    return {
      card:
        "border-[#D98A45]/40 bg-[#FFF5EA] shadow-[0_12px_26px_rgba(183,101,34,0.12)]",
      rail: "bg-[#D98A45]",
      panel: "border-[#E9C79B] bg-white/70",
      label: "Needs attention",
    };
  }

  if (minutes >= 16) {
    return {
      card:
        "border-[#D9BB78]/35 bg-[#FFF9EC] shadow-[0_10px_22px_rgba(104,75,53,0.09)]",
      rail: "bg-[#D9BB78]",
      panel: "border-[#E8D5AA] bg-white/70",
      label: "Warming up",
    };
  }

  return {
    card:
      "border-[#DCCFB8] bg-white shadow-[0_8px_18px_rgba(104,75,53,0.06)]",
    rail: "",
    panel: "border-[#EFE3CF] bg-[#FFF8EF]",
    label: "Normal pace",
  };
}

function getQueueAccent(status: OrderStatus) {
  switch (status) {
    case "pending_payment":
      return "bg-[#B76522]";
    case "pending":
      return "bg-[#0D2E18]";
    case "preparing":
      return "bg-[#2D7A40]";
    case "ready":
      return "bg-[#0F441D]";
    case "out_for_delivery":
      return "bg-[#684B35]";
    default:
      return "bg-[#DCCFB8]";
  }
}

function getOrderItemQuantity(order: StaffOrder) {
  return order.order_items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
}

function getQueueFocusLabel(order: StaffOrder, minutesUntilExpiry: number | null) {
  if (order.status === "pending_payment") {
    return "Waiting online payment";
  }

  if (minutesUntilExpiry !== null && minutesUntilExpiry <= 10) {
    return "Expires soon";
  }

  if (requiresPaymentBeforeNextAction(order)) {
    return "Collect payment first";
  }

  if (requiresFinalDeliveryFee(order)) {
    return "Missing delivery fee";
  }

  if (order.status === "ready") {
    return order.order_type === "delivery" ? "Ready to dispatch" : "Ready for pickup";
  }

  return order.order_type === "delivery" ? "Delivery order" : "Pickup order";
}

function getMinutesUntilExpiration(value: string, now: Date) {
  const expirationAt =
    new Date(value).getTime() + pendingOrderTimeoutMinutes * 60 * 1000;
  const minutesLeft = Math.ceil((expirationAt - now.getTime()) / 60000);
  return minutesLeft;
}

function isPendingOrderExpired(value: string, now: Date) {
  return getMinutesUntilExpiration(value, now) <= 0;
}

function getExpirationCountdownStyle(minutesLeft: number) {
  if (minutesLeft <= 10) {
    return "bg-[#FDE8E2] text-[#A6422A]";
  }

  if (minutesLeft <= 30) {
    return "bg-[#FFF0DA] text-[#684B35]";
  }

  return "bg-[#E6F2E8] text-[#0D2E18]";
}

function formatExpirationCountdown(minutesLeft: number) {
  if (minutesLeft <= 0) {
    return "Expired";
  }

  if (minutesLeft >= pendingOrderTimeoutMinutes) {
    return `${pendingOrderTimeoutMinutes}m left`;
  }

  return `${minutesLeft}m left`;
}

function peso(value: number) {
  return `\u20B1${Math.round(value)}`;
}

function getDeliveryFee(order: StaffOrder) {
  return order.order_type === "delivery" ? Number(order.delivery_fee ?? 0) : 0;
}

function getOrderSubtotal(order: StaffOrder) {
  return Math.max(0, Number(order.total_amount ?? 0) - getDeliveryFee(order));
}

function requiresFinalDeliveryFee(order: StaffOrder) {
  return (
    order.order_type === "delivery" &&
    order.status === "ready" &&
    Number(order.delivery_fee ?? 0) <= 0
  );
}


function formatStatus(status: OrderStatus) {
  switch (status) {
    case "pending_payment":
      return "Pending Payment";
    case "pending":
      return "Pending";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready";
    case "out_for_delivery":
      return "Out for Delivery";
    case "delivered":
      return "Delivered";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

function getNextActionLabel(
  orderType: "pickup" | "delivery",
  status: OrderStatus
) {
  if (orderType === "pickup") {
    switch (status) {
      case "pending":
        return "Start Preparing";
      case "preparing":
        return "Mark Ready";
      case "ready":
        return "Complete";
      default:
        return null;
    }
  }

  switch (status) {
    case "pending":
      return "Start Preparing";
    case "preparing":
      return "Mark Ready";
    case "ready":
      return "Dispatch";
    case "out_for_delivery":
      return "Mark Delivered";
    default:
      return null;
  }
}

function getOrderTypeStyle(orderType: "pickup" | "delivery") {
  return orderType === "pickup"
    ? "bg-[#E6F2E8] text-[#0D2E18]"
    : "bg-[#FFF0E5] text-[#684B35]";
}

function getPaymentStyle(paymentMethod: StaffOrder["payment_method"]) {
  if (!paymentMethod) {
    return "border border-[#DCCFB8] bg-[#FFF8EF]/70 text-[#8A755D]";
  }

  if (paymentMethod === "online") {
    return "border border-[#0F441D]/25 bg-[#E6F2E8] text-[#0D2E18]";
  }

  return paymentMethod === "cash"
    ? "border border-[#0F441D]/20 bg-[#FFF8EF]/70 text-[#0F441D]"
    : "border border-[#684B35]/20 bg-[#FFF8EF]/70 text-[#684B35]";
}

function getPaymentLabel(order: StaffOrder) {
  if (!order.payment_method) {
    return "Payment pending";
  }

  if (order.payment_method === "online") {
    return "Online";
  }

  if (order.payment_method === "cash") {
    return order.order_type === "delivery" ? "Cash on Delivery" : "Pay at Cafe";
  }

  return "GCash";
}

function getPaymentStatusLabel(order: StaffOrder) {
  if (order.status === "pending_payment") {
    return "Awaiting Payment";
  }

  return order.payment_status === "paid" ? "Paid" : "Unpaid";
}

function getPaymentStatusStyle(order: StaffOrder) {
  if (order.status === "pending_payment") {
    return "border border-[#B76522]/30 bg-[#FFF0DA] text-[#684B35]";
  }

  const paymentStatus = order.payment_status;

  return paymentStatus === "paid"
    ? "border border-[#0F441D]/20 bg-[#FFF8EF]/70 text-[#0F441D]"
    : "border border-[#684B35]/30 bg-[#FFF0DA] text-[#684B35]";
}

function getStatusBadgeStyle(status: OrderStatus) {
  switch (status) {
    case "pending_payment":
      return "bg-[#FFF0DA] text-[#684B35]";
    case "pending":
      return "bg-[#E6F2E8] text-[#0D2E18]";
    case "preparing":
      return "bg-[#E6F2E8] text-[#0D2E18]";
    case "ready":
      return "bg-[#E6F2E8] text-[#0F441D]";
    case "out_for_delivery":
      return "bg-[#FFF0DA] text-[#684B35]";
    case "completed":
      return "bg-[#E6F2E8] text-[#0F441D]";
    case "delivered":
      return "bg-[#FFF0DA] text-[#684B35]";
    case "cancelled":
      return "bg-[#FFF1EC] text-[#C55432]";
    case "expired":
      return "bg-[#FDE8E2] text-[#A6422A]";
    default:
      return "bg-[#F4EEE6] text-[#684B35]";
  }
}

function getColumnActionStyle(status: OrderStatus) {
  if (status === "out_for_delivery") {
    return "bg-[#684B35] hover:bg-[#5A3F2D]";
  }

  if (status === "ready") {
    return "bg-[#0F441D] hover:bg-[#0D2E18]";
  }

  return "bg-[#0D2E18] hover:bg-[#123821]";
}

function requiresPaymentBeforeNextAction(order: StaffOrder) {
  const nextAction = getNextActionLabel(order.order_type, order.status);

  return (
    order.payment_status === "unpaid" &&
    order.status === "out_for_delivery" &&
    nextAction === "Mark Delivered"
  );
}

function canMarkPaid(order: StaffOrder) {
  return order.payment_status === "unpaid" && order.status === "out_for_delivery";
}

function canCancelOrder(order: StaffOrder) {
  return ![
    "ready",
    "out_for_delivery",
    "completed",
    "delivered",
    "cancelled",
    "expired",
  ].includes(order.status);
}

function getDrawerActionLabel(order: StaffOrder) {
  const nextAction = getNextActionLabel(order.order_type, order.status);

  if (nextAction === "Complete") {
    return "Complete Order";
  }

  return nextAction;
}

function formatOrderSummary(order: StaffOrder) {
  return order.order_items
    .map((item) => {
      const label = item.menu_items?.name ?? "Menu item";
      return `${label} x ${item.quantity}`;
    })
    .filter(Boolean);
}

function getOrderSpecialRemarks(order: StaffOrder) {
  return order.order_items
    .map((item) => item.special_instructions?.trim())
    .filter((remark): remark is string => Boolean(remark));
}

function formatAddonLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getFinalStatusMessage(status: OrderStatus) {
  switch (status) {
    case "completed":
      return "This pickup order has been completed.";
    case "delivered":
      return "This delivery order has been delivered.";
    case "cancelled":
      return "This order has been cancelled.";
    case "expired":
      return "This order expired after waiting too long in pending.";
    default:
      return null;
  }
}

export function StaffDashboard() {
  const router = useRouter();

  const [orders, setOrders] = useState<StaffOrder[]>(fallbackOrders);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);
  const [stationStatus, setStationStatus] =
    useState<StationStatus>("accepting");
  const [storeOverrideStatus, setStoreOverrideStatus] =
    useState<StoreOverrideStatus>("auto");
  const [isStoreStatusUpdating, setIsStoreStatusUpdating] = useState(false);
  const [storeStatusError, setStoreStatusError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [finalDeliveryFeeInput, setFinalDeliveryFeeInput] = useState("");
  const [updatingOrderIds, setUpdatingOrderIds] = useState<string[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [dispatchToast, setDispatchToast] = useState("");
  const [staffToast, setStaffToast] = useState("");
  const [error, setError] = useState("");
  const [expiringOrderIds, setExpiringOrderIds] = useState<string[]>([]);

  const activeOrders = useMemo(() => {
    return orders.filter((order) => !finalStatuses.includes(order.status));
  }, [orders]);

  const historyOrders = useMemo(() => {
    return orders
      .filter((order) => finalStatuses.includes(order.status))
      .sort(
        (first, second) =>
          new Date(second.ordered_at).getTime() -
          new Date(first.ordered_at).getTime()
      )
      .slice(0, 8);
  }, [orders]);


  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return activeOrders.filter((order) => {
      const matchesType =
        orderFilter === "all" || order.order_type === orderFilter;

      const orderCode = formatOrderCode(order.id).toLowerCase();
      const itemNames = order.order_items
        .map((item) => item.menu_items?.name ?? "")
        .join(" ")
        .toLowerCase();
      const orderType = order.order_type.toLowerCase();
      const customerName = getOrderDisplayName(order).toLowerCase();

      const matchesSearch =
        !keyword ||
        orderCode.includes(keyword) ||
        itemNames.includes(keyword) ||
        orderType.includes(keyword) ||
        customerName.includes(keyword);

      return matchesType && matchesSearch;
    });
  }, [activeOrders, orderFilter, search]);

  const groupedOrders = useMemo(() => {
    function sortOldestFirst(items: StaffOrder[]) {
      return [...items].sort(
        (first, second) =>
          new Date(first.ordered_at).getTime() -
          new Date(second.ordered_at).getTime()
      );
    }

    return {
      pending_payment: sortOldestFirst(
        filteredOrders.filter((order) => order.status === "pending_payment")
      ),
      pending: sortOldestFirst(
        filteredOrders.filter((order) => order.status === "pending")
      ),
      preparing: sortOldestFirst(
        filteredOrders.filter((order) => order.status === "preparing")
      ),
      ready: sortOldestFirst(
        filteredOrders.filter((order) => order.status === "ready")
      ),
      out_for_delivery: sortOldestFirst(
        filteredOrders.filter((order) => order.status === "out_for_delivery")
      ),
    };
  }, [filteredOrders]);

  const summary = useMemo(() => {
    return {
      pending: activeOrders.filter((order) => order.status === "pending").length,
      preparing: activeOrders.filter((order) => order.status === "preparing")
        .length,
      ready: activeOrders.filter((order) => order.status === "ready").length,
      outForDelivery: activeOrders.filter(
        (order) => order.status === "out_for_delivery"
      ).length,
    };
  }, [activeOrders]);

  const rawStaffName = staffProfile?.fullName?.trim() || "Chrizelda";
  const normalizedStaffName =
    rawStaffName.replace(/^staff\s+/i, "").trim() || "Chrizelda";
  const staffFirstName = normalizedStaffName.split(/\s+/)[0] || "Chrizelda";
  const staffRole =
    staffProfile?.role?.replace("_", " ").replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    ) || "Staff";
  const queueSummaryCards = [
    {
      label: "Pending",
      value: summary.pending,
      helper: "Needs acceptance",
      accent: "bg-[#0D2E18]",
      valueColor: "text-[#0D2E18]",
    },
    {
      label: "Preparing",
      value: summary.preparing,
      helper: "Being made",
      accent: "bg-[#2D7A40]",
      valueColor: "text-[#0D2E18]",
    },
    {
      label: "Ready",
      value: summary.ready,
      helper: "Next handoff",
      accent: "bg-[#0F441D]",
      valueColor: "text-[#0F441D]",
    },
    {
      label: "Out for delivery",
      value: summary.outForDelivery,
      helper: "Needs completion",
      accent: "bg-[#684B35]",
      valueColor: "text-[#684B35]",
    },
  ];
  
  const selectedFinalDeliveryFee = Number(finalDeliveryFeeInput);
  const selectedProjectedTotal =
    selectedOrder && Number.isFinite(selectedFinalDeliveryFee)
      ? getOrderSubtotal(selectedOrder) + Math.max(0, selectedFinalDeliveryFee)
      : selectedOrder?.total_amount ?? 0;
  const selectedOrderElapsedMinutes = selectedOrder
    ? getElapsedMinutes(selectedOrder.ordered_at, now)
    : 0;
  const selectedOrderHeatmapStyle = getQueueHeatmapStyle(
    selectedOrderElapsedMinutes
  );
  const selectedOrderItemQuantity = selectedOrder
    ? getOrderItemQuantity(selectedOrder)
    : 0;
  const selectedOrderFocusLabel = selectedOrder
    ? getQueueFocusLabel(
        selectedOrder,
        selectedOrder.status === "pending"
          ? getMinutesUntilExpiration(selectedOrder.ordered_at, now)
          : null
      )
    : "";
  const selectedOrderRemarks = selectedOrder
    ? getOrderSpecialRemarks(selectedOrder)
    : [];
  const syncMeta = isLoading || isSyncing
    ? "Syncing..."
    : `Auto-sync 15s${
        lastSyncedAt
          ? ` - Last ${lastSyncedAt.toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
            })}`
          : ""
      }`;

  const headerContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    headerContainerRef.current = document.getElementById(
      "staff-header-controls"
    ) as HTMLElement | null;
  }, []);

  function TopbarControlsPortal() {
    if (!headerContainerRef.current) return null;

    const controls = (
      <div className="flex w-full items-center gap-3">
        <button
          type="button"
          onClick={() => loadOrders({ showLoading: true })}
          disabled={isLoading}
          title="Force refresh order queue"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D6C6AC] bg-white text-[#684B35] transition hover:bg-[#FFF0DA] disabled:opacity-60"
        >
          <RefreshCw
            size={15}
            className={isLoading || isSyncing ? "animate-spin" : ""}
          />
          <span className="sr-only">
            {isLoading || isSyncing
              ? "Syncing latest orders"
              : "Sync latest orders"}
          </span>
        </button>

        <label className="hidden sm:flex h-10 min-w-[220px] items-center gap-2 rounded-xl border border-[#E7DDCC] bg-white px-3">
          <Search size={16} className="text-[#8C7A64]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search orders..."
            className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
          />
        </label>

        <span
          className={`hidden sm:inline-flex h-9 items-center gap-2 rounded-full px-3 font-sans text-xs font-semibold ${
            stationStatus === "accepting"
              ? "bg-[#E6F2E8] text-[#0D2E18]"
              : stationStatus === "busy"
              ? "bg-[#FFF0DA] text-[#684B35]"
              : "bg-[#FFF1EC] text-[#9C543D]"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current" />
          {stationStatus === "accepting"
            ? "Accepting"
            : stationStatus === "busy"
            ? "Busy"
            : "Closed"}
        </span>

        <select
          value={storeOverrideStatus}
          onChange={(event) =>
            handleStoreOverrideChange(event.target.value as StoreOverrideStatus)
          }
          disabled={isStoreStatusUpdating}
          aria-label="Store status override"
          className="hidden sm:inline-flex h-9 rounded-full border border-[#D6C6AC] bg-white px-3 font-sans text-xs font-semibold text-[#684B35] outline-none transition hover:bg-[#FFF0DA] disabled:opacity-60"
        >
          <option value="auto">Auto</option>
          <option value="open">Open</option>
          <option value="busy">Busy</option>
          <option value="closed">Closed</option>
        </select>

        <p className="hidden sm:block font-sans text-[11px] text-[#8C7A64]">
          {syncMeta}
        </p>
      </div>
    );

    return createPortal(controls, headerContainerRef.current);
  }

  const applyStoreStatus = useCallback((status: StoreStatusPayload) => {
    setStoreOverrideStatus(status.overrideStatus);
    setStationStatus(
      status.effectiveStatus === "open" ? "accepting" : status.effectiveStatus
    );
    setStoreStatusError(
      status.setupRequired
        ? "Store status table is not set up yet. Schedule still works, but manual override needs Supabase setup."
        : ""
    );
  }, []);

  const loadStoreStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/store-status");
      const result = (await response.json()) as StoreStatusPayload & {
        error?: string;
      };

      if (!response.ok) {
        setStoreStatusError(result.error || "Failed to load store status.");
        return;
      }

      applyStoreStatus(result);
    } catch {
      setStoreStatusError("Something went wrong while loading store status.");
    }
  }, [applyStoreStatus]);

  useEffect(() => {
    loadOrders({ showLoading: true });
    loadStoreStatus();
  }, [loadStoreStatus]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("staff-order-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          void loadOrders({ showLoading: false });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
        },
        () => {
          void loadOrders({ showLoading: false });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "store_settings",
        },
        () => {
          void loadStoreStatus();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadStoreStatus]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadOrders({ showLoading: false });
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!dispatchToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDispatchToast("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [dispatchToast]);

  useEffect(() => {
    if (!staffToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStaffToast("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [staffToast]);

  useEffect(() => {
    const expiredPending = orders.filter(
      (order) =>
        order.status === "pending" &&
        isPendingOrderExpired(order.ordered_at, now) &&
        !expiringOrderIds.includes(order.id)
    );

    if (expiredPending.length === 0) {
      return;
    }

    const ids = expiredPending.map((order) => order.id);
    let isCancelled = false;

    const run = async () => {
      setExpiringOrderIds((current) => [...current, ...ids]);

      try {
        await Promise.all(
          ids.map(async (orderId) => {
            await fetch("/api/staff/orders/update-status", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                orderId,
                action: "expire",
                expectedStatus: "pending",
              }),
            });
          })
        );

        if (!isCancelled) {
          setStaffToast("Expired pending orders were moved to history.");
          await loadOrders({ showLoading: false });
        }
      } finally {
        if (!isCancelled) {
          setExpiringOrderIds((current) =>
            current.filter((id) => !ids.includes(id))
          );
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [expiringOrderIds, loadOrders, now, orders]);

  function openOrder(order: StaffOrder) {
    setSelectedOrder(order);
    const savedDeliveryFee = Math.round(getDeliveryFee(order));
    setFinalDeliveryFeeInput(
      requiresFinalDeliveryFee(order) && savedDeliveryFee === 0
        ? ""
        : String(savedDeliveryFee)
    );
    setIsConfirmingCancel(false);
  }

  function closeOrder() {
    setSelectedOrder(null);
    setFinalDeliveryFeeInput("");
    setIsConfirmingCancel(false);
  }

  async function handleStoreOverrideChange(overrideStatus: StoreOverrideStatus) {
    setIsStoreStatusUpdating(true);
    setStoreStatusError("");

    try {
      const response = await fetch("/api/store-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ overrideStatus }),
      });
      const result = (await response.json()) as StoreStatusPayload & {
        error?: string;
      };

      if (!response.ok) {
        setStoreStatusError(result.error || "Failed to update store status.");
        return;
      }

      applyStoreStatus(result);
    } catch {
      setStoreStatusError("Something went wrong while updating store status.");
    } finally {
      setIsStoreStatusUpdating(false);
    }
  }

  async function loadOrders({
    showLoading = true,
  }: {
    showLoading?: boolean;
  } = {}) {
    if (showLoading) {
      setIsLoading(true);
      setError("");
    } else {
      setIsSyncing(true);
    }

    try {
      const response = await fetch("/api/staff/orders/list", {
        method: "GET",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to load staff orders.");
        return;
      }


      startTransition(() => {
        setOrders(result.orders ?? []);
        setStaffProfile(result.staffProfile ?? null);
        setIsBootstrapped(true);
        setLastSyncedAt(new Date());
        setSelectedOrder((currentSelectedOrder) => {
          if (!currentSelectedOrder) {
            return null;
          }

          return (
            (result.orders ?? []).find(
              (order: StaffOrder) => order.id === currentSelectedOrder.id
            ) ?? null
          );
        });
      });
    } catch {
      setError("Something went wrong while loading orders.");
    } finally {
      if (showLoading) {
        setIsLoading(false);
      } else {
        setIsSyncing(false);
      }
    }
  }

  async function handleAdvance(
    orderId: string,
    expectedStatus: OrderStatus,
    options: { finalDeliveryFee?: number } = {}
  ) {
    if (updatingOrderIds.includes(orderId)) {
      return;
    }

    setError("");
    setUpdatingOrderIds((current) => [...current, orderId]);

    try {
      const response = await fetch("/api/staff/orders/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          expectedStatus,
          finalDeliveryFee: options.finalDeliveryFee,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to update order status.");
        if (result.currentStatus) {
          await loadOrders();
        }
        return;
      }

      if (result.nextStatus === "out_for_delivery") {
        setDispatchToast(
          result.notificationSent
            ? "Email Sent"
            : "Out for delivery. Email not configured."
        );
      }

      if (result.nextStatus === "delivered") {
        setStaffToast(
          result.receiptSent
            ? "Delivery receipt sent."
            : "Delivered. Receipt email not configured."
        );
      }

      await loadOrders();
      router.refresh();
    } catch {
      setError("Something went wrong while updating status.");
    } finally {
      setUpdatingOrderIds((current) =>
        current.filter((updatingOrderId) => updatingOrderId !== orderId)
      );
    }
  }

  async function handleMarkPaid(orderId: string) {
    setError("");
    setIsMarkingPaid(true);

    try {
      const response = await fetch("/api/staff/orders/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, action: "mark_paid" }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to mark order as paid.");
        return;
      }

      setStaffToast(
        "Payment marked paid. Complete delivery to send the receipt."
      );

      await loadOrders();
      router.refresh();
    } catch {
      setError("Something went wrong while marking payment as paid.");
    } finally {
      setIsMarkingPaid(false);
    }
  }

  async function handleCancel(orderId: string) {
    setError("");
    setIsCancelling(true);

    try {
      const response = await fetch("/api/staff/orders/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to cancel order.");
        return;
      }

      closeOrder();
      await loadOrders();
      router.refresh();
    } catch {
      setError("Something went wrong while cancelling the order.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFF0DA] text-[#0D2E18]">
      <TopbarControlsPortal />

      <section className="px-4 py-4 lg:px-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {queueSummaryCards.map((card) => (
            <div
              key={card.label}
              className="overflow-hidden rounded-[18px] border border-[#DCCFB8] bg-white shadow-[0_6px_16px_rgba(104,75,53,0.05)]"
            >
              <div className={`h-1.5 ${card.accent}`} />
              <div className="flex items-end justify-between gap-3 p-3">
                <div>
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#8C7A64]">
                    {card.label}
                  </p>
                  <p className="mt-1 font-sans text-xs text-[#6E5D49]">
                    {card.helper}
                  </p>
                </div>
                <p className={`font-sans text-3xl font-bold ${card.valueColor}`}>
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {error ? (
          <div className="mt-4 rounded-[16px] bg-[#FFF1EC] px-4 py-3 font-sans text-sm text-[#9C543D]">
            {error}
          </div>
        ) : null}

        {storeStatusError ? (
          <div className="mt-4 rounded-[16px] bg-[#FFF8EF] px-4 py-3 font-sans text-sm font-semibold text-[#684B35]">
            {storeStatusError}
          </div>
        ) : null}

        {staffToast ? (
          <div className="mt-4 rounded-[16px] bg-[#E7F4EA] px-4 py-3 font-sans text-sm font-semibold text-[#0F7A40]">
            {staffToast}
          </div>
        ) : null}

        {!isBootstrapped ? (
          <div className="mt-4 rounded-[18px] border border-[#DCCFB8] bg-white p-4 shadow-[0_6px_16px_rgba(104,75,53,0.05)]">
            <p className="font-sans text-lg font-semibold text-[#0D2E18]">
              Load staff orders
            </p>
            <p className="mt-1 font-sans text-sm text-[#6E5D49]">
              Click Refresh Orders to fetch live active orders from Supabase.
            </p>
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5 xl:items-start">
          {boardColumns.map((column, index) => {
            const columnOrders = groupedOrders[column.key] ?? [];
            const isLastColumn = index === boardColumns.length - 1;

            return (
              <section
                key={column.key}
                className={`relative rounded-[20px] border p-3 shadow-[0_10px_24px_rgba(104,75,53,0.06)] ${column.header}`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} />
                      <h2 className="font-sans text-base font-black text-[#0D2E18]">
                        {column.label}
                      </h2>
                    </div>
                    <p className="mt-1 truncate font-sans text-[11px] font-semibold text-[#8C7A64]">
                      {column.caption}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 font-sans text-xs font-black ${column.count}`}
                  >
                    {columnOrders.length}
                  </span>

                  {!isLastColumn ? (
                    <span
                      aria-hidden="true"
                      className="hidden xl:flex absolute -right-5 top-2 z-10 items-center justify-center rounded-full border border-[#D6C6AC] bg-[#FFF8EF] p-1 text-[#0D2E18]"
                    >
                      <ArrowRight size={14} strokeWidth={2.4} />
                    </span>
                  ) : null}
                </div>

                {column.key === "out_for_delivery" && dispatchToast ? (
                  <div className="mb-3 rounded-full border border-[#684B35]/20 bg-[#FFF8EF] px-3 py-1.5 text-center font-sans text-xs font-semibold text-[#684B35] shadow-[0_6px_14px_rgba(104,75,53,0.08)]">
                    {dispatchToast}
                  </div>
                ) : null}

                <div className="space-y-3">
                  {columnOrders.length === 0 ? (
                    <div className="rounded-[16px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-3 py-5 text-center font-sans text-sm text-[#8C7A64]">
                      No orders here
                    </div>
                  ) : null}

                  {columnOrders.map((order) => {
                    const items = formatOrderSummary(order);
                    const nextAction = getNextActionLabel(
                      order.order_type,
                      order.status
                    );
                    const minutesUntilExpiry =
                      order.status === "pending"
                        ? getMinutesUntilExpiration(order.ordered_at, now)
                        : null;
                    const isExpiredPendingOrder =
                      order.status === "pending" &&
                      isPendingOrderExpired(order.ordered_at, now);
                    const paymentRequired = requiresPaymentBeforeNextAction(order);
                    const isUpdatingOrder = updatingOrderIds.includes(order.id);
                    const isExpiringOrder = expiringOrderIds.includes(order.id);
                    const orderEmail = getOrderEmail(order);
                    const orderPhone = getOrderPhone(order);
                    const elapsedMinutes = getElapsedMinutes(order.ordered_at, now);
                    const heatmapStyle = getQueueHeatmapStyle(elapsedMinutes);
                    const queueFocusLabel = getQueueFocusLabel(
                      order,
                      minutesUntilExpiry
                    );
                    const itemQuantity = getOrderItemQuantity(order);

                    return (
                      <article
                        key={order.id}
                        onClick={() => openOrder(order)}
                        className={`group/order cursor-pointer overflow-hidden rounded-[18px] border transition hover:-translate-y-0.5 hover:border-[#CBB68F] hover:shadow-[0_14px_28px_rgba(104,75,53,0.12)] ${heatmapStyle.card}`}
                      >
                        <div
                          className={`h-1.5 ${
                            heatmapStyle.rail || getQueueAccent(order.status)
                          }`}
                        />
                        <div className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-sans text-[1.2rem] font-black leading-none text-[#0D2E18]">
                              {formatOrderCode(order.id)}
                            </p>
                            <div className="mt-2 flex items-center gap-1.5 font-sans text-xs font-bold text-[#684B35]">
                              <UserRound size={13} />
                              <span className="truncate">
                                {getOrderDisplayName(order)}
                              </span>
                            </div>
                            {orderEmail || orderPhone ? (
                              <p className="mt-1 max-h-0 overflow-hidden font-sans text-[11px] leading-snug text-[#8C7A64] opacity-0 transition-all duration-200 group-hover/order:max-h-10 group-hover/order:opacity-100 group-focus-within/order:max-h-10 group-focus-within/order:opacity-100">
                                {[orderEmail, orderPhone].filter(Boolean).join(" | ")}
                              </p>
                            ) : null}
                          </div>

                          <span
                            className={`inline-flex shrink-0 rounded-full px-2.5 py-1 font-sans text-xs font-bold ${getStatusBadgeStyle(
                              order.status
                            )}`}
                          >
                            {formatStatus(order.status)}
                          </span>
                        </div>

                        <div
                          className={`mt-3 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 font-sans text-xs ${heatmapStyle.panel}`}
                        >
                          <span className="font-black uppercase tracking-[0.12em] text-[#8C7A64]">
                            Queue Heat
                          </span>
                          <span className="font-black text-[#0D2E18]">
                            {heatmapStyle.label}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 font-sans text-xs">
                          <span
                            className={`inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-1 font-bold ${getQueueAgeStyle(
                              elapsedMinutes
                            )}`}
                          >
                            <Clock3 size={13} />
                            {formatElapsed(order.ordered_at, now)}
                          </span>

                          <span className="inline-flex items-center justify-center gap-1 rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-2.5 py-1 font-bold text-[#684B35]">
                            <ClipboardList size={13} />
                            {itemQuantity} item{itemQuantity === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {minutesUntilExpiry !== null ? (
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-bold ${getExpirationCountdownStyle(
                                minutesUntilExpiry
                              )}`}
                            >
                              {formatExpirationCountdown(minutesUntilExpiry)}
                            </span>
                          ) : null}

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-bold ${getOrderTypeStyle(
                              order.order_type
                            )}`}
                          >
                            {order.order_type === "pickup"
                              ? "Pickup"
                              : "Delivery"}
                          </span>

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-bold ${getPaymentStyle(
                              order.payment_method
                            )}`}
                          >
                            {getPaymentLabel(order)}
                          </span>

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-bold ${getPaymentStatusStyle(
                              order
                            )}`}
                          >
                            {getPaymentStatusLabel(order)}
                          </span>
                        </div>

                        <div className={`mt-3 rounded-xl border px-3 py-2 ${heatmapStyle.panel}`}>
                          <p className="font-sans text-[11px] font-black uppercase tracking-[0.12em] text-[#8C7A64]">
                            Focus
                          </p>
                          <p className="mt-0.5 font-sans text-sm font-bold text-[#0D2E18]">
                            {queueFocusLabel}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 font-sans">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#3C332A]">
                              {items[0] ?? "No item summary"}
                            </p>
                            <p className="mt-0.5 text-xs text-[#8C7A64]">
                              {items.length > 1
                                ? `+${items.length - 1} more line item${items.length === 2 ? "" : "s"}`
                                : `Placed ${formatTime(order.ordered_at)}`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[11px] text-[#9A856C]">Total</p>
                            <p className="text-base font-black text-[#684B35]">
                              {peso(order.total_amount)}
                            </p>
                          </div>
                        </div>

                        {order.order_type === "delivery" ? (
                          <div className={`mt-3 grid grid-cols-3 gap-2 rounded-xl border px-3 py-2 font-sans text-xs ${heatmapStyle.panel}`}>
                            <div>
                              <p className="text-[#8C7A64]">Items</p>
                              <p className="mt-0.5 font-bold text-[#0D2E18]">
                                {peso(getOrderSubtotal(order))}
                              </p>
                            </div>
                            <div>
                              <p className="text-[#8C7A64]">Delivery Fee</p>
                              <p className="mt-0.5 font-bold text-[#0D2E18]">
                                {peso(getDeliveryFee(order))}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[#8C7A64]">Total</p>
                              <p className="mt-0.5 font-bold text-[#684B35]">
                                {peso(order.total_amount)}
                              </p>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#EFE3CF] pt-3">
                          <div className="inline-flex items-center gap-1.5 font-sans text-xs font-bold text-[#6E5D49]">
                            {order.order_type === "delivery" ? (
                              <Truck size={14} />
                            ) : (
                              <CircleDollarSign size={14} />
                            )}
                            {order.order_type === "delivery"
                              ? "Delivery flow"
                              : "Counter flow"}
                          </div>

                          {nextAction ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (isExpiredPendingOrder || isExpiringOrder) {
                                  return;
                                }

                                if (paymentRequired) {
                                  openOrder(order);
                                  return;
                                }

                                if (requiresFinalDeliveryFee(order)) {
                                  openOrder(order);
                                  setStaffToast("Delivery fee is missing. Add it before dispatch.");
                                  return;
                                }

                                handleAdvance(order.id, order.status);
                              }}
                              disabled={isUpdatingOrder || isExpiredPendingOrder || isExpiringOrder}
                              className={`rounded-xl px-3 py-2 font-sans text-xs font-black transition ${
                                isExpiredPendingOrder || isExpiringOrder
                                  ? "border border-[#D6C6AC] bg-[#F4EEE6] text-[#8A755D]"
                                  : paymentRequired
                                  ? "border border-[#B76522]/30 bg-[#FFF8EF] text-[#B76522]"
                                  : `text-white ${getColumnActionStyle(order.status)}`
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              {isExpiredPendingOrder || isExpiringOrder
                                ? "Expired"
                                : paymentRequired
                                ? "Mark Paid First"
                                : isUpdatingOrder
                                ? "Updating..."
                                : nextAction}
                            </button>
                          ) : (
                            <span className="font-sans text-sm text-[#8C7A64]">
                              No next action
                            </span>
                          )}
                        </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div
          id="order-history"
          className="mt-5 scroll-mt-5 rounded-[20px] border border-[#DCCFB8] bg-[#F9F1E4] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-sans text-xs uppercase tracking-[0.14em] text-[#684B35]">
                Session Summary
              </p>
              <h2 className="mt-1 font-sans text-xl font-bold text-[#0D2E18]">
                Latest finished, cancelled, and expired orders
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#EFE3CF] px-2.5 py-1 font-sans text-xs font-semibold text-[#684B35]">
                {historyOrders.length} shown
              </span>
              <Link
                href="/staff/order-history"
                className="rounded-full bg-[#0D2E18] px-3 py-1.5 font-sans text-xs font-semibold text-[#FFF0DA]"
              >
                Open History
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {historyOrders.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-[#D8C8AA] bg-[#FFF8EF] px-4 py-5 text-center font-sans text-sm text-[#8C7A64]">
                No finished orders yet
              </div>
            ) : null}

            {historyOrders.map((order) => {
              const items = formatOrderSummary(order);

              return (
                <article
                  key={order.id}
                  onClick={() => openOrder(order)}
                  className="cursor-pointer rounded-[18px] border border-[#DCCFB8] bg-white p-3 shadow-[0_6px_16px_rgba(104,75,53,0.05)] transition hover:shadow-[0_10px_20px_rgba(104,75,53,0.09)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-sans text-[1.15rem] font-bold leading-none text-[#0D2E18]">
                        {formatOrderCode(order.id)}
                      </p>
                      <p className="mt-1 font-sans text-xs font-semibold text-[#684B35]">
                        {getOrderDisplayName(order)}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getStatusBadgeStyle(
                        order.status
                      )}`}
                    >
                      {formatStatus(order.status)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getOrderTypeStyle(
                        order.order_type
                      )}`}
                    >
                      {order.order_type === "pickup" ? "Pickup" : "Delivery"}
                    </span>

                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getPaymentStyle(
                        order.payment_method
                      )}`}
                    >
                      {getPaymentLabel(order)}
                    </span>

                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${getPaymentStatusStyle(
                        order
                      )}`}
                    >
                      {getPaymentStatusLabel(order)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1">
                    {items.slice(0, 2).map((item, index) => (
                      <p
                        key={`${order.id}-${index}-${item}`}
                        className="font-sans text-sm text-[#3C332A]"
                      >
                        {item}
                      </p>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="font-sans text-sm text-[#9A856C]">
                      {formatDateTime(order.ordered_at)}
                    </p>
                    <p className="font-sans text-lg font-semibold text-[#684B35]">
                      {peso(order.total_amount)}
                    </p>
                  </div>

                  {order.order_type === "delivery" ? (
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-[#EFE3CF] bg-[#FFF8EF] px-3 py-2 font-sans text-xs">
                      <div>
                        <p className="text-[#8C7A64]">Items</p>
                        <p className="mt-0.5 font-bold text-[#0D2E18]">
                          {peso(getOrderSubtotal(order))}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#8C7A64]">Delivery Fee</p>
                        <p className="mt-0.5 font-bold text-[#0D2E18]">
                          {peso(getDeliveryFee(order))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#8C7A64]">Total</p>
                        <p className="mt-0.5 font-bold text-[#684B35]">
                          {peso(order.total_amount)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {selectedOrder ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-[#0D2E18]/35"
            onClick={closeOrder}
          />

          <aside className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-t-[22px] border border-[#DCCFB8] bg-[#FFF8EF] shadow-[-18px_0_40px_rgba(13,46,24,0.18)] sm:inset-y-0 sm:left-auto sm:right-0 sm:mx-0 sm:h-screen sm:max-h-none sm:w-[30rem] sm:rounded-none sm:rounded-l-[22px] sm:border-y-0 sm:border-r-0">
            <div className={`h-1.5 ${selectedOrderHeatmapStyle.rail || getQueueAccent(selectedOrder.status)}`} />
            <div className="border-b border-[#DCCFB8] bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-sans text-xs font-black uppercase tracking-[0.16em] text-[#684B35]">
                    Order Details
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h2 className="font-sans text-[1.45rem] font-black leading-none text-[#0D2E18]">
                      {formatOrderCode(selectedOrder.id)}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-1 font-sans text-xs font-black ${getStatusBadgeStyle(
                        selectedOrder.status
                      )}`}
                    >
                      {formatStatus(selectedOrder.status)}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-sans text-sm font-semibold text-[#684B35]">
                    {getOrderDisplayName(selectedOrder)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeOrder}
                  className="rounded-full border border-[#DCCFB8] bg-[#FFF8EF] p-2 text-[#0D2E18] transition hover:bg-[#FFF0DA]"
                >
                  <X size={20} />
                </button>
              </div>

              <div className={`mt-3 flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 font-sans text-xs ${selectedOrderHeatmapStyle.panel}`}>
                <span className="font-black uppercase tracking-[0.12em] text-[#8C7A64]">
                  Queue Heat
                </span>
                <span className="font-black text-[#0D2E18]">
                  {selectedOrderHeatmapStyle.label}
                </span>
                <span className="text-[#B59A79]">|</span>
                <span className="font-bold text-[#684B35]">
                  {formatElapsed(selectedOrder.ordered_at, now)}
                </span>
                <span className="text-[#B59A79]">|</span>
                <span className="font-bold text-[#684B35]">
                  {selectedOrderItemQuantity} item{selectedOrderItemQuantity === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <div className="grid gap-2">
                <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                  <p className="font-sans text-xs font-black uppercase tracking-[0.12em] text-[#684B35]">
                    Fulfillment
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-bold ${getOrderTypeStyle(
                        selectedOrder.order_type
                      )}`}
                    >
                      {selectedOrder.order_type === "pickup"
                        ? "Pickup"
                        : "Delivery"}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-bold ${getPaymentStyle(
                        selectedOrder.payment_method
                      )}`}
                    >
                      {getPaymentLabel(selectedOrder)}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 font-sans text-xs font-bold ${getPaymentStatusStyle(
                        selectedOrder
                      )}`}
                    >
                      {getPaymentStatusLabel(selectedOrder)}
                    </span>
                  </div>
                </div>

                <div className={`rounded-[16px] border p-3 ${selectedOrderHeatmapStyle.panel}`}>
                  <p className="font-sans text-xs font-black uppercase tracking-[0.12em] text-[#684B35]">
                    Current Focus
                  </p>
                  <p className="mt-2 font-sans text-base font-black text-[#0D2E18]">
                    {selectedOrderFocusLabel}
                  </p>
                </div>
              </div>

              <div className="mt-2 grid gap-2">
                <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                  <p className="font-sans text-xs font-black uppercase tracking-[0.12em] text-[#8C7A64]">
                    Placed At
                  </p>
                  <p className="mt-1 font-sans text-sm font-bold text-[#0D2E18]">
                    {formatDateTime(selectedOrder.ordered_at)}
                  </p>
                </div>

                <div className="rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                  <p className="font-sans text-xs font-black uppercase tracking-[0.12em] text-[#8C7A64]">
                    Grand Total
                  </p>
                  <p className="mt-1 font-sans text-base font-black text-[#684B35]">
                    {peso(selectedOrder.total_amount)}
                  </p>
                </div>
              </div>

              {selectedOrder.order_type === "delivery" ? (
                <div className="mt-3 rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-sans text-xs font-black uppercase tracking-[0.12em] text-[#684B35]">
                        Delivery Fee
                      </p>
                      <p className="mt-1 font-sans text-xs text-[#6E5D49]">
                        Distance-based checkout total
                      </p>
                    </div>
                    <Truck size={20} className="text-[#684B35]" />
                  </div>

                  <div className="mt-3 space-y-1.5 font-sans text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-[#5F5346]">Items</span>
                      <span className="font-bold tabular-nums text-[#0D2E18]">
                        {peso(getOrderSubtotal(selectedOrder))}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#5F5346]">Delivery Fee</span>
                      <span className="font-bold tabular-nums text-[#0D2E18]">
                        {peso(getDeliveryFee(selectedOrder))}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-[#EFE3CF] pt-2">
                      <span className="font-bold text-[#684B35]">Grand Total</span>
                      <span className="font-bold tabular-nums text-[#684B35]">
                        {peso(
                          requiresFinalDeliveryFee(selectedOrder)
                            ? selectedProjectedTotal
                            : selectedOrder.total_amount
                        )}
                      </span>
                    </div>
                  </div>

                  {requiresFinalDeliveryFee(selectedOrder) ? (
                    <label className="mt-3 block">
                      <span className="font-sans text-sm font-semibold text-[#0D2E18]">
                        Missing delivery fee:
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="999"
                        inputMode="numeric"
                        value={finalDeliveryFeeInput}
                        onChange={(event) =>
                          setFinalDeliveryFeeInput(event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-[#D6C6AC] bg-[#FFF8EF] px-3 py-2.5 font-sans text-sm font-semibold text-[#0D2E18] outline-none transition focus:border-[#0D2E18] focus:ring-2 focus:ring-[#0D2E18]/10"
                        placeholder="Enter delivery fee"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-sans text-xs font-black uppercase tracking-[0.12em] text-[#684B35]">
                      Customer & Delivery
                    </p>
                    <p className="mt-1 font-sans text-sm font-bold text-[#0D2E18]">
                      {getOrderDisplayName(selectedOrder)}
                    </p>
                  </div>
                  <UserRound size={20} className="text-[#684B35]" />
                </div>

                <div className="mt-3 grid gap-2 font-sans text-sm text-[#3C332A]">
                  <div className="grid gap-2">
                    <div className="rounded-xl bg-[#FFF8EF] px-3 py-2">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8C7A64]">
                        Phone
                      </p>
                      <p className="mt-1 font-semibold text-[#0D2E18]">
                        {getOrderPhone(selectedOrder) || "No phone"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#FFF8EF] px-3 py-2">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8C7A64]">
                        Email
                      </p>
                      <p className="mt-1 truncate font-semibold text-[#0D2E18]">
                        {getOrderEmail(selectedOrder) || "No email"}
                      </p>
                    </div>
                  </div>

                  {selectedOrder.order_type === "delivery" ? (
                    <div className="rounded-xl bg-[#FFF8EF] px-3 py-2">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#8C7A64]">
                        Address
                      </p>
                      <p className="mt-1 font-semibold text-[#0D2E18]">
                        {selectedOrder.delivery_address || "No address"}
                      </p>

                      {hasDeliveryPin(selectedOrder) ? (
                        <a
                          href={buildOpenStreetMapUrl(
                            selectedOrder.delivery_lat as number,
                            selectedOrder.delivery_lng as number
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 rounded-full border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-1.5 font-sans text-xs font-bold text-[#0D2E18] transition hover:bg-[#FFF0DA]"
                        >
                          <MapPin size={13} />
                          View pinned map
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <p className="mt-1 font-sans text-xs text-[#8C7A64]">
                          No map pin saved for this delivery.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-sans text-xs font-black uppercase tracking-[0.12em] text-[#684B35]">
                    Order Items
                  </p>
                  <span className="rounded-full bg-[#EFE3CF] px-2.5 py-1 font-sans text-xs font-black text-[#684B35]">
                    {selectedOrderItemQuantity} item{selectedOrderItemQuantity === 1 ? "" : "s"}
                  </span>
                </div>

                {selectedOrder.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[16px] border border-[#DCCFB8] bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-sans text-base font-black text-[#0D2E18]">
                          {item.menu_items?.name ?? "Menu item"} ×{" "}
                          {item.quantity}
                        </p>

                        <div className="mt-2 space-y-1 font-sans text-sm text-[#5F5346]">
                          <p>
                            Size: {item.size} • Temp: {item.temperature}
                          </p>
                          <p>
                            Sweetness: {item.sugar_level === 0 ? "No Sugar" : `${item.sugar_level}% Sugar`}
                            {item.ice_level ? ` • Ice: ${item.ice_level}` : ""}
                          </p>

                          {item.addons && item.addons.length > 0 ? (
                            <p>
                              Add-ons:{" "}
                              {item.addons.map(formatAddonLabel).join(", ")}
                            </p>
                          ) : null}

                        </div>
                      </div>

                      <p className="shrink-0 font-sans text-base font-black text-[#684B35]">
                        {peso(item.unit_price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-[16px] border border-[#DCCFB8] bg-white p-3">
                <p className="font-sans text-xs font-black uppercase tracking-[0.12em] text-[#684B35]">
                  Special Remarks
                </p>

                <div className="mt-3 space-y-2">
                  {selectedOrderRemarks.length > 0 ? (
                    selectedOrderRemarks.map((remark, index) => (
                      <p
                        key={`${selectedOrder.id}-remark-${index}`}
                        className="rounded-xl border border-[#EFE3CF] bg-[#FFF8EF] px-3 py-2 font-sans text-sm font-semibold text-[#3C332A]"
                      >
                        {remark}
                      </p>
                    ))
                  ) : (
                    <p className="rounded-xl bg-[#FFF8EF] px-3 py-2 font-sans text-sm text-[#8C7A64]">
                      No special remarks recorded.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-[#DCCFB8] bg-white px-4 py-3">
              {isConfirmingCancel ? (
                <div className="rounded-[16px] border border-[#E8B8A8] bg-[#FFF1EC] p-3">
                  <p className="font-sans text-sm font-semibold text-[#9C543D]">
                    Cancel this order?
                  </p>
                  <p className="mt-1 font-sans text-sm text-[#9C543D]">
                    This will mark the order as cancelled and remove it from the
                    active board.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingCancel(false)}
                      className="rounded-xl border border-[#D6C6AC] bg-white px-3 py-2 font-sans text-xs font-semibold text-[#684B35]"
                    >
                      Keep Order
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCancel(selectedOrder.id)}
                      disabled={isCancelling}
                      className="rounded-xl bg-[#C55432] px-3 py-2 font-sans text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {isCancelling ? "Cancelling..." : "Yes, Cancel"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div>
                    <p className="font-sans text-base font-black text-[#0D2E18]">
                      Order actions
                    </p>
                    {!getFinalStatusMessage(selectedOrder.status) ? (
                      <p className="mt-1 font-sans text-sm text-[#8C7A64]">
                        Next move:{" "}
                        {requiresPaymentBeforeNextAction(selectedOrder)
                          ? "Collect payment first"
                          : getDrawerActionLabel(selectedOrder) ?? "No action needed"}
                      </p>
                    ) : null}
                    {getFinalStatusMessage(selectedOrder.status) ? (
                      <p className="mt-1 font-sans text-sm text-[#8C7A64]">
                        {getFinalStatusMessage(selectedOrder.status)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {canMarkPaid(selectedOrder) ? (
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(selectedOrder.id)}
                        disabled={isMarkingPaid}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#684B35] px-4 py-2.5 font-sans text-sm font-black text-white transition hover:bg-[#5A3F2D] disabled:opacity-60"
                      >
                        {isMarkingPaid ? <LoadingSpinner label="Marking paid" /> : null}
                        {isMarkingPaid ? "Marking..." : "Mark Paid"}
                      </button>
                    ) : null}

                    {canCancelOrder(selectedOrder) ? (
                      <button
                        type="button"
                        onClick={() => setIsConfirmingCancel(true)}
                        className="rounded-xl border border-[#D6C6AC] bg-[#FFF8EF] px-3 py-2 font-sans text-sm font-bold text-[#684B35] transition hover:bg-[#FFF0DA]"
                      >
                        Cancel Order
                      </button>
                    ) : null}

                    {getDrawerActionLabel(selectedOrder) ? (
                      !requiresPaymentBeforeNextAction(selectedOrder) ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const shouldRequireFinalDeliveryFee =
                              requiresFinalDeliveryFee(selectedOrder);
                            const finalDeliveryFee = Number(finalDeliveryFeeInput);

                            if (
                              shouldRequireFinalDeliveryFee &&
                              (!Number.isFinite(finalDeliveryFee) ||
                                finalDeliveryFee <= 0)
                            ) {
                              setError("Delivery fee is missing. Add it before dispatch.");
                              return;
                            }

                            await handleAdvance(
                              selectedOrder.id,
                              selectedOrder.status,
                              {
                                finalDeliveryFee: shouldRequireFinalDeliveryFee
                                  ? finalDeliveryFee
                                  : undefined,
                              }
                            );
                          }}
                          disabled={updatingOrderIds.includes(selectedOrder.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#0D2E18] px-4 py-2.5 font-sans text-sm font-black text-white transition hover:bg-[#123821] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingOrderIds.includes(selectedOrder.id) ? (
                            <LoadingSpinner label="Updating order" />
                          ) : null}
                          {updatingOrderIds.includes(selectedOrder.id)
                            ? "Updating..."
                            : getDrawerActionLabel(selectedOrder)}
                        </button>
                      ) : null
                    ) : (
                      <span className="rounded-xl bg-[#F4EEE6] px-3 py-2 font-sans text-sm font-semibold text-[#684B35]">
                        Final Status
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </main>
  );
}

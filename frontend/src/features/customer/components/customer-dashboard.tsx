"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Camera,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  CupSoda,
  HelpCircle,
  History,
  House,
  Languages,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  ShieldCheck,
  X,
  Minus,
  Plus,
  UserPen,
  UserRound,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/toast-provider";
import { useCart } from "@/features/customer/providers/cart-provider";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  getRecommendationsForCustomer,
  type RecommendationFeedback,
  type RecommendationGlobalRankItem,
  type RecommendationMenuItem,
  type RecommendationOrder,
} from "@/lib/recommendations";
import {
  formatNutritionMetric,
  getMenuItemNutrition,
  nutritionMetricLabels,
} from "@/lib/nutrition";
import type { CustomerMenuItem } from "@/types/menu";
import type { CustomerOrder } from "@/types/orders";
import type { FeedbackItem } from "@/types/feedback";

type Section = "home" | "menu" | "orders" | "feedback";
type ProfileFaq = "order" | "delivery";
type Filter =
  | "all"
  | "coffee"
  | "non-coffee"
  | "pastries"
  | "latte-series"
  | "premium-blends"
  | "best-deals";

type CustomerDashboardProps = {
  menuItems: CustomerMenuItem[];
  orders: CustomerOrder[];
  feedbackItems: FeedbackItem[];
  menuFeedbackByItemId?: Record<string, PublicMenuFeedbackSummary>;
  initialTopRecommendations?: TopRecommendation[];
  initialRecommendationSource?: "customer_preferences" | "analytics_items";
  preferenceSignals?: Array<{
    menuItemId: string;
    tasteRating?: number;
    strengthRating?: number;
    overallRating: number;
  }>;
  globalRecommendationOrders?: RecommendationOrder[];
  globalRecommendationFeedback?: RecommendationFeedback[];
  globalRecommendationRanking?: RecommendationGlobalRankItem[];
  initialSection?: Section;
  shouldShowEntrySplash?: boolean;
  customerProfile?: {
    fullName: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    satisfactionAverage: number | null;
  };
  isAuthenticated?: boolean;
};

type PublicMenuFeedbackSummary = {
  averageRating: number;
  ratingCount: number;
  comments: Array<{
    rating: number;
    comment: string;
    createdAt: string;
  }>;
};

type TopRecommendation = {
  rank: number;
  label: "Best for You" | "Top Seller" | "Popular Now";
  basis: "preference" | "top_seller" | "popularity";
  reason: string;
  item_id: string;
  item_name: string;
  price: number;
  image_url: string | null;
  preference_score: number | null;
  item: CustomerMenuItem;
};

type TopRecommendationsPayload = {
  source?: "customer_preferences" | "analytics_items";
  recommendations?: TopRecommendation[];
  error?: string;
};

type CustomerOrdersPayload = {
  orders?: CustomerOrder[];
  error?: string;
};

type MenuRecommendationCard = {
  item: CustomerMenuItem;
  label: string;
  basis: string;
  reason: string;
  score: number;
};

type CustomerNotification = {
  id: string;
  kind: "order" | "receipt" | "feedback";
  typeLabel: string;
  timestamp: string;
  title: string;
  body: string;
  actionLabel: string;
  orderId: string;
  receipt?: {
    itemsTotal: number;
    deliveryFee: number;
    grandTotal: number;
    paymentMethod: string;
    itemLines: string[];
  };
};

type ReopenableQrPhPayment = {
  orderId: string;
  qrCodeImageUrl: string;
  qrCodeLabel: string;
  totalAmount: number;
  expiresAt: string | null;
  expiresInMinutes: number;
};

const sections: Array<{
  id: Section;
  label: string;
  icon: typeof CupSoda;
}> = [
  { id: "home", label: "Home", icon: House },
  { id: "menu", label: "Menu", icon: CupSoda },
  { id: "orders", label: "My Orders", icon: ClipboardList },
];

const mobileTabs: Array<
  | {
      kind: "section";
      id: Section;
      label: string;
      icon: typeof CupSoda;
    }
  | {
      kind: "profile";
      label: string;
      icon: typeof UserRound;
    }
> = [
  { kind: "section", id: "home", label: "Home", icon: House },
  { kind: "section", id: "menu", label: "Menu", icon: CupSoda },
  { kind: "section", id: "orders", label: "Orders", icon: ClipboardList },
  { kind: "profile", label: "Profile", icon: UserRound },
];

const menuFilters: Array<{
  value: Exclude<Filter, "latte-series" | "premium-blends">;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "coffee", label: "Coffee" },
  { value: "non-coffee", label: "Non-Coffee" },
  { value: "pastries", label: "Pastries" },
  { value: "best-deals", label: "Best Deals" },
];

const sugarLevels = [
  { label: "0%", value: 0 },
  { label: "25%", value: 25 },
  { label: "50%", value: 50 },
  { label: "75%", value: 75 },
  { label: "100%", value: 100 },
];

const iceLevels = [
  { label: "No Ice", value: "no_ice" },
  { label: "Less", value: "less" },
  { label: "Regular", value: "regular" },
  { label: "Extra", value: "extra" },
];

const sizes = [
  { label: "Small", value: "small", price: 0 },
  { label: "Medium", value: "medium", price: 0 },
  { label: "Large", value: "large", price: 20 },
];

const temperatures = [
  { label: "Hot", value: "hot" },
  { label: "Iced", value: "iced" },
];

const onboardingStorageKey = "kadaserve_first_sip_onboarding_seen";
const customerSplashSessionKey = "kadaserve_show_customer_splash";
const feedbackDismissedOrdersStorageKey =
  "kadaserve_feedback_dismissed_orders";
const feedbackMaybeLaterStorageKey = "kadaserve_feedback_maybe_later_orders";
const notificationsReadStorageKey = "kadaserve_read_notifications";
const feedbackMaybeLaterDelayMs = 30 * 60 * 1000;
const checkoutOrderTypeStorageKey = "kadaserve_checkout_order_type";
const promotionImages = [
  "/images/promotions/promotion1.png",
  "/images/promotions/promotion2.png",
];

const addons = [
  { label: "Extra Sugar", value: "extra_sugar", price: 10 },
  { label: "Extra Coffee", value: "extra_coffee", price: 20 },
  { label: "Extra Milk", value: "extra_milk", price: 15 },
  { label: "Vanilla Syrup", value: "vanilla_syrup", price: 15 },
  { label: "Caramel Syrup", value: "caramel_syrup", price: 15 },
  { label: "Hazelnut Syrup", value: "hazelnut_syrup", price: 15 },
  { label: "Chocolate Syrup", value: "chocolate_syrup", price: 15 },
];

function formatPrice(value: number) {
  return `₱${Math.round(value)}`;
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

function formatRating(value: number) {
  return Number(value).toFixed(1);
}

function formatRatingCount(value: number) {
  return `${value} rating${value === 1 ? "" : "s"}`;
}

function getMenuFeedback(
  feedbackByItemId: Record<string, PublicMenuFeedbackSummary>,
  item: Pick<CustomerMenuItem, "id">
) {
  const feedback = feedbackByItemId[item.id];

  return feedback && feedback.ratingCount > 0 ? feedback : null;
}

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isToday) {
    return `Today, ${time}`;
  }

  if (isYesterday) {
    return `Yesterday, ${time}`;
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatOrderType(orderType: CustomerOrder["order_type"]) {
  return orderType === "pickup" ? "Pickup" : "Delivery";
}

function formatOrderItemSummary(itemNames: string[]) {
  if (itemNames.length === 0) return "Order items";
  if (itemNames.length === 1) return itemNames[0];
  return `${itemNames[0]} + ${itemNames.length - 1} more`;
}

function getFeedbackEmoji(itemName: string) {
  const text = itemName.toLowerCase();

  if (text.includes("matcha")) return "🍵";
  if (text.includes("strawberry")) return "🍓";
  if (text.includes("mocha") || text.includes("chocolate")) return "🍫";
  if (text.includes("tea")) return "🧋";
  return "☕";
}

function isFeedbackEligibleStatus(status: CustomerOrder["status"]) {
  return status === "completed" || status === "delivered";
}

function readStoredOrderIds(storageKey: string) {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];

    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStoredOrderIds(storageKey: string, orderIds: string[]) {
  window.localStorage.setItem(storageKey, JSON.stringify([...new Set(orderIds)]));
}

function readMaybeLaterOrders() {
  try {
    const rawValue = window.localStorage.getItem(feedbackMaybeLaterStorageKey);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};

    return parsedValue &&
      typeof parsedValue === "object" &&
      !Array.isArray(parsedValue)
      ? (parsedValue as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

function writeMaybeLaterOrders(orderMap: Record<string, number>) {
  window.localStorage.setItem(
    feedbackMaybeLaterStorageKey,
    JSON.stringify(orderMap)
  );
}

function formatOrderCode(id: string) {
  return id.startsWith("#") ? id : `#${id.slice(0, 8).toUpperCase()}`;
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "KC";
  }

  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

function getPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("639")) {
    return `0${digits.slice(2, 12)}`;
  }

  return digits.slice(0, 11);
}

function formatProfilePhone(value: string) {
  const digits = getPhoneDigits(value);

  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
}

function isValidProfileName(value: string) {
  return /^[A-Za-z\s.'-]{2,80}$/.test(value.trim());
}

function isValidOptionalPhone(value: string) {
  const digits = getPhoneDigits(value);
  return digits.length === 0 || /^09\d{9}$/.test(digits);
}

function formatStatus(status: CustomerOrder["status"]) {
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
      return "Delivering";
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

function getOrderNotificationTitle(order: CustomerOrder) {
  switch (order.status) {
    case "pending_payment":
      return "Payment is pending";
    case "pending":
      return "Order received";
    case "preparing":
      return "Your order is being prepared";
    case "ready":
      return order.order_type === "pickup"
        ? "Ready for pickup"
        : "Order is ready";
    case "out_for_delivery":
      return "Order is out for delivery";
    default:
      return `${formatStatus(order.status)} order`;
  }
}

function getOrderNotificationBody(order: CustomerOrder) {
  const itemSummary = formatOrderItemSummary(
    order.order_items
      .map((item) => item.menu_items?.name)
      .filter(Boolean) as string[]
  );

  if (order.status === "ready" && order.order_type === "pickup") {
    return `${formatOrderCode(order.id)} is ready at the cafe counter. ${itemSummary}`;
  }

  if (order.status === "out_for_delivery") {
    return `${formatOrderCode(order.id)} is on the way. ${itemSummary}`;
  }

  return `${formatOrderCode(order.id)} is ${formatStatus(
    order.status
  ).toLowerCase()}. ${itemSummary}`;
}

function getCustomerPaymentMethodLabel(method?: CustomerOrder["payment_method"]) {
  switch (method) {
    case "cash":
      return "Cash";
    case "gcash":
      return "GCash";
    case "online":
      return "Online Payment";
    default:
      return "Payment";
  }
}

function getNotificationTimestamp(order: CustomerOrder) {
  return order.updated_at || order.ordered_at;
}

function getOrderReceipt(order: CustomerOrder) {
  const deliveryFee =
    order.order_type === "delivery" ? Number(order.delivery_fee ?? 0) : 0;
  const itemLines = order.order_items.map((item) => {
    const name = item.menu_items?.name ?? "Menu item";
    const total = Number(item.unit_price ?? 0) * item.quantity;

    return `${name} x ${item.quantity} - ${formatPrice(total)}`;
  });
  const itemsTotal =
    order.order_items.length > 0
      ? order.order_items.reduce(
          (sum, item) => sum + Number(item.unit_price ?? 0) * item.quantity,
          0
        )
      : Math.max(0, Number(order.total_amount ?? 0) - deliveryFee);

  return {
    itemsTotal,
    deliveryFee,
    grandTotal: Number(order.total_amount ?? 0),
    paymentMethod: getCustomerPaymentMethodLabel(order.payment_method),
    itemLines,
  };
}

function getReopenableQrPhPayment(order: CustomerOrder | null) {
  if (
    !order ||
    order.status !== "pending_payment" ||
    order.payment_method !== "online" ||
    order.payment_status !== "unpaid" ||
    !order.paymongo_qr_code_image_url
  ) {
    return null;
  }

  const expiresAt = order.paymongo_qr_expires_at
    ? new Date(order.paymongo_qr_expires_at).getTime()
    : 0;

  if (expiresAt && expiresAt <= Date.now()) {
    return null;
  }

  return {
    orderId: order.id,
    qrCodeImageUrl: order.paymongo_qr_code_image_url,
    qrCodeLabel: order.paymongo_qr_code_label || "KadaServe QR Ph",
    totalAmount: order.total_amount,
    expiresAt: order.paymongo_qr_expires_at ?? null,
    expiresInMinutes: expiresAt
      ? Math.max(1, Math.ceil((expiresAt - Date.now()) / 60000))
      : 30,
  };
}

function getQrPhMinutesLeft(payment: ReopenableQrPhPayment, nowMs: number) {
  const expiresAt = payment.expiresAt ? new Date(payment.expiresAt).getTime() : 0;

  if (!expiresAt) {
    return payment.expiresInMinutes;
  }

  return Math.max(0, Math.ceil((expiresAt - nowMs) / 60000));
}

function hasExpiredQrPhPayment(order: CustomerOrder | null) {
  if (
    !order ||
    order.status !== "pending_payment" ||
    order.payment_method !== "online" ||
    order.payment_status !== "unpaid" ||
    !order.paymongo_qr_expires_at
  ) {
    return false;
  }

  return new Date(order.paymongo_qr_expires_at).getTime() <= Date.now();
}

function isAwaitingOnlinePayment(order: CustomerOrder | null) {
  return (
    order?.status === "pending_payment" &&
    order.payment_method === "online" &&
    order.payment_status === "unpaid"
  );
}

function canCustomerCancelOrder(order: CustomerOrder | null) {
  if (!order || order.payment_status === "paid") {
    return false;
  }

  return order.status === "pending" || order.status === "pending_payment";
}

function getCustomerCancelUnavailableMessage(order: CustomerOrder) {
  if (["cancelled", "expired", "completed", "delivered"].includes(order.status)) {
    return "";
  }

  if (order.payment_status === "paid") {
    return "Paid orders cannot be cancelled here. Please contact staff for assistance.";
  }

  return "Cancellation closes once staff starts preparing the order.";
}

function getEmoji(item: CustomerMenuItem) {
  const text = `${item.name} ${item.category}`.toLowerCase();

  if (text.includes("matcha")) return "🍵";
  if (text.includes("strawberry")) return "🍓";
  if (text.includes("mocha") || text.includes("chocolate")) return "🍫";
  if (text.includes("tea")) return "🧋";
  return "☕";
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/_/g, "-")
    .replace(/\s+/g, " ");
}

function getMenuImage(item: CustomerMenuItem) {
  const imageUrl = item.image_url?.trim();

  if (!imageUrl) {
    return null;
  }

  const normalizedImageUrl = imageUrl.toLowerCase();

  if (
    normalizedImageUrl.startsWith("/images/menu/") ||
    normalizedImageUrl.includes("/images/menu/")
  ) {
    return null;
  }

  return imageUrl;
}

function getRecommendationDisplayMeta(recommendation: MenuRecommendationCard) {
  if (recommendation.basis === "preference") {
    return {
      label: "Best for You",
      tag: "PREFERENCE SCORE",
    };
  }

  if (recommendation.basis === "top_seller") {
    return {
      label: "Top Seller",
      tag: "GLOBAL RANK",
    };
  }

  return {
    label: "You Might Also Like",
    tag: "POPULARITY",
  };
}

function isPastryMenuItem(item: Pick<CustomerMenuItem, "category">) {
  return item.category === "pastries";
}

function getFilter(category: string): Filter {
  const normalizedCategory = normalizeText(category);

  if (
    normalizedCategory === "all-coffee" ||
    normalizedCategory === "hot-coffee" ||
    normalizedCategory === "iced-coffee" ||
    normalizedCategory === "coffee" ||
    normalizedCategory === "latte-series" ||
    normalizedCategory === "premium-blends"
  ) {
    return "coffee";
  }

  if (
    normalizedCategory === "non-coffee" ||
    normalizedCategory === "milk-tea" ||
    normalizedCategory === "frappe"
  ) {
    return "non-coffee";
  }

  if (normalizedCategory === "pastries" || normalizedCategory === "food") {
    return "pastries";
  }

  if (normalizedCategory === "best-deals" || normalizedCategory === "others") {
    return "best-deals";
  }

  return "all";
}

function getMenuDedupeKey(item: CustomerMenuItem) {
  return [
    item.name.trim().toLowerCase(),
    item.category.trim().toLowerCase(),
    Math.round(item.base_price),
  ].join("|");
}

function dedupeMenuItems(items: CustomerMenuItem[]) {
  const uniqueItems = new Map<string, CustomerMenuItem>();

  items.forEach((item) => {
    const key = item.id.trim() || getMenuDedupeKey(item);
    const existingItem = uniqueItems.get(key);

    if (!existingItem || (!existingItem.is_available && item.is_available)) {
      uniqueItems.set(key, item);
    }
  });

  return Array.from(uniqueItems.values());
}

function dedupeRecommendationItems<T extends MenuRecommendationCard>(
  recommendations: T[]
) {
  const seenItemIds = new Set<string>();

  return recommendations.filter((recommendation) => {
    const itemId = recommendation.item.id.trim();

    if (!itemId || seenItemIds.has(itemId)) {
      return false;
    }

    seenItemIds.add(itemId);
    return true;
  });
}

function sortMenuByAvailability(items: CustomerMenuItem[]) {
  return [...items].sort((a, b) => {
    if (a.is_available !== b.is_available) {
      return a.is_available ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });
}

function getActiveOrder(orders: CustomerOrder[]) {
  return (
    orders.find(
      (order) =>
        !["delivered", "completed", "cancelled", "expired"].includes(order.status)
    ) ?? null
  );
}

function isFinalOrder(status: CustomerOrder["status"]) {
  return ["delivered", "completed", "cancelled", "expired"].includes(status);
}

function getOrderStepIndex(status: CustomerOrder["status"]) {
  switch (status) {
    case "pending":
      return 0;
    case "preparing":
      return 1;
    case "ready":
      return 2;
    case "out_for_delivery":
      return 3;
    case "delivered":
    case "completed":
      return 4;
    default:
      return 0;
  }
}

function getTrackingSteps(orderType: CustomerOrder["order_type"]) {
  return [
    "Pending",
    "Preparing",
    "Ready",
    orderType === "delivery" ? "Out for Delivery" : "Pickup",
    orderType === "delivery" ? "Delivered" : "Completed",
  ];
}

function getMonthlyFavorite(orders: CustomerOrder[]) {
  const counts = new Map<string, number>();

  orders.forEach((order) => {
    order.order_items.forEach((item) => {
      const name = item.menu_items?.name;

      if (!name) {
        return;
      }

      counts.set(name, (counts.get(name) ?? 0) + item.quantity);
    });
  });

  return (
    Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Start ordering to unlock favorites"
  );
}

function getTasteProfile(orders: CustomerOrder[]) {
  let latte = 0;
  let nonCoffee = 0;
  let pastries = 0;

  orders.forEach((order) => {
    order.order_items.forEach((item) => {
      const name = item.menu_items?.name?.toLowerCase() ?? "";
      const category = item.menu_items?.category
        ? getFilter(item.menu_items.category)
        : null;
      const quantity = item.quantity;

      if (category === "pastries" || category === "best-deals") {
        pastries += quantity;
      } else if (category === "non-coffee") {
        nonCoffee += quantity;
      } else if (
        category === "coffee" ||
        name.includes("latte") ||
        name.includes("americano") ||
        name.includes("mocha") ||
        name.includes("macchiato")
      ) {
        latte += quantity;
      } else if (
        name.includes("cookie") ||
        name.includes("panini") ||
        name.includes("pastry") ||
        name.includes("sandwich")
      ) {
        pastries += quantity;
      } else if (name) {
        nonCoffee += quantity;
      }
    });
  });

  const total = latte + nonCoffee + pastries;

  if (total === 0) {
    return { latte: 0, nonCoffee: 0, pastries: 0 };
  }

  return {
    latte: Math.round((latte / total) * 100),
    nonCoffee: Math.round((nonCoffee / total) * 100),
    pastries: Math.round((pastries / total) * 100),
  };
}

function getFlavorBadges(orders: CustomerOrder[]) {
  const items = orders.flatMap((order) => order.order_items);
  const text = items.map((item) => item.menu_items?.name ?? "").join(" ").toLowerCase();
  const badges = new Set<string>();
  let nutritionCount = 0;
  let totalCalories = 0;
  let totalSugar = 0;

  if (text.includes("latte") || text.includes("milk")) {
    badges.add("Creamy Latte Fan");
  }

  if (
    text.includes("americano") ||
    text.includes("espresso") ||
    text.includes("macchiato")
  ) {
    badges.add("Coffee-Forward");
  }

  if (text.includes("matcha") || text.includes("strawberry")) {
    badges.add("Fruit + Matcha Fan");
  }

  if (text.includes("cookie") || text.includes("pastry")) {
    badges.add("Pastry Pairing");
  }

  items.forEach((item) => {
    if (!item.menu_items) return;

    const facts = getMenuItemNutrition(item.menu_items, {
      quantity: item.quantity,
      sugarLevel: 50,
      size: "medium",
      addons: [],
    });

    if (!facts) return;

    nutritionCount += 1;
    totalCalories += facts.calories;
    totalSugar += facts.sugar;
  });

  if (nutritionCount > 0) {
    const averageCalories = totalCalories / nutritionCount;
    const averageSugar = totalSugar / nutritionCount;

    if (averageCalories >= 180) {
      badges.add("High Calorie Picks");
    }

    if (averageSugar <= 24) {
      badges.add("Lower Sugar Choices");
    }
  }

  return badges.size > 0 ? Array.from(badges).slice(0, 4) : ["Discovering Preferences"];
}

export function CustomerDashboard({
  menuItems,
  orders,
  feedbackItems,
  menuFeedbackByItemId = {},
  preferenceSignals = [],
  globalRecommendationOrders = [],
  globalRecommendationFeedback = [],
  globalRecommendationRanking = [],
  initialSection = "home",
  shouldShowEntrySplash = false,
  customerProfile,
  isAuthenticated = false,
  initialTopRecommendations = [],
  initialRecommendationSource = "analytics_items",
}: CustomerDashboardProps) {

  const router = useRouter();
  const { showToast } = useToast();
  const { addItem, cartCount, items: cartItems } = useCart();
  const [customerOrders, setCustomerOrders] = useState(orders);
  const [, setIsOrderSyncing] = useState(false);
  const [, setLastOrderSyncAt] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState<Section>(initialSection);
  const [isSplashVisible, setIsSplashVisible] = useState(false);
  const [isTaglineVisible, setIsTaglineVisible] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [activePromotionIndex, setActivePromotionIndex] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCartTrayOpen, setIsCartTrayOpen] = useState(false);
  const [quickAddFeedback, setQuickAddFeedback] = useState<{
    itemId: string;
    name: string;
  } | null>(null);
  const [isCartPulseActive, setIsCartPulseActive] = useState(false);
  const [guestActionMessage, setGuestActionMessage] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedMenuItem, setSelectedMenuItem] =
    useState<CustomerMenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sugarLevel, setSugarLevel] = useState(50);
  const [iceLevel, setIceLevel] = useState("regular");
  const [size, setSize] = useState("medium");
  const [temperature, setTemperature] = useState("iced");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [customizeMessage, setCustomizeMessage] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [selectedCurrentOrderId, setSelectedCurrentOrderId] = useState<string | null>(null);
  const [trackingActionMessage, setTrackingActionMessage] = useState("");
  const [qrPhPayment, setQrPhPayment] = useState<ReopenableQrPhPayment | null>(
    null
  );
  const [qrCountdownNow, setQrCountdownNow] = useState(() => Date.now());
  const [isCancellingTrackedOrder, setIsCancellingTrackedOrder] = useState(false);
  const [isFeedbackPromptOpen, setIsFeedbackPromptOpen] = useState(false);
  const [selectedFeedbackOrderId, setSelectedFeedbackOrderId] = useState<
    string | null
  >(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [selectedFeedbackItemId, setSelectedFeedbackItemId] = useState("");
  const [tasteRating, setTasteRating] = useState(0);
  const [strengthRating, setStrengthRating] = useState(3);
  const [overallRating, setOverallRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [topRecommendations, setTopRecommendations] =
    useState<TopRecommendation[]>(initialTopRecommendations);
  const [recommendationSource, setRecommendationSource] = useState<
    "customer_preferences" | "analytics_items" | null
  >(initialTopRecommendations.length > 0 ? initialRecommendationSource : null);
  const profileName = customerProfile?.fullName || "KadaServe Customer";
  const profileEmail = customerProfile?.email;
  const [displayProfileName, setDisplayProfileName] = useState(profileName);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(
    customerProfile?.avatarUrl ?? ""
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [profileFullNameDraft, setProfileFullNameDraft] =
    useState(profileName);
  const [profilePhoneDraft, setProfilePhoneDraft] = useState(
    formatProfilePhone(customerProfile?.phone ?? "")
  );
  const [isProfilePhoneEditing, setIsProfilePhoneEditing] = useState(false);
  const [profileLanguage, setProfileLanguage] = useState<"English" | "Filipino">(
    "English"
  );
  const [openProfileFaq, setOpenProfileFaq] = useState<ProfileFaq | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSettingsMessage, setProfileSettingsMessage] = useState("");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    return readStoredOrderIds(notificationsReadStorageKey);
  });
  const profileInitials = getInitials(displayProfileName);
  const contentScrollerRef = useRef<HTMLDivElement>(null);
  const fullMenuRef = useRef<HTMLDivElement>(null);
  const recommendationScrollerRef = useRef<HTMLDivElement>(null);
  const onboardingScrollerRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const trackingTouchStartYRef = useRef<number | null>(null);
  const previousOrderStatusRef = useRef<
    Map<string, CustomerOrder["status"]> | null
  >(null);
  const feedbackMaybeLaterTimeoutRef = useRef<number | null>(null);
  const isOrderSyncInFlightRef = useRef(false);
  const isGuest = !isAuthenticated;

  const visibleFeedbackItems = selectedFeedbackOrderId
    ? feedbackItems.filter((item) => item.order_id === selectedFeedbackOrderId)
    : feedbackItems;
  const selectedFeedbackItem =
    visibleFeedbackItems.find(
      (item) => item.order_item_id === selectedFeedbackItemId
    ) ?? visibleFeedbackItems[0];
  const canSubmitFeedback =
    Boolean(selectedFeedbackItem) && overallRating > 0 && !isSubmittingFeedback;

  const resetFeedbackForm = useCallback(() => {
    setTasteRating(0);
    setStrengthRating(3);
    setOverallRating(0);
    setFeedbackComment("");
    setFeedbackMessage("");
  }, []);

  const getFeedbackItemForOrder = useCallback((orderId: string) => {
    return feedbackItems.find((item) => item.order_id === orderId) ?? null;
  }, [feedbackItems]);

  const isFeedbackPromptAllowed = useCallback((orderId: string) => {
    const dismissedOrderIds = readStoredOrderIds(
      feedbackDismissedOrdersStorageKey
    );

    if (dismissedOrderIds.includes(orderId)) {
      return false;
    }

    const maybeLaterOrders = readMaybeLaterOrders();
    const maybeLaterUntil = Number(maybeLaterOrders[orderId] ?? 0);

    return !Number.isFinite(maybeLaterUntil) || maybeLaterUntil <= Date.now();
  }, []);

  const hideFeedbackPrompt = useCallback(() => {
    setIsFeedbackPromptOpen(false);
    setSelectedFeedbackOrderId(null);
    resetFeedbackForm();
  }, [resetFeedbackForm]);

  const openFeedbackPromptForOrder = useCallback((orderId: string) => {
    const feedbackItem = getFeedbackItemForOrder(orderId);

    if (!feedbackItem || !isFeedbackPromptAllowed(orderId)) {
      return false;
    }

    resetFeedbackForm();
    setSelectedFeedbackOrderId(orderId);
    setSelectedFeedbackItemId(feedbackItem.order_item_id);
    setIsFeedbackPromptOpen(true);

    return true;
  }, [getFeedbackItemForOrder, isFeedbackPromptAllowed, resetFeedbackForm]);

  function markFeedbackOrderDismissed(orderId: string) {
    writeStoredOrderIds(feedbackDismissedOrdersStorageKey, [
      ...readStoredOrderIds(feedbackDismissedOrdersStorageKey),
      orderId,
    ]);
  }

  const syncCustomerOrders = useCallback(async () => {
    if (!isAuthenticated || isOrderSyncInFlightRef.current) {
      return;
    }

    isOrderSyncInFlightRef.current = true;
    setIsOrderSyncing(true);

    try {
      const response = await fetch("/api/customer/orders", {
        method: "GET",
        cache: "no-store",
      });
      const result = (await response.json()) as CustomerOrdersPayload;

      if (!response.ok) {
        console.warn("[KadaServe Orders] Failed to sync customer orders", result.error);
        return;
      }

      setCustomerOrders(result.orders ?? []);
      setLastOrderSyncAt(new Date());
    } catch {
      console.warn("[KadaServe Orders] Customer order sync failed");
    } finally {
      isOrderSyncInFlightRef.current = false;
      setIsOrderSyncing(false);
    }
  }, [isAuthenticated]);
  const onboardingCards = [
    {
      title: "Coffee Crafted for You",
      body: "Stop the guesswork. My system learns your unique taste profile to recommend the perfect brew tailored specifically to your preferences.",
      icon: Sparkles,
      illustration: "discovery",
    },
    {
      title: "Track Every Sip",
      body: "Stay in the loop with real-time updates. Follow your order's journey from the barista's counter to your doorstep or pickup window.",
      icon: ClipboardList,
      illustration: "tracking",
    },
    {
      title: "Rate and Improve",
      body: "Your feedback trains the recommendation loop so future suggestions better match your taste.",
      icon: Star,
      illustration: "feedback",
    },
  ];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const showOnboardingIfNeeded = () => {
      if (window.localStorage.getItem(onboardingStorageKey) !== "true") {
        setIsOnboardingOpen(true);
      }
    };

    const splashRequested =
      shouldShowEntrySplash ||
      window.sessionStorage.getItem(customerSplashSessionKey) === "true";

    window.sessionStorage.removeItem(customerSplashSessionKey);

    if (shouldShowEntrySplash) {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete("splash");
      window.history.replaceState(
        null,
        "",
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
      );
    }

    if (window.sessionStorage.getItem("kadaserve_skip_customer_splash") === "true") {
      window.sessionStorage.removeItem("kadaserve_skip_customer_splash");
      setIsSplashVisible(false);
      setIsTaglineVisible(false);
      showOnboardingIfNeeded();
      return;
    }

    if (!splashRequested) {
      setIsSplashVisible(false);
      setIsTaglineVisible(false);
      showOnboardingIfNeeded();
      return;
    }

    setIsSplashVisible(true);
    const splashTimeoutId = window.setTimeout(() => {
      setIsSplashVisible(false);
      setIsTaglineVisible(false);
      showOnboardingIfNeeded();
    }, 5000);

    return () => {
      window.clearTimeout(splashTimeoutId);
    };
  }, [shouldShowEntrySplash]);

  useEffect(() => {
    setProfileAvatarUrl(customerProfile?.avatarUrl ?? "");
  }, [customerProfile?.avatarUrl]);

  useEffect(() => {
    setDisplayProfileName(profileName);
    setProfileFullNameDraft(profileName);
  }, [profileName]);

  useEffect(() => {
    setProfilePhoneDraft(formatProfilePhone(customerProfile?.phone ?? ""));
  }, [customerProfile?.phone]);

  useEffect(() => {
    const syncTrackingOrderFromUrl = () => {
      const orderId = new URLSearchParams(window.location.search).get("orderId");
      setTrackingOrderId(orderId);

      if (orderId) {
        setActiveSection("orders");
      }
    };

    syncTrackingOrderFromUrl();
    window.addEventListener("popstate", syncTrackingOrderFromUrl);

    return () => {
      window.removeEventListener("popstate", syncTrackingOrderFromUrl);
    };
  }, []);

  useEffect(() => {
    setCustomerOrders(orders);
    setLastOrderSyncAt(new Date());
  }, [orders]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void syncCustomerOrders();

    const intervalId = window.setInterval(() => {
      void syncCustomerOrders();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, syncCustomerOrders]);

  useEffect(() => {
    if (!quickAddFeedback) {
      return;
    }

    const feedbackTimeoutId = window.setTimeout(() => {
      setQuickAddFeedback(null);
    }, 1100);
    const pulseTimeoutId = window.setTimeout(() => {
      setIsCartPulseActive(false);
    }, 700);

    return () => {
      window.clearTimeout(feedbackTimeoutId);
      window.clearTimeout(pulseTimeoutId);
    };
  }, [quickAddFeedback]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel("customer-order-status")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  async function handleSubmitFeedback() {
    if (!selectedFeedbackItem) return;

    setIsSubmittingFeedback(true);
    setFeedbackMessage("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: selectedFeedbackItem.order_id,
          order_item_id: selectedFeedbackItem.order_item_id,
          menu_item_id: selectedFeedbackItem.menu_item_id,
          taste_rating: tasteRating || overallRating,
          strength_rating: strengthRating,
          overall_rating: overallRating,
          comment: feedbackComment,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setFeedbackMessage(result.error || "Failed to submit feedback.");
        showToast({
          title: "Feedback not sent",
          description: result.error || "Please try again.",
          variant: "error",
        });
        return;
      }

      setFeedbackMessage("Feedback submitted successfully.");
      showToast({
        title: "Feedback submitted",
        description: "Thanks. Your rating will improve future recommendations.",
        variant: "success",
      });
      markFeedbackOrderDismissed(selectedFeedbackItem.order_id);
      setIsFeedbackPromptOpen(false);
      setSelectedFeedbackOrderId(null);
      setTasteRating(0);
      setStrengthRating(3);
      setOverallRating(0);
      setFeedbackComment("");
      router.refresh();
    } catch {
      setFeedbackMessage("Something went wrong while submitting feedback.");
      showToast({
        title: "Feedback not sent",
        description: "Something went wrong while submitting feedback.",
        variant: "error",
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  useEffect(() => {
    if (!selectedFeedbackItemId && feedbackItems.length > 0) {
      setSelectedFeedbackItemId(feedbackItems[0].order_item_id);
    }
  }, [feedbackItems, selectedFeedbackItemId]);

  useEffect(() => {
    if (!selectedFeedbackOrderId || selectedFeedbackItem) {
      return;
    }

    setSelectedFeedbackOrderId(null);
  }, [selectedFeedbackItem, selectedFeedbackOrderId]);

  useEffect(() => {
    const currentOrderStatuses = new Map(
      customerOrders.map((order) => [order.id, order.status])
    );
    const previousOrderStatuses = previousOrderStatusRef.current;

    previousOrderStatusRef.current = currentOrderStatuses;

    if (!isAuthenticated || !previousOrderStatuses) {
      return;
    }

    const newlyEligibleOrder = customerOrders.find((order) => {
      const previousStatus = previousOrderStatuses.get(order.id);

      return (
        previousStatus &&
        !isFeedbackEligibleStatus(previousStatus) &&
        isFeedbackEligibleStatus(order.status) &&
        Boolean(getFeedbackItemForOrder(order.id)) &&
        isFeedbackPromptAllowed(order.id)
      );
    });

    if (newlyEligibleOrder) {
      openFeedbackPromptForOrder(newlyEligibleOrder.id);
    }
  }, [
    customerOrders,
    getFeedbackItemForOrder,
    isAuthenticated,
    isFeedbackPromptAllowed,
    openFeedbackPromptForOrder,
  ]);

  useEffect(() => {
    return () => {
      if (feedbackMaybeLaterTimeoutRef.current) {
        window.clearTimeout(feedbackMaybeLaterTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!guestActionMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setGuestActionMessage("");
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [guestActionMessage]);

  const uniqueMenuItems = useMemo(() => dedupeMenuItems(menuItems), [menuItems]);
  const currentOrders = useMemo(
    () =>
      customerOrders.filter(
        (order) =>
          !["delivered", "completed", "cancelled", "expired"].includes(
            order.status
          )
      ),
    [customerOrders]
  );
  const activeOrder = useMemo(
    () =>
      currentOrders.find((order) => order.id === selectedCurrentOrderId) ??
      getActiveOrder(currentOrders) ??
      null,
    [currentOrders, selectedCurrentOrderId]
  );
  const orderHistory = useMemo(
    () =>
      customerOrders.filter(
        (order) => !currentOrders.some((currentOrder) => currentOrder.id === order.id)
      ),
    [currentOrders, customerOrders]
  );
  const trackingOrder = useMemo(
    () =>
      trackingOrderId
        ? customerOrders.find((order) => order.id === trackingOrderId) ?? null
        : null,
    [customerOrders, trackingOrderId]
  );
  const trackingQrPhPayment = getReopenableQrPhPayment(trackingOrder);
  const isTrackingQrPhExpired = hasExpiredQrPhPayment(trackingOrder);
  const isTrackingOnlinePaymentPending = isAwaitingOnlinePayment(trackingOrder);
  const canCancelTrackingOrder = canCustomerCancelOrder(trackingOrder);
  const cancelUnavailableMessage = trackingOrder
    ? getCustomerCancelUnavailableMessage(trackingOrder)
    : "";
  const trackingOrderStep = trackingOrder
    ? getOrderStepIndex(trackingOrder.status)
    : 0;
  const trackingOrderItems =
    trackingOrder?.order_items
      .map((item) => {
        const menuItem = item.menu_items;

        return {
          id: item.id,
          quantity: item.quantity,
          name: menuItem?.name ?? "Menu item",
          imageUrl: menuItem
            ? getMenuImage({
                id: menuItem.id ?? item.id,
                name: menuItem.name,
                description: menuItem.description ?? null,
                category: menuItem.category ?? "",
                base_price: Number(menuItem.base_price ?? item.unit_price ?? 0),
                image_url: menuItem.image_url ?? null,
                is_available: menuItem.is_available ?? true,
                has_sugar_level: menuItem.has_sugar_level,
                has_ice_level: menuItem.has_ice_level,
                has_size_option: menuItem.has_size_option,
                has_temp_option: menuItem.has_temp_option,
              })
            : null,
        };
      })
      .slice(0, 4) ?? [];
  const qrPhMinutesLeft = qrPhPayment
    ? getQrPhMinutesLeft(qrPhPayment, qrCountdownNow)
    : 0;

  useEffect(() => {
    if (!qrPhPayment) {
      return;
    }

    setQrCountdownNow(Date.now());
    const intervalId = window.setInterval(() => {
      setQrCountdownNow(Date.now());
      void syncCustomerOrders();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [qrPhPayment, syncCustomerOrders]);

  useEffect(() => {
    if (!qrPhPayment) {
      return;
    }

    const matchingOrder = customerOrders.find(
      (order) => order.id === qrPhPayment.orderId
    );

    if (
      matchingOrder?.payment_status === "paid" &&
      matchingOrder.status !== "pending_payment"
    ) {
      setQrPhPayment(null);
      setActiveSection("orders");
      setTrackingActionMessage("");
      setSelectedCurrentOrderId(qrPhPayment.orderId);
      setTrackingOrderId(qrPhPayment.orderId);
      showToast({
        title: "Thank you for ordering",
        description: `${formatOrderCode(qrPhPayment.orderId)} is paid and ready for tracking.`,
        variant: "success",
      });

      const params = new URLSearchParams(window.location.search);
      params.set("tab", "orders");
      params.set("orderId", qrPhPayment.orderId);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${params.toString()}`
      );
      return;
    }

    if (
      matchingOrder &&
      ["cancelled", "expired"].includes(matchingOrder.status)
    ) {
      setQrPhPayment(null);
      setTrackingActionMessage("Payment expired. Please place a new order.");
      showToast({
        title: "Payment expired",
        description: "The unpaid QR Ph checkout was cancelled.",
        variant: "error",
      });
      return;
    }

    if (qrPhMinutesLeft <= 0) {
      void syncCustomerOrders();
    }
  }, [
    customerOrders,
    qrPhMinutesLeft,
    qrPhPayment,
    showToast,
    syncCustomerOrders,
  ]);
  const activeOrderStep = activeOrder ? getOrderStepIndex(activeOrder.status) : 0;
  const hasOrderAttention = currentOrders.some((order) =>
    ["preparing", "ready", "out_for_delivery"].includes(order.status)
  );
  const notifications = useMemo<CustomerNotification[]>(() => {
    if (!isAuthenticated) {
      return [];
    }

    const orderNotifications = currentOrders.map((order) => ({
      id: `order:${order.id}:${order.status}`,
      kind: "order" as const,
      typeLabel: formatStatus(order.status),
      timestamp: getNotificationTimestamp(order),
      title: getOrderNotificationTitle(order),
      body: getOrderNotificationBody(order),
      actionLabel: "Track order",
      orderId: order.id,
    }));
    const receiptNotifications = orderHistory
      .filter((order) => ["completed", "delivered"].includes(order.status))
      .map((order) => {
        const receipt = getOrderReceipt(order);

        return {
          id: `receipt:${order.id}:${order.status}:${order.payment_status ?? "unpaid"}`,
          kind: "receipt" as const,
          typeLabel: "Receipt",
          timestamp: getNotificationTimestamp(order),
          title: "Receipt and order details",
          body: `${formatOrderCode(order.id)} is ${formatStatus(
            order.status
          ).toLowerCase()}. Total ${formatPrice(receipt.grandTotal)} via ${
            receipt.paymentMethod
          }.`,
          actionLabel: "View order",
          orderId: order.id,
          receipt,
        };
      });
    const feedbackOrderIds = Array.from(
      new Set(feedbackItems.map((item) => item.order_id))
    );
    const feedbackNotifications = feedbackOrderIds
      .filter((orderId) => isFeedbackPromptAllowed(orderId))
      .map((orderId) => {
        const feedbackItem = getFeedbackItemForOrder(orderId);

        return {
          id: `feedback:${orderId}`,
          kind: "feedback" as const,
          typeLabel: "Feedback",
          timestamp:
            customerOrders.find((order) => order.id === orderId)?.updated_at ||
            customerOrders.find((order) => order.id === orderId)?.ordered_at ||
            new Date().toISOString(),
          title: "Rate your recent order",
          body: feedbackItem
            ? `Tell us how ${feedbackItem.item_name} tasted so recommendations improve.`
            : "Your feedback helps improve future recommendations.",
          actionLabel: "Give feedback",
          orderId,
        };
      });

    return [...orderNotifications, ...receiptNotifications, ...feedbackNotifications]
      .sort(
        (first, second) =>
          new Date(second.timestamp).getTime() -
          new Date(first.timestamp).getTime()
      );
  }, [
    customerOrders,
    currentOrders,
    feedbackItems,
    getFeedbackItemForOrder,
    isAuthenticated,
    isFeedbackPromptAllowed,
    orderHistory,
  ]);
  const unreadNotificationCount = notifications.filter(
    (notification) => !readNotificationIds.includes(notification.id)
  ).length;

  useEffect(() => {
    writeStoredOrderIds(notificationsReadStorageKey, readNotificationIds);
  }, [readNotificationIds]);

  useEffect(() => {
    document.body.style.overflow =
      selectedMenuItem ||
      isProfileOpen ||
      isNotificationsOpen ||
      isFeedbackPromptOpen ||
      trackingOrder ||
      isSplashVisible ||
      isTaglineVisible ||
      isOnboardingOpen
        ? "hidden"
        : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [
    isFeedbackPromptOpen,
    isNotificationsOpen,
    isOnboardingOpen,
    isProfileOpen,
    isSplashVisible,
    isTaglineVisible,
    selectedMenuItem,
    trackingOrder,
  ]);

  useEffect(() => {
    if (currentOrders.length === 0) {
      setSelectedCurrentOrderId(null);
      return;
    }

    if (
      !selectedCurrentOrderId ||
      !currentOrders.some((order) => order.id === selectedCurrentOrderId)
    ) {
      setSelectedCurrentOrderId(currentOrders[0].id);
    }
  }, [currentOrders, selectedCurrentOrderId]);

  const recommendationProfile = useMemo(() => {
    const recommendationMenuItems: RecommendationMenuItem[] = uniqueMenuItems.map(
      (item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.base_price,
        imageUrl: getMenuImage(item),
        isAvailable: item.is_available,
      })
    );
    const recommendationOrders: RecommendationOrder[] = customerOrders.map(
      (order) => ({
        id: order.id,
        customerId: customerProfile?.email ?? "current-customer",
        customerName: displayProfileName,
        status: order.status,
        orderedAt: order.ordered_at,
        items: order.order_items.map((item) => ({
          menuItemId: item.menu_items?.id,
          name: item.menu_items?.name ?? "Menu item",
          category: item.menu_items?.category,
          quantity: item.quantity,
        })),
      })
    );
    const recommendationFeedback: RecommendationFeedback[] =
      preferenceSignals.map((signal) => ({
        customerId: customerProfile?.email ?? "current-customer",
        menuItemId: signal.menuItemId,
        tasteRating: signal.tasteRating,
        strengthRating: signal.strengthRating,
        overallRating: signal.overallRating,
      }));

    return getRecommendationsForCustomer({
      customerId: customerProfile?.email ?? "current-customer",
      customerName: displayProfileName,
      menuItems: recommendationMenuItems,
      orders: [...globalRecommendationOrders, ...recommendationOrders],
      feedback: [...globalRecommendationFeedback, ...recommendationFeedback],
      globalRanking: globalRecommendationRanking,
    });
  }, [
    customerOrders,
    customerProfile?.email,
    displayProfileName,
    globalRecommendationFeedback,
    globalRecommendationOrders,
    globalRecommendationRanking,
    preferenceSignals,
    uniqueMenuItems,
  ]);
  const recommendedItems = recommendationProfile.recommendations.reduce<
    MenuRecommendationCard[]
  >((items, recommendation) => {
      const item = uniqueMenuItems.find(
        (menuItem) => menuItem.id === recommendation.item.id
      );

      if (item) {
        items.push({
          ...recommendation,
          item,
        });
      }

      return items;
    }, []);
  const persistedRecommendedItems: MenuRecommendationCard[] = topRecommendations.map((recommendation) => {
    const item =
      uniqueMenuItems.find((menuItem) => menuItem.id === recommendation.item_id) ??
      recommendation.item;

    return {
      item,
      label: recommendation.label,
      reason: recommendation.reason,
      basis: recommendation.basis,
      score: recommendation.preference_score ?? 0,
    };
  });
  const visibleRecommendedItems =
    recommendedItems.length > 0 ? recommendedItems : persistedRecommendedItems;
  const isColdStartRecommendation =
    !visibleRecommendedItems.some(
      (recommendation) => recommendation.basis === "preference"
    ) &&
    (recommendationSource === "analytics_items" ||
      !recommendationSource ||
      recommendationProfile.isNewCustomer);
  const displayRecommendedItems = dedupeRecommendationItems(
    visibleRecommendedItems
  ).map((recommendation) => ({
    ...recommendation,
    displayMeta: getRecommendationDisplayMeta(recommendation),
  }));
  const monthlyFavorite = useMemo(
    () => getMonthlyFavorite(customerOrders),
    [customerOrders]
  );
  const normalizedProfileName = profileFullNameDraft.trim();
  const normalizedProfilePhone = getPhoneDigits(profilePhoneDraft);
  const isProfileSettingsDirty =
    normalizedProfileName !== profileName ||
    normalizedProfilePhone !== getPhoneDigits(customerProfile?.phone ?? "");
  const canSaveProfileSettings =
    isProfileSettingsDirty &&
    isValidProfileName(normalizedProfileName) &&
    isValidOptionalPhone(profilePhoneDraft) &&
    !isSavingProfile;
  const tasteProfile = useMemo(
    () => getTasteProfile(customerOrders),
    [customerOrders]
  );
  const flavorBadges = useMemo(
    () => getFlavorBadges(customerOrders),
    [customerOrders]
  );
  const recentOrders = useMemo(
    () => customerOrders.slice(0, 3),
    [customerOrders]
  );
  const visibleRecentOrders = recentOrders.slice(0, 2);
  const firstName = isGuest
    ? "there"
    : displayProfileName.split(/\s+/)[0] || "there";
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 18
      ? "Good afternoon"
      : "Good evening";
  const feedbackMissionAvailable = feedbackItems.length > 0;
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActivePromotionIndex((current) =>
        (current + 1) % promotionImages.length
      );
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isActive = true;

    async function loadTopRecommendations() {
      try {
        const response = await fetch("/api/customer/recommendations", {
          method: "GET",
          cache: "no-store",
        });
        const result = (await response.json()) as TopRecommendationsPayload;

        if (!isActive) {
          return;
        }

        if (!response.ok) {
          console.warn(
            "[KadaServe Recommendations] Failed to load server recommendations",
            result.error
          );
          setTopRecommendations([]);
          setRecommendationSource(null);
          return;
        }

        setTopRecommendations(result.recommendations ?? []);
        setRecommendationSource(result.source ?? null);
      } catch {
        if (isActive) {
          console.warn("[KadaServe Recommendations] Server recommendation request failed");
          setTopRecommendations([]);
          setRecommendationSource(null);
        }
      }
    }

    void loadTopRecommendations();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  const filteredMenu = useMemo(() => {
    const searchTerms = debouncedQuery
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    const matchingItems = uniqueMenuItems.filter((item) => {
      const categoryFilter = getFilter(item.category);
      const categoryLabel =
        menuFilters.find((filterItem) => filterItem.value === categoryFilter)
          ?.label ?? item.category;
      const searchableText = normalizeText(
        [
          item.name,
          item.description ?? "",
          item.category,
          categoryLabel,
          item.is_available ? "available" : "sold out",
          item.base_price.toString(),
        ].join(" ")
      );
      const matchesQuery =
        searchTerms.length === 0 ||
        searchTerms.every((term) => searchableText.includes(term));

      return matchesQuery;
    });

    return sortMenuByAvailability(matchingItems);
  }, [debouncedQuery, uniqueMenuItems]);
  const hasMenuSearch = debouncedQuery.length > 0;
  const categoryMenuFilters = menuFilters.filter(
    (item) => item.value !== "all"
  );
  const activeMenuFilter = menuFilters.some((item) => item.value === filter)
    ? filter
    : "all";
  const menuFilterCounts = useMemo(() => {
    const counts = new Map<Filter, number>([["all", filteredMenu.length]]);

    categoryMenuFilters.forEach((item) => {
      counts.set(
        item.value,
        filteredMenu.filter((menuItem) => getFilter(menuItem.category) === item.value)
          .length
      );
    });

    return counts;
  }, [categoryMenuFilters, filteredMenu]);
  const visibleMenuFilters =
    activeMenuFilter === "all"
      ? categoryMenuFilters
      : categoryMenuFilters.filter((item) => item.value === activeMenuFilter);
  const menuGroups = visibleMenuFilters
    .map((item) => ({
      ...item,
      items: filteredMenu.filter(
        (menuItem) => getFilter(menuItem.category) === item.value
      ),
    }))
    .filter((group) => group.items.length > 0 || activeMenuFilter !== "all");

  const selectedSize = sizes.find((item) => item.value === size);
  const selectedAddonRows = addons.filter((item) =>
    selectedAddons.includes(item.value)
  );
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + (item.base_price + item.addon_price) * item.quantity,
    0
  );
  const latestCartItem = cartItems.at(-1);
  const addonTotal = selectedAddonRows.reduce(
    (sum, item) => sum + item.price,
    0
  );
  const sizeCharge = selectedSize?.price ?? 0;
  const customizeTotal = selectedMenuItem
    ? (selectedMenuItem.base_price + addonTotal + sizeCharge) * quantity
    : 0;
  const selectedNutrition = selectedMenuItem
    ? getMenuItemNutrition(selectedMenuItem, {
        sugarLevel:
          selectedMenuItem.has_sugar_level === false ? 100 : sugarLevel,
        size,
        addons: selectedAddons,
      })
    : null;
  const selectedMenuFeedback = selectedMenuItem
    ? getMenuFeedback(menuFeedbackByItemId, selectedMenuItem)
    : null;

  useEffect(() => {
    if (
      !isAuthenticated &&
      activeSection === "orders"
    ) {
      setGuestActionMessage("Login to unlock orders and your profile.");
      router.push(
        `/login?callbackUrl=${encodeURIComponent(
          `/customer?tab=${activeSection}`
        )}&intent=login-to-order`
      );
    }
  }, [activeSection, isAuthenticated, router]);

  useEffect(() => {
    const customizeId = new URLSearchParams(window.location.search).get(
      "customize"
    );

    if (!customizeId || selectedMenuItem) {
      return;
    }

    const menuItem = uniqueMenuItems.find((item) => item.id === customizeId);

    if (menuItem?.is_available && isPastryMenuItem(menuItem)) {
      const url = new URL(window.location.href);
      url.searchParams.delete("customize");
      window.history.replaceState(null, "", url);
      return;
    }

    if (menuItem?.is_available) {
      resetCustomization(menuItem);
      setSelectedMenuItem(menuItem);
    }
  }, [selectedMenuItem, uniqueMenuItems]);

  function resetCustomization(item: CustomerMenuItem) {
    setQuantity(1);
    setSugarLevel(50);
    setIceLevel(item.has_ice_level === false ? "no_ice" : "regular");
    setSize(item.has_size_option === false ? "medium" : "medium");
    setTemperature(item.has_temp_option === false ? "iced" : "iced");
    setSelectedAddons([]);
    setCustomizeMessage("");
  }

  function requireCustomerAccount(message = "Login to Order") {
    if (isAuthenticated) {
      return true;
    }

    setGuestActionMessage(message);
    showToast({
      title: "Login required",
      description: message,
      variant: "info",
    });
    const callbackUrl = `${window.location.pathname}${window.location.search}`;
    router.push(
      `/login?callbackUrl=${encodeURIComponent(
        callbackUrl
      )}&intent=login-to-order`
    );
    return false;
  }

  function openCustomizeModal(item: CustomerMenuItem) {
    if (!item.is_available) {
      return;
    }

    if (isPastryMenuItem(item)) {
      handleQuickAdd(item);
      return;
    }

    resetCustomization(item);
    setSelectedMenuItem(item);

    const url = new URL(window.location.href);
    url.searchParams.set("customize", item.id);
    window.history.pushState(null, "", url);
  }

  function closeCustomizeModal() {
    setSelectedMenuItem(null);
    setCustomizeMessage("");

    const url = new URL(window.location.href);
    url.searchParams.delete("customize");
    window.history.replaceState(null, "", url);
  }

  function toggleAddon(value: string) {
    setSelectedAddons((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function handleAddCustomizedItem() {
    if (!requireCustomerAccount()) {
      return;
    }

    if (!selectedMenuItem || quantity < 1) {
      return;
    }

    addItem({
      menu_item_id: selectedMenuItem.id,
      name: selectedMenuItem.name,
      category: selectedMenuItem.category,
      base_price: selectedMenuItem.base_price,
      quantity,
      sugar_level: selectedMenuItem.has_sugar_level === false ? 100 : sugarLevel,
      ice_level: selectedMenuItem.has_ice_level === false ? null : iceLevel,
      size,
      temperature,
      addons: selectedAddons,
      addon_price: addonTotal + sizeCharge,
      special_instructions: "",
      image_url: getMenuImage(selectedMenuItem),
    });

    navigator.vibrate?.(18);
    setCustomizeMessage("Added to cart.");
    showToast({
      title: "Added to cart",
      description: `${selectedMenuItem.name} is ready for checkout.`,
      variant: "success",
    });

    window.setTimeout(() => {
      closeCustomizeModal();
    }, 550);
  }

  function handleQuickAdd(item: CustomerMenuItem) {
    if (!requireCustomerAccount()) {
      return;
    }

    if (!item.is_available) {
      return;
    }

    addItem({
      menu_item_id: item.id,
      name: item.name,
      category: item.category,
      base_price: item.base_price,
      quantity: 1,
      sugar_level: item.has_sugar_level === false ? 100 : 50,
      ice_level: item.has_ice_level === false ? null : "regular",
      size: item.has_size_option === false ? "medium" : "medium",
      temperature: item.has_temp_option === false ? "iced" : "iced",
      addons: [],
      addon_price: 0,
      special_instructions: "",
      image_url: getMenuImage(item),
    });

    navigator.vibrate?.(18);
    setQuickAddFeedback({ itemId: item.id, name: item.name });
    setIsCartTrayOpen(true);
    setIsCartPulseActive(true);
  }

  function handleRatingChange(
    setter: (value: number) => void,
    value: number
  ) {
    setter(value);
    navigator.vibrate?.(10);
  }

  function handleReorder(order: CustomerOrder) {
    if (!requireCustomerAccount()) {
      return;
    }

    order.order_items.forEach((item) => {
      if (!item.menu_items) {
        return;
      }

      addItem({
        menu_item_id: item.menu_items.id ?? item.id,
        name: item.menu_items.name,
        category: item.menu_items.category,
        base_price: item.unit_price,
        quantity: item.quantity,
        sugar_level: 50,
        ice_level: "regular",
        size: "medium",
        temperature: "iced",
        addons: [],
        addon_price: 0,
        special_instructions: "",
        image_url: null,
      });
    });

    navigator.vibrate?.(18);
  }

  function openTrackingModal(orderId: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "orders");
    params.set("orderId", orderId);
    window.history.pushState(null, "", `${window.location.pathname}?${params}`);
    setActiveSection("orders");
    setTrackingActionMessage("");
    setSelectedCurrentOrderId(orderId);
    setTrackingOrderId(orderId);
  }

  function handleCurrentOrderChange(orderId: string) {
    setSelectedCurrentOrderId(orderId);

    if (trackingOrderId) {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", "orders");
      params.set("orderId", orderId);
      window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
      setTrackingActionMessage("");
      setTrackingOrderId(orderId);
    }
  }

  function closeTrackingModal() {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "orders");
    params.delete("orderId");
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname
    );
    setActiveSection("orders");
    setTrackingOrderId(null);
    setTrackingActionMessage("");
  }

  function openTrackedQrPhPayment() {
    if (!trackingQrPhPayment) {
      setTrackingActionMessage("QR expired. Please place a new order.");
      return;
    }

    setQrPhPayment(trackingQrPhPayment);
  }

  async function handleCancelTrackedOrder() {
    if (!trackingOrder || !canCancelTrackingOrder) {
      return;
    }

    setTrackingActionMessage("");
    setIsCancellingTrackedOrder(true);

    try {
      const response = await fetch("/api/customer/orders/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: trackingOrder.id }),
      });
      const result = (await response.json()) as {
        order?: { id: string; status: string };
        error?: string;
      };

      if (!response.ok || !result.order) {
        setTrackingActionMessage(result.error || "Failed to cancel order.");
        showToast({
          title: "Order not cancelled",
          description: result.error || "Failed to cancel order.",
          variant: "error",
        });
        return;
      }

      setCustomerOrders((current) =>
        current.map((order) =>
          order.id === trackingOrder.id ? { ...order, status: "cancelled" } : order
        )
      );
      setQrPhPayment((current) =>
        current?.orderId === trackingOrder.id ? null : current
      );
      setTrackingActionMessage("Order cancelled. Staff and admin are updated.");
      showToast({
        title: "Order cancelled",
        description: `${formatOrderCode(trackingOrder.id)} moved out of the active queue.`,
        variant: "success",
      });
      window.setTimeout(() => {
        closeTrackingModal();
      }, 650);
    } catch {
      setTrackingActionMessage("Something went wrong while cancelling the order.");
      showToast({
        title: "Order not cancelled",
        description: "Something went wrong while cancelling the order.",
        variant: "error",
      });
    } finally {
      setIsCancellingTrackedOrder(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarMessage("Please choose an image file.");
      showToast({
        title: "Invalid file",
        description: "Please choose an image file.",
        variant: "error",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarMessage("Profile picture must be 2MB or smaller.");
      showToast({
        title: "Image too large",
        description: "Profile picture must be 2MB or smaller.",
        variant: "error",
      });
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarMessage("");

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch("/api/customer/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setAvatarMessage(result.error || "Failed to upload profile picture.");
        showToast({
          title: "Photo not updated",
          description: result.error || "Failed to upload profile picture.",
          variant: "error",
        });
        return;
      }

      setProfileAvatarUrl(result.avatarUrl ?? "");
      setAvatarMessage("Profile picture updated.");
      showToast({
        title: "Profile photo updated",
        variant: "success",
      });
      router.refresh();
    } catch {
      setAvatarMessage("Something went wrong while uploading your photo.");
      showToast({
        title: "Photo not updated",
        description: "Something went wrong while uploading your photo.",
        variant: "error",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSaveProfileSettings() {
    if (!canSaveProfileSettings) {
      return;
    }

    setIsSavingProfile(true);
    setProfileSettingsMessage("");

    try {
      const response = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: normalizedProfileName,
          phone: normalizedProfilePhone,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setProfileSettingsMessage(
          result.error || "Failed to save profile changes."
        );
        showToast({
          title: "Profile not saved",
          description: result.error || "Failed to save profile changes.",
          variant: "error",
        });
        return;
      }

      setDisplayProfileName(result.profile?.fullName ?? normalizedProfileName);
      setProfilePhoneDraft(formatProfilePhone(result.profile?.phone ?? ""));
      setIsProfilePhoneEditing(false);
      setProfileSettingsMessage("Profile changes saved.");
      showToast({
        title: "Profile saved",
        description: "Your customer details were updated.",
        variant: "success",
      });
      router.refresh();
    } catch {
      setProfileSettingsMessage("Something went wrong while saving profile.");
      showToast({
        title: "Profile not saved",
        description: "Something went wrong while saving profile.",
        variant: "error",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/logout", {
        method: "POST",
      });

      router.replace("/");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmOpen(false);
    }
  }

  function closeProfileDrawer() {
    setIsProfileOpen(false);
    setIsProfileSettingsOpen(false);
    setProfileSettingsMessage("");
  }

  function handleSectionClick(section: Section) {
    if (
      section === "orders" &&
      !requireCustomerAccount("Login to unlock this member space.")
    ) {
      return;
    }

    setActiveSection(section);
    setIsSidebarOpen(false);
  }

  function openNotifications() {
    if (!requireCustomerAccount("Login to view notifications.")) {
      return;
    }

    setIsNotificationsOpen(true);
    setReadNotificationIds((current) => [
      ...new Set([...current, ...notifications.map((item) => item.id)]),
    ]);
  }

  function closeNotifications() {
    setIsNotificationsOpen(false);
  }

  function handleNotificationAction(notification: CustomerNotification) {
    setReadNotificationIds((current) => [
      ...new Set([...current, notification.id]),
    ]);
    setIsNotificationsOpen(false);

    if (notification.kind === "feedback") {
      if (!openFeedbackPromptForOrder(notification.orderId)) {
        handleSectionClick("orders");
      }

      return;
    }

    openTrackingModal(notification.orderId);
  }

  function finishOnboarding() {
    window.localStorage.setItem(onboardingStorageKey, "true");
    setActiveSection("home");
    setIsOnboardingOpen(false);
    setOnboardingStep(0);
    window.setTimeout(() => {
      onboardingScrollerRef.current?.scrollTo({ left: 0 });
    }, 0);
  }

  function handleOnboardingNext() {
    if (onboardingStep >= onboardingCards.length - 1) {
      finishOnboarding();
      return;
    }

    const nextStep = onboardingStep + 1;
    setOnboardingStep(nextStep);
    onboardingScrollerRef.current?.scrollTo({
      left: onboardingScrollerRef.current.clientWidth * nextStep,
      behavior: "smooth",
    });
  }

  function closeFeedbackPrompt() {
    const orderId = selectedFeedbackOrderId ?? selectedFeedbackItem?.order_id;

    if (orderId) {
      markFeedbackOrderDismissed(orderId);
    }

    hideFeedbackPrompt();
  }

  function handleFeedbackMaybeLater() {
    const orderId = selectedFeedbackOrderId ?? selectedFeedbackItem?.order_id;

    if (!orderId) {
      hideFeedbackPrompt();
      return;
    }

    const showAfter = Date.now() + feedbackMaybeLaterDelayMs;
    writeMaybeLaterOrders({
      ...readMaybeLaterOrders(),
      [orderId]: showAfter,
    });

    if (feedbackMaybeLaterTimeoutRef.current) {
      window.clearTimeout(feedbackMaybeLaterTimeoutRef.current);
    }

    feedbackMaybeLaterTimeoutRef.current = window.setTimeout(() => {
      openFeedbackPromptForOrder(orderId);
      feedbackMaybeLaterTimeoutRef.current = null;
    }, feedbackMaybeLaterDelayMs);

    hideFeedbackPrompt();
  }

  function openFeedbackForOrder(order: CustomerOrder) {
    const feedbackItem = getFeedbackItemForOrder(order.id);

    if (!feedbackItem) {
      setFeedbackMessage("Feedback for this order is already complete.");
      showToast({
        title: "Feedback already complete",
        description: "There is no pending feedback item for this order.",
        variant: "info",
      });
      return;
    }

    resetFeedbackForm();
    setSelectedFeedbackOrderId(order.id);
    setSelectedFeedbackItemId(feedbackItem.order_item_id);
    setIsFeedbackPromptOpen(true);
  }

  function handleFilterSelect(
    value: Exclude<Filter, "latte-series" | "premium-blends">
  ) {
    setFilter(value);
    const scroller = contentScrollerRef.current;

    if (!scroller) {
      return;
    }

    scroller.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleMenuSearchChange(value: string) {
    setQuery(value);
    setFilter("all");
  }

  return (
    <main className="min-h-screen bg-[#F8EBCF] text-[#123E26]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[72px] shrink-0 flex-col items-center rounded-r-[24px] bg-[#083C1F] px-2 py-4 text-white sm:w-[82px] md:flex">
          <div className="flex w-full flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0F4A27]"
            >
              <span className="space-y-1">
                <span className="block h-0.5 w-4 rounded bg-current" />
                <span className="block h-0.5 w-6 rounded bg-current" />
                <span className="block h-0.5 w-3 rounded bg-current" />
              </span>
            </button>

            {sections.map(({ id, icon: Icon, label }) => {
              const isActive = activeSection === id;

              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => handleSectionClick(id)}
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                    isActive
                      ? "bg-[#FFF0D8] text-[#0B3F22]"
                      : "text-[#F7EED8] hover:bg-[#0F4A27]"
                  }`}
                >
                  <Icon size={21} />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="hidden"
          >
            ←
          </button>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 hidden items-center justify-between gap-3 border-b border-[#D7C7A9] bg-white px-4 py-3 backdrop-blur sm:flex sm:px-5">
            <span aria-hidden="true" className="h-11 w-11" />

            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={openNotifications}
                aria-label="Open notifications"
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#DCCFB8] bg-[#FFF8EF] text-[#0D2E18] shadow-sm transition hover:bg-[#FFF0DA]"
              >
                <Bell size={19} />
                {unreadNotificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C96A12] px-1 font-sans text-[10px] font-black text-white ring-2 ring-white">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!requireCustomerAccount("Login to open your profile.")) {
                    return;
                  }

                  setIsSidebarOpen(false);
                  setIsProfileOpen(true);
                }}
                className="hidden max-w-[210px] items-center gap-3 rounded-full border border-[#DCCFB8] bg-[#FFF8EF] py-1.5 pl-1.5 pr-3 text-left shadow-sm transition hover:bg-[#FFF0DA] sm:flex"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#123E26] font-sans text-sm font-black text-[#FFF0D8]">
                  {profileAvatarUrl ? (
                    <span
                      aria-hidden="true"
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${profileAvatarUrl})` }}
                    />
                  ) : (
                    profileInitials
                  )}
                </span>
                  <span className="hidden min-w-0 sm:block">
                  <span className="block truncate font-sans text-sm font-bold leading-tight text-[#123E26]">
                    {displayProfileName}
                  </span>
                  {profileEmail ? (
                    <span className="block truncate font-sans text-[11px] leading-tight text-[#8A755D]">
                      {profileEmail}
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
          </header>

          {isSearchOpen ? (
            <div className="fixed inset-x-4 top-4 z-[70] flex items-center gap-2 rounded-full border border-[#0D2E18]/20 bg-white px-3 py-2 shadow-[0_16px_36px_rgba(13,46,24,0.16)] sm:left-[104px] sm:right-auto sm:w-[360px]">
              <Search size={18} className="shrink-0 text-[#0D2E18]" />
              <input
                value={query}
                onChange={(event) => handleMenuSearchChange(event.target.value)}
                autoFocus
                placeholder="Search menu"
                className="min-w-0 flex-1 bg-transparent font-sans text-sm font-semibold text-[#0D2E18] outline-none placeholder:text-[#8A755D]"
              />
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setQuery("");
                }}
                aria-label="Close search"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0D2E18] text-[#FFF0DA] transition hover:bg-[#0F441D]"
              >
                <X size={18} />
              </button>
            </div>
          ) : null}

          {activeSection === "menu" ? (
            <div className="sticky top-0 z-30 border-b border-[#DCCFB8] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(13,46,24,0.08)] backdrop-blur sm:px-5">
              <div className="mx-auto w-full max-w-[1440px]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="truncate font-sans text-2xl font-black leading-tight text-[#0D2E18] sm:text-3xl">
                      Menu
                    </h1>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={openNotifications}
                      aria-label="Open notifications"
                      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#DCCFB8] bg-[#FFF8EF] text-[#0D2E18] shadow-sm transition hover:bg-white sm:hidden"
                    >
                      <Bell size={18} />
                      {unreadNotificationCount > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C96A12] px-1 font-sans text-[10px] font-black text-white ring-2 ring-white">
                          {unreadNotificationCount > 9
                            ? "9+"
                            : unreadNotificationCount}
                        </span>
                      ) : null}
                    </button>
                    <span className="rounded-full border border-[#0D2E18] bg-[#0D2E18] px-3 py-2 font-sans text-xs font-black text-[#FFF0DA] shadow-[0_8px_18px_rgba(13,46,24,0.14)]">
                      {filteredMenu.length} item{filteredMenu.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="mb-3 flex items-center gap-2 rounded-[18px] border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-2.5 shadow-sm transition focus-within:border-[#0D2E18] focus-within:ring-2 focus-within:ring-[#0D2E18]/10">
                  <Search size={17} className="shrink-0 text-[#0D2E18]" />
                  <input
                    value={query}
                    onChange={(event) => handleMenuSearchChange(event.target.value)}
                    placeholder="Search drinks, pastries, categories"
                    className="min-w-0 flex-1 bg-transparent font-sans text-sm font-bold text-[#0D2E18] outline-none placeholder:text-[#8A755D]"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear menu search"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0D2E18] text-[#FFF0DA] transition hover:bg-[#0F441D]"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>
                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {menuFilters.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleFilterSelect(item.value)}
                      aria-current={
                        activeMenuFilter === item.value ? "true" : undefined
                      }
                      className={`shrink-0 rounded-full border px-4 py-2.5 font-sans text-sm font-black transition ${
                        activeMenuFilter === item.value
                          ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA] shadow-[0_8px_18px_rgba(13,46,24,0.18)]"
                          : "border-[#DCCFB8] bg-[#FFF8EF] text-[#684B35] hover:border-[#0D2E18] hover:bg-[#FFF0DA] hover:text-[#0D2E18]"
                      }`}
                    >
                      <span>{item.label}</span>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                          activeMenuFilter === item.value
                            ? "bg-[#FFF0DA]/18 text-[#FFF0DA]"
                            : "bg-white text-[#0D2E18]"
                        }`}
                      >
                        {menuFilterCounts.get(item.value) ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div
            ref={contentScrollerRef}
            className="flex-1 overflow-y-auto px-4 pb-28 pt-0 sm:px-5 sm:py-5 2xl:px-8"
          >
            {activeSection === "home" && (
              <div className="mx-auto w-full max-w-[1180px] space-y-5">
                <section className="pt-1">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h1 className="mt-2 max-w-3xl font-sans text-4xl font-bold leading-[1.02] text-[#0D2E18] sm:text-5xl">
                        {greeting}, {firstName}
                      </h1>
                      <p className="mt-3 max-w-2xl font-sans text-base leading-7 text-[#684B35]">
                        Order your favorite coffee, check nutrition facts,
                        and track every cup live from queue to pickup.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
                      {[
                        ["Delivery", "Send it to me"],
                        ["Pickup", "I will claim it"],
                      ].map(([label, helper]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            window.sessionStorage.setItem(
                              checkoutOrderTypeStorageKey,
                              label === "Delivery" ? "delivery" : "pickup"
                            );
                            setFilter("coffee");
                            setActiveSection("menu");
                          }}
                          className="rounded-[26px] border border-[#DCCFB8] bg-white/82 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0D2E18] text-[#FFF0D8]">
                            {label === "Delivery" ? (
                              <ClipboardList size={21} />
                            ) : (
                              <CupSoda size={21} />
                            )}
                          </span>
                          <span className="mt-3 block font-sans text-lg font-black text-[#0D2E18]">
                            {label}
                          </span>
                          <span className="mt-1 block font-sans text-xs font-semibold text-[#8A755D]">
                            {helper}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="-mx-4 overflow-hidden sm:mx-0 sm:rounded-[22px] lg:rounded-[26px]">
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-none shadow-[0_18px_36px_rgba(15,68,29,0.2)] sm:aspect-[16/9] sm:rounded-[22px] lg:rounded-[26px]">
                      <div
                        className="flex h-full transition-transform duration-700 ease-out"
                        style={{
                          width: `${promotionImages.length * 100}%`,
                          transform: `translateX(-${activePromotionIndex * (100 / promotionImages.length)}%)`,
                        }}
                      >
                        {promotionImages.map((image, index) => (
                          <div
                            key={image}
                            className="h-full"
                            style={{ width: `${100 / promotionImages.length}%` }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image}
                              alt={`KadaServe promotion ${index + 1}`}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#0D2E18]/35 px-2 py-1 backdrop-blur-sm">
                        {promotionImages.map((image, index) => (
                          <span
                            key={`${image}-dot`}
                            aria-hidden="true"
                            className={`h-2 rounded-full transition-all ${
                              index === activePromotionIndex
                                ? "w-5 bg-[#FFF0D8]"
                                : "w-2 bg-[#FFF0D8]/55"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-y border-[#DCCFB8] py-4 lg:border-y-0 lg:border-l lg:py-1 lg:pl-5">
                    <h2 className="mt-1 font-sans text-3xl font-bold leading-tight text-[#0D2E18]">
                      Got thoughts?
                    </h2>
                    <p className="mt-2 font-sans text-sm leading-6 text-[#6F634E]">
                      Rate your last order. Feedback helps
                      KadaServe improve your recommendations.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !requireCustomerAccount(
                            "Login to submit feedback."
                          )
                        ) {
                          return;
                        }

                        if (feedbackMissionAvailable) {
                          setIsFeedbackPromptOpen(true);
                        }
                      }}
                      className="mt-4 min-h-12 w-full rounded-full bg-[#0D2E18] px-4 font-sans text-sm font-bold text-[#FFF0D8] transition hover:bg-[#0F441D]"
                    >
                      {feedbackMissionAvailable
                        ? "Rate Last Order"
                        : "No Feedback Pending"}
                    </button>
                  </div>
                </section>

                {activeOrder ? (
                  <section className="rounded-[26px] border border-[#DCCFB8] bg-white/88 p-4 shadow-[0_8px_20px_rgba(0,0,0,0.06)] sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="mt-1 font-sans text-2xl font-black text-[#123E26]">
                          {formatOrderCode(activeOrder.id)} is{" "}
                          {formatStatus(activeOrder.status).toLowerCase()}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => openTrackingModal(activeOrder.id)}
                        className="rounded-full bg-[#0D2E18] px-4 py-3 font-sans text-sm font-bold text-[#FFF0D8] transition hover:bg-[#0F441D]"
                      >
                        Track Order
                      </button>
                    </div>
                  </section>
                ) : null}

                <section className="group relative overflow-hidden rounded-[28px] bg-[#123E26] px-4 py-4 text-[#FFF0D8] shadow-[0_14px_32px_rgba(18,62,38,0.18)] sm:px-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#DCCFB8]">
                        {isColdStartRecommendation
                          ? "Top Sellers"
                          : "Recommended for You"}
                      </p>
                      <h2 className="mt-1 font-display text-3xl font-semibold leading-tight sm:text-4xl">
                        Your next cup, picked smarter.
                      </h2>
                    </div>
                    <div className="rounded-full bg-[#FFF0D8]/10 px-4 py-2 font-sans text-xs font-bold text-[#FFF0D8]">
                      {isColdStartRecommendation
                        ? "Start ordering to personalize this"
                        : `Monthly favorite: ${monthlyFavorite}`}
                    </div>
                  </div>

                  <div
                    ref={recommendationScrollerRef}
                    className="mt-4 flex snap-x gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {displayRecommendedItems.map(({ item, displayMeta, reason }) => {
                      const menuImage = getMenuImage(item);
                      const itemFeedback = getMenuFeedback(menuFeedbackByItemId, item);

                      return (
                        <article
                          key={item.id}
                          className="relative flex w-[280px] shrink-0 snap-start overflow-hidden rounded-[24px] bg-[#FFF8EF] text-[#123E26] shadow-[0_12px_24px_rgba(0,0,0,0.14)] sm:w-[310px]"
                        >
                          <button
                            type="button"
                            onClick={() => openCustomizeModal(item)}
                            aria-label={`Customize ${item.name}`}
                            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#684B35] shadow-sm transition hover:bg-white"
                          >
                            <SlidersHorizontal size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => openCustomizeModal(item)}
                            className="flex aspect-square w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E7F1E6] p-1.5 text-4xl"
                            aria-label={`Open ${item.name}`}
                          >
                            {menuImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={menuImage}
                                alt={item.name}
                                loading="lazy"
                                className="aspect-square h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              getEmoji(item)
                            )}
                          </button>

                          <div className="flex min-w-0 flex-1 flex-col p-4 pr-12">
                            <div>
                              <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#8A755D]">
                                {displayMeta.label}
                              </p>
                              <span className="mt-1 inline-flex w-fit rounded-full border border-[#DCCFB8] px-2 py-0.5 font-sans text-[10px] font-black tracking-[0.12em] text-[#684B35]">
                                {displayMeta.tag}
                              </span>
                              <h3 className="mt-1 line-clamp-2 font-sans text-xl font-black leading-tight">
                                {item.name}
                              </h3>
                              {itemFeedback ? (
                                <div className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-[#FFE9A8] px-2.5 py-1 font-sans text-[11px] font-black text-[#684B35]">
                                  <Star className="h-3 w-3 fill-current" />
                                  {formatRating(itemFeedback.averageRating)} (
                                  {itemFeedback.ratingCount})
                                </div>
                              ) : null}
                              <p className="mt-1 line-clamp-2 font-sans text-[11px] font-semibold leading-snug text-[#684B35]">
                                {reason}
                              </p>
                            </div>

                            <div className="mt-auto flex items-center gap-2 pt-4">
                              <p className="shrink-0 font-sans text-xl font-black text-[#765531]">
                                {formatPrice(item.base_price)}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleQuickAdd(item)}
                                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#123E26] px-3 py-2.5 font-sans text-sm font-bold text-white transition hover:bg-[#0D2E18]"
                              >
                                <ShoppingCart size={16} />
                                Add
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {activeSection === "menu" && (
              <div className="mx-auto w-full max-w-[1440px] space-y-4">
                <div
                  ref={fullMenuRef}
                  className="space-y-10 scroll-mt-24 pb-28"
                >
                  {menuGroups.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-[#D8C8A7] bg-white px-5 py-10 text-center shadow-sm">
                      <Search className="mx-auto h-8 w-8 text-[#684B35]" />
                      <h2 className="mt-3 font-sans text-xl font-black text-[#0D2E18]">
                        No menu items found
                      </h2>
                      <p className="mx-auto mt-2 max-w-sm font-sans text-sm font-semibold leading-6 text-[#684B35]">
                        Try another item name, category, or clear the search.
                      </p>
                      {hasMenuSearch ? (
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          className="mt-4 rounded-full bg-[#0D2E18] px-5 py-2.5 font-sans text-sm font-black text-[#FFF0DA]"
                        >
                          Clear Search
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                    {menuGroups.map((group) => (
                      <section
                        key={group.value}
                        className="scroll-mt-4"
                      >
                        <h2 className="mb-4 border-l-4 border-[#0D2E18] pl-3 font-sans text-xl font-black text-[#0D2E18]">
                          {group.label}
                        </h2>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 xl:grid-cols-4">
                          {group.items.length === 0 ? (
                            <div className="col-span-full rounded-[20px] border border-dashed border-[#D8C8A7] bg-white px-5 py-8 text-center font-sans text-sm font-semibold text-[#684B35]">
                              No items in this category yet.
                            </div>
                          ) : null}
                          {group.items.map((item) => {
                            const menuImage = getMenuImage(item);
                            const isQuickAdded = quickAddFeedback?.itemId === item.id;
                            const itemNutrition = getMenuItemNutrition(item);
                            const itemFeedback = getMenuFeedback(menuFeedbackByItemId, item);

                            return (
                      <article
                        key={item.id}
                        className="relative min-w-0 text-center"
                      >
                        {isQuickAdded ? (
                          <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 animate-bounce items-center gap-1.5 whitespace-nowrap rounded-full bg-[#0D2E18] px-3 py-2 font-sans text-xs font-black text-[#FFF0DA] shadow-[0_10px_18px_rgba(13,46,24,0.20)]">
                            <CheckCircle2 size={14} />
                            Added
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            if (!item.is_available) {
                              return;
                            }

                            if (isPastryMenuItem(item)) {
                              handleQuickAdd(item);
                              return;
                            }

                            openCustomizeModal(item);
                          }}
                          disabled={!item.is_available}
                          className="group w-full disabled:cursor-not-allowed"
                          aria-label={`${
                            !item.is_available
                              ? "Unavailable"
                              : isPastryMenuItem(item)
                              ? "Add"
                              : "Customize"
                          } ${item.name}`}
                        >
                          <div className="mx-auto flex aspect-square w-full max-w-[150px] items-center justify-center overflow-hidden rounded-full bg-[#F1E7D2] p-2 text-4xl transition group-hover:bg-[#E7F1E6]">
                            {menuImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={menuImage}
                                alt={item.name}
                              className="aspect-square h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              getEmoji(item)
                            )}
                          </div>

                          <span
                            className={`mt-3 inline-flex rounded-full px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.12em] ${
                              item.is_available
                                ? "bg-[#E9F5E7] text-[#2D7A40]"
                                : "bg-[#FBE9E2] text-[#9C543D]"
                            }`}
                          >
                            {item.is_available ? "Available" : "Sold out"}
                          </span>
                          <h2 className="mx-auto mt-2 line-clamp-2 max-w-[150px] font-sans text-sm font-black leading-tight text-[#123E26]">
                            {item.name}
                          </h2>
                          <p className="mt-2 font-sans text-base font-black text-[#0D2E18]">
                            {formatPrice(item.base_price)}
                          </p>
                          {itemFeedback ? (
                            <p className="mx-auto mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-[#FFE9A8] px-2.5 py-1 font-sans text-[10px] font-black text-[#684B35]">
                              <Star className="h-3 w-3 fill-current" />
                              {formatRating(itemFeedback.averageRating)} (
                              {itemFeedback.ratingCount})
                            </p>
                          ) : null}
                          {itemNutrition ? (
                            <p className="mx-auto mt-1 w-fit rounded-full bg-white/75 px-2.5 py-1 font-sans text-[10px] font-black text-[#684B35]">
                              {itemNutrition.calories} cal
                            </p>
                          ) : null}
                          <span
                            className={`mx-auto mt-3 inline-flex h-9 items-center justify-center rounded-full px-4 font-sans text-xs font-black transition ${
                              item.is_available
                                ? "bg-[#0D2E18] text-[#FFF0DA] group-hover:bg-[#0F441D]"
                                : "bg-[#E7D7BE] text-[#8A755D]"
                            }`}
                          >
                            {!item.is_available
                              ? "Sold Out"
                              : isPastryMenuItem(item)
                              ? "Add"
                              : "Customize"}
                          </span>
                        </button>
                      </article>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                </div>
              </div>
            )}

            {activeSection === "orders" && (
              <div className="mx-auto w-full max-w-3xl space-y-5">
                <div>
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#8A755D]">
                    Order Status
                  </p>
                  <h1 className="font-sans text-4xl font-bold tracking-tight text-[#123E26]">
                    My Orders
                  </h1>
                </div>

                {currentOrders.length > 0 ? (
                  <label className="block">
                    <span className="sr-only">Choose current order to track</span>
                    <span className="mb-2 block font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8A755D]">
                      Current Orders ({currentOrders.length})
                    </span>
                    <div className="relative">
                      <select
                        value={activeOrder?.id ?? ""}
                        onChange={(event) => handleCurrentOrderChange(event.target.value)}
                        className="min-h-12 w-full appearance-none rounded-full border border-[#DCCFB8] bg-white px-4 pr-12 font-sans text-sm font-semibold text-[#123E26] shadow-[0_6px_16px_rgba(0,0,0,0.05)] outline-none transition focus:border-[#0D2E18] focus:ring-2 focus:ring-[#0D2E18]/15"
                      >
                        {currentOrders.map((order) => (
                          <option key={order.id} value={order.id}>
                            {formatOrderCode(order.id)} - {formatStatus(order.status)} - {formatOrderItemSummary(
                              order.order_items
                                .map((item) => item.menu_items?.name)
                                .filter(Boolean) as string[]
                            )}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={18}
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#684B35]"
                      />
                    </div>
                  </label>
                ) : null}

                {activeOrder ? (
                  <article
                    className="rounded-[28px] border border-[#DCCFB8] bg-white p-4 shadow-[0_12px_28px_rgba(13,46,24,0.10)] transition hover:shadow-[0_14px_32px_rgba(13,46,24,0.14)] sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="mt-1 font-sans text-2xl font-black text-[#123E26]">
                          {formatOrderCode(activeOrder.id)}
                        </h2>
                        <p className="mt-1 text-sm font-semibold text-[#6F634E]">
                          {formatOrderItemSummary(
                            activeOrder.order_items
                              .map((item) => item.menu_items?.name)
                              .filter(Boolean) as string[]
                          )}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-black ${
                          activeOrder.status === "ready"
                            ? "bg-[#E9F5E7] text-[#2D7A40]"
                            : activeOrder.status === "preparing"
                            ? "bg-[#FFF0DA] text-[#B76522]"
                            : activeOrder.status === "out_for_delivery"
                            ? "bg-[#FFF0E5] text-[#B76522]"
                            : "bg-[#EEF2F6] text-[#516274]"
                        }`}
                      >
                        {formatStatus(activeOrder.status)}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-4 gap-2">
                      {[
                        "Placed",
                        "Preparing",
                        "Ready",
                        activeOrder.order_type === "delivery"
                          ? "Out for Delivery"
                          : "Pickup",
                      ].map((step, index) => {
                        const isReached = index <= activeOrderStep;
                        const isCurrent = index === activeOrderStep;

                        return (
                          <div key={step}>
                            <div
                              className={`h-2 rounded-full transition ${
                                isReached ? "bg-[#123E26]" : "bg-[#E6D8BE]"
                              } ${isCurrent ? "animate-pulse" : ""}`}
                            />
                            <p
                              className={`mt-2 font-sans text-[10px] font-bold leading-tight ${
                                isReached ? "text-[#123E26]" : "text-[#9A856C]"
                              }`}
                            >
                              {step}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#EEE2C8] pt-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                          {formatOrderType(activeOrder.order_type)}
                        </p>
                        <p className="mt-1 text-xs text-[#9A8A73]">
                          Placed at {formatTime(activeOrder.ordered_at)}
                        </p>
                      </div>
                      <p className="text-2xl font-black text-[#9D6D48]">
                        {formatPrice(activeOrder.total_amount)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openTrackingModal(activeOrder.id)}
                      className="mt-4 w-full rounded-full bg-[#0D2E18] px-4 py-3 font-sans text-sm font-bold text-[#FFF0D8] transition hover:bg-[#0F441D] sm:w-auto"
                    >
                      Track Order
                    </button>
                  </article>
                ) : null}

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-sans text-xl font-black text-[#123E26]">
                      Order History
                    </h2>
                    <span className="rounded-full bg-[#EFE3CF] px-3 py-1 font-sans text-xs font-bold text-[#684B35]">
                      {orderHistory.length} saved
                    </span>
                  </div>

                  {customerOrders.length === 0 ? (
                    <div className="rounded-[24px] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
                      <p className="text-xl font-bold text-[#123E26]">
                        No orders yet
                      </p>
                      <p className="mt-2 text-[#5D694F]">
                        Once you place an order, it will appear here.
                      </p>
                    </div>
                  ) : orderHistory.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-[#D8C8A7] bg-[#FFF8EF] p-5 text-center text-sm text-[#6F634E]">
                      Finished orders will appear here after your live order is done.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 md:hidden">
                        {orderHistory.map((order) => {
                      const itemNames = order.order_items
                        .map((item) => item.menu_items?.name)
                        .filter(Boolean) as string[];
                      const canGiveFeedback = feedbackItems.some(
                        (item) => item.order_id === order.id
                      );

                      return (
                        <article
                          key={order.id}
                          className="rounded-[22px] bg-white p-4 shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-sans text-lg font-black text-[#123E26]">
                                {formatOrderCode(order.id)}
                              </p>
                              <p className="mt-1 line-clamp-1 text-base font-bold text-[#1F1711]">
                                {formatOrderItemSummary(itemNames)}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
                                order.status === "cancelled"
                                  ? "bg-[#FBE9E2] text-[#9C543D]"
                                  : isFinalOrder(order.status)
                                  ? "bg-[#E8F4E4] text-[#2D7A40]"
                                  : "bg-[#F5EAD7] text-[#8C5C2A]"
                              }`}
                            >
                              {formatStatus(order.status)}
                            </span>
                          </div>

                          <div className="mt-4 flex items-end justify-between gap-4 border-t border-[#EEE2C8] pt-4">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                                {formatOrderType(order.order_type)} •{" "}
                                {formatTime(order.ordered_at)}
                              </p>
                              <p className="mt-1 text-xl font-black text-[#9D6D48]">
                                {formatPrice(order.total_amount)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openFeedbackForOrder(order)}
                              disabled={!canGiveFeedback}
                              className="shrink-0 rounded-full bg-[#123E26] px-4 py-2 font-sans text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-[#D8C8A7] disabled:text-[#8A755D]"
                            >
                              Feedback
                            </button>
                          </div>
                        </article>
                      );
                    })}
                      </div>

                      <div className="hidden overflow-hidden rounded-[22px] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.08)] md:block">
                        <div className="grid grid-cols-[1fr_1.25fr_0.8fr_1fr_0.8fr_0.8fr] gap-4 border-b border-[#EEE2C8] bg-[#FFF8EF] px-4 py-3 font-sans text-xs font-black uppercase tracking-[0.12em] text-[#684B35]">
                          <span>Order</span>
                          <span>Items</span>
                          <span>Type</span>
                          <span>Status</span>
                          <span>Total</span>
                          <span>Action</span>
                        </div>

                        {orderHistory.map((order) => {
                          const itemNames = order.order_items
                            .map((item) => item.menu_items?.name)
                            .filter(Boolean) as string[];
                          const canGiveFeedback = feedbackItems.some(
                            (item) => item.order_id === order.id
                          );

                          return (
                            <div
                              key={order.id}
                              className="grid grid-cols-[1fr_1.25fr_0.8fr_1fr_0.8fr_0.8fr] items-center gap-4 border-b border-[#EEE2C8] px-4 py-3 last:border-b-0"
                            >
                              <div>
                                <p className="font-sans text-sm font-black text-[#123E26]">
                                  {formatOrderCode(order.id)}
                                </p>
                                <p className="mt-0.5 text-xs text-[#8A755D]">
                                  {formatTime(order.ordered_at)}
                                </p>
                              </div>
                              <p className="line-clamp-1 font-sans text-sm font-bold text-[#1F1711]">
                                {formatOrderItemSummary(itemNames)}
                              </p>
                              <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                                {formatOrderType(order.order_type)}
                              </span>
                              <span
                                className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${
                                  order.status === "cancelled"
                                    ? "bg-[#FBE9E2] text-[#9C543D]"
                                    : isFinalOrder(order.status)
                                    ? "bg-[#E8F4E4] text-[#2D7A40]"
                                    : "bg-[#F5EAD7] text-[#8C5C2A]"
                                }`}
                              >
                                {formatStatus(order.status)}
                              </span>
                              <p className="font-sans text-base font-black text-[#9D6D48]">
                                {formatPrice(order.total_amount)}
                              </p>
                              <button
                                type="button"
                                onClick={() => openFeedbackForOrder(order)}
                                disabled={!canGiveFeedback}
                                className="w-fit rounded-full bg-[#123E26] px-4 py-2 font-sans text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-[#D8C8A7] disabled:text-[#8A755D]"
                              >
                                Feedback
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>
              </div>
            )}

            {activeSection === "feedback" && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                    Feedback
                  </h1>
                  <p className="mt-1 text-sm text-[#6F634E]">
                    Share feedback for delivered or completed orders.
                  </p>
                </div>

                {feedbackItems.length === 0 ? (
                  <div className="rounded-[24px] bg-white p-6 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
                    <p className="text-2xl font-bold text-[#123E26]">
                      No feedback pending
                    </p>
                    <p className="mt-2 text-[#5D694F]">
                      Once you complete an order that has not been reviewed yet,
                      it will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[28px] bg-white p-5 shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E9F1E6] text-4xl shadow-[0_8px_18px_rgba(12,58,30,0.10)]">
                        {selectedFeedbackItem
                          ? getFeedbackEmoji(selectedFeedbackItem.item_name)
                          : "☕"}
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7D7767]">
                          How was your order?
                        </p>
                        <h2 className="mt-1 text-3xl font-bold text-[#123E26]">
                          {selectedFeedbackItem?.item_name ?? "Select an item"}
                        </h2>
                        <p className="mt-1 text-sm text-[#5D694F]">
                          Your feedback helps improve the customer experience.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <label className="mb-2 block text-sm font-semibold text-[#5D694F]">
                        Select Order Item
                      </label>
                      <select
                        value={selectedFeedbackItemId}
                        onChange={(event) =>
                          setSelectedFeedbackItemId(event.target.value)
                        }
                        className="w-full rounded-[18px] border border-[#D8C8A7] bg-[#FFFCF7] px-4 py-3 outline-none"
                      >
                        {feedbackItems.map((item) => (
                          <option
                            key={item.order_item_id}
                            value={item.order_item_id}
                          >
                            {item.item_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-6 space-y-6">
                      {(
                        [
                          ["Taste Quality", tasteRating, setTasteRating],
                        ] as const
                      ).map(([label, value, setValue]) => (
                        <div
                          key={label}
                          className="rounded-[20px] bg-[#FFF8EE] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-lg font-bold text-[#123E26]">
                              {label}
                            </p>
                            <span className="text-sm font-semibold text-[#8A755D]">
                              {value > 0 ? `${value}/5` : "Select"}
                            </span>
                          </div>

                          <div className="mt-3 flex gap-2">
                            {[1, 2, 3, 4, 5].map((score) => (
                              <button
                                key={score}
                                type="button"
                                onClick={() => handleRatingChange(setValue, score)}
                                className={`text-4xl transition hover:text-[#C96A12] ${
                                  score <= value
                                    ? "text-[#C96A12]"
                                    : "text-[#D8C8A7]"
                                }`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="rounded-[20px] bg-[#FFF8EE] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-lg font-bold text-[#123E26]">
                            Drink Strength
                          </p>
                          <span className="text-sm font-semibold text-[#8A755D]">
                            {strengthRating === 2
                              ? "Mild"
                              : strengthRating === 5
                              ? "Strong"
                              : "Balanced"}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {[
                            ["Mild", 2],
                            ["Balanced", 3],
                            ["Strong", 5],
                          ].map(([label, value]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() =>
                                handleRatingChange(setStrengthRating, Number(value))
                              }
                              className={`rounded-full border px-3 py-3 font-sans text-sm font-bold transition ${
                                strengthRating === value
                                  ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                                  : "border-[#D8C8A7] bg-white text-[#684B35]"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-[#5D694F]">
                          Comment
                        </label>
                        <textarea
                          value={feedbackComment}
                          onChange={(event) =>
                            setFeedbackComment(event.target.value)
                          }
                          placeholder="Tell us about your order"
                          className="min-h-28 w-full rounded-[18px] border border-[#D8C8A7] bg-[#FFFCF7] px-4 py-3 outline-none placeholder:text-[#A49175]"
                        />
                      </div>

                      <div className="rounded-[20px] bg-[#FFF8EE] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-lg font-bold text-[#123E26]">
                            Overall Experience
                          </p>
                          <span className="text-sm font-semibold text-[#8A755D]">
                            {overallRating > 0 ? `${overallRating}/5` : "Select"}
                          </span>
                        </div>

                        <div className="mt-3 flex gap-2">
                          {[1, 2, 3, 4, 5].map((score) => (
                            <button
                              key={score}
                              type="button"
                              onClick={() =>
                                handleRatingChange(setOverallRating, score)
                              }
                              className={`text-4xl transition hover:text-[#C96A12] ${
                                score <= overallRating
                                  ? "text-[#C96A12]"
                                  : "text-[#D8C8A7]"
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>

                      {feedbackMessage ? (
                        <p
                          className={`rounded-xl px-4 py-3 text-sm font-medium ${
                            feedbackMessage.toLowerCase().includes("success")
                              ? "bg-[#EEF8EC] text-[#2D7A40]"
                              : "bg-[#FFF1EC] text-[#9C543D]"
                          }`}
                        >
                          {feedbackMessage}
                        </p>
                      ) : null}

                      <button
                        type="button"
                        onClick={handleSubmitFeedback}
                        disabled={!canSubmitFeedback}
                        className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#123E26] px-5 py-4 text-lg font-bold text-white disabled:opacity-60"
                      >
                        {isSubmittingFeedback ? (
                          <LoadingSpinner label="Submitting feedback" />
                        ) : null}
                        {isSubmittingFeedback
                          ? "Submitting..."
                          : "Submit Feedback"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {isSplashVisible ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-[#0D2E18] px-6 text-[#FFF0DA]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,#0F441D_0%,#0D2E18_46%,#06190D_100%)]" />
          <div className="kada-loading-exit relative z-10 flex w-full max-w-[820px] flex-col items-center">
            <div className="relative mb-10 flex h-32 w-full max-w-md items-center justify-center text-center sm:mb-16 sm:h-36">
              <div className="kada-brand-dissolve absolute inset-0 flex flex-col items-center justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#FFF0DA] text-[#0D2E18] shadow-[0_16px_34px_rgba(0,0,0,0.18)]">
                  <svg
                    viewBox="0 0 96 96"
                    aria-hidden="true"
                    className="h-11 w-11 text-[#0F441D]"
                  >
                    <g
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="8"
                    >
                      <circle cx="30" cy="58" r="15" />
                      <circle cx="66" cy="58" r="15" />
                      <path d="M30 58 48 42 66 58" />
                      <path d="M48 42 57 26" />
                      <path d="M55 25 64 43" />
                    </g>
                  </svg>
                </div>
                <p className="mt-5 font-sans text-4xl font-bold text-[#FFF0DA]">
                  KadaServe
                </p>
              </div>

              <p className="kada-brand-emerge absolute inset-x-0 top-1/2 -translate-y-1/2 font-sans text-4xl italic leading-tight text-[#FFF0DA]">
                Every cup tells a story
              </p>
            </div>

            <div className="w-full max-w-[720px]">
              <p className="-rotate-0 pl-1 font-sans text-[1.1rem] font-black uppercase tracking-[0.14em] text-[#FFF0DA] drop-shadow-sm sm:pl-3 sm:text-3xl sm:tracking-[0.16em]">
                Kadaserve Loading...
              </p>

              <div className="relative mt-4 h-52 sm:h-72">
                <svg
                  viewBox="0 0 700 52"
                  aria-hidden="true"
                  className="h-12 w-full overflow-visible"
                >
                  <path
                    d="M26 26 H674"
                    fill="none"
                    stroke="#FFF0DA"
                    strokeLinecap="round"
                    strokeWidth="30"
                    opacity="0.95"
                  />
                  <path
                    d="M26 26 H674"
                    fill="none"
                    stroke="#0F441D"
                    strokeLinecap="round"
                    strokeWidth="22"
                    pathLength="100"
                    className="kada-progress-path"
                  />
                </svg>
                <span className="kada-loading-drip-rail absolute left-0 top-0 h-0 w-0">
                  <span className="kada-loading-spout absolute left-0 top-[1.45rem] h-6 w-2 rounded-b-full bg-[#0F441D]" />
                  <span className="kada-loading-drop absolute left-0 top-[2.75rem]" />
                  <span className="kada-loading-drop absolute left-0 top-[3.7rem] [animation-delay:220ms]" />
                  <span className="kada-loading-drop absolute left-0 top-[4.65rem] [animation-delay:440ms]" />
                </span>

                <svg
                  viewBox="0 0 420 260"
                  role="img"
                  aria-label="KadaServe spoon bike loading mark"
                  className="kada-transit-bike absolute top-[5rem] w-32 overflow-visible text-[#FFF0DA] sm:top-[6.4rem] sm:w-60"
                >
                  <g
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="18"
                  >
                    <path d="M122 178 212 112 296 178" />
                    <path d="M212 112 258 58" />
                    <path d="M250 48 286 110" />
                    <path d="M205 112 168 178" />
                  </g>
                  <g className="kada-loading-wheel">
                    <circle
                      cx="122"
                      cy="178"
                      r="61"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="18"
                    />
                    <ellipse
                      cx="122"
                      cy="178"
                      rx="27"
                      ry="17"
                      fill="currentColor"
                      transform="rotate(-38 122 178)"
                    />
                  </g>
                  <g className="kada-loading-wheel">
                    <circle
                      cx="296"
                      cy="178"
                      r="61"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="18"
                    />
                    <ellipse
                      cx="296"
                      cy="178"
                      rx="27"
                      ry="17"
                      fill="currentColor"
                      transform="rotate(48 296 178)"
                    />
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isTaglineVisible ? (
        <div className="fixed inset-0 z-[88] flex items-center justify-center bg-[#0D2E18] px-6 text-[#FFF0D8]">
          <div className="text-center">
            <p className="font-sans text-5xl font-bold leading-tight sm:text-6xl">
              Every cup
              <span className="block italic">tells a story.</span>
            </p>
            <p className="mt-5 font-sans text-sm font-bold uppercase tracking-[0.22em] text-[#DCCFB8]">
              Welcome to KadaServe
            </p>
          </div>
        </div>
      ) : null}

      {isOnboardingOpen && !isTaglineVisible ? (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-[#0D2E18]/45 px-3 backdrop-blur-md md:items-center md:p-6">
          <section className="w-full max-w-lg rounded-t-[30px] border border-[#DCCFB8] bg-[#FFF0DA] shadow-[0_-18px_40px_rgba(13,46,24,0.20)] md:rounded-[30px] lg:max-w-xl">
            <div className="px-5 pb-5 pt-4 md:p-6">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#DCCFB8] md:hidden" />

              <div className="flex items-center justify-between gap-4">
                <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
                  First Sip Journey
                </p>
                <button
                  type="button"
                  onClick={finishOnboarding}
                  className="rounded-full border border-[#DCCFB8] bg-white/78 px-3 py-2 font-sans text-xs font-bold text-[#684B35] transition hover:bg-white"
                >
                  Skip
                </button>
              </div>
            </div>

            <div
              ref={onboardingScrollerRef}
              onScroll={(event) => {
                const { clientWidth, scrollLeft } = event.currentTarget;
                const nextStep = Math.round(scrollLeft / Math.max(clientWidth, 1));

                if (nextStep !== onboardingStep) {
                  setOnboardingStep(
                    Math.min(Math.max(nextStep, 0), onboardingCards.length - 1)
                  );
                }
              }}
              className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {onboardingCards.map((card) => {
                const Icon = card.icon;

                return (
                  <article
                    key={card.title}
                    className="min-w-full snap-center px-5 pb-3 md:px-6"
                  >
                    <div className="flex min-h-[19rem] flex-col items-center justify-center rounded-[26px] bg-[#0D2E18] p-5 text-center text-[#FFF0D8] sm:min-h-[21rem] sm:p-6">
                      <div className="relative flex h-32 w-32 items-center justify-center sm:h-36 sm:w-36">
                        {card.illustration === "discovery" ? (
                          <>
                            <div className="absolute inset-4 rounded-full bg-[#FFF0DA]/12" />
                            <div className="relative flex h-24 w-24 items-center justify-center rounded-[32px] bg-[#FFF0DA] text-[#0D2E18] shadow-[0_18px_34px_rgba(0,0,0,0.20)]">
                              <CupSoda className="h-12 w-12 text-[#0F441D]" />
                            </div>
                            <Sparkles className="absolute right-4 top-4 h-7 w-7 text-[#FFF0D8]" />
                          </>
                        ) : card.illustration === "tracking" ? (
                          <div className="relative h-full w-full">
                            <div className="absolute left-4 right-4 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#FFF0D8]/28">
                              <div className="h-full w-2/3 rounded-full bg-[#FFF0D8]" />
                            </div>
                            <svg
                              viewBox="0 0 96 96"
                              aria-hidden="true"
                              className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 text-[#FFF0D8]"
                            >
                              <g
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="8"
                              >
                                <circle cx="30" cy="60" r="14" />
                                <circle cx="66" cy="60" r="14" />
                                <path d="M30 60 48 44 66 60" />
                                <path d="M48 44 57 28" />
                                <path d="M55 28 64 45" />
                              </g>
                            </svg>
                          </div>
                        ) : (
                          <>
                            <div className="absolute inset-5 rounded-full border border-[#FFF0D8]/28" />
                            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#FFF0D8] text-[#0D2E18] shadow-[0_18px_34px_rgba(0,0,0,0.20)]">
                              <span className="font-sans text-4xl font-black">+1</span>
                            </div>
                            <Star className="absolute right-4 top-4 h-8 w-8 text-[#FFF0D8]" />
                          </>
                        )}
                      </div>

                      <div className="mt-5 flex h-10 w-10 items-center justify-center rounded-full bg-[#0F441D]">
                        <Icon size={20} />
                      </div>
                      <h2 className="mt-4 font-sans text-3xl font-bold leading-tight text-[#FFF0D8] sm:text-4xl">
                        {card.title}
                      </h2>
                      <p className="mt-4 max-w-sm font-sans text-base leading-7 text-[#FFF0D8]/88">
                        {card.body}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-4 px-5 pb-5 pt-2 md:px-6 md:pb-6">
              <div className="flex gap-2">
                {onboardingCards.map((card, index) => (
                  <button
                    key={card.title}
                    type="button"
                    aria-label={`Go to onboarding slide ${index + 1}`}
                    onClick={() => {
                      setOnboardingStep(index);
                      onboardingScrollerRef.current?.scrollTo({
                        left:
                          onboardingScrollerRef.current.clientWidth * index,
                        behavior: "smooth",
                      });
                    }}
                    className={`h-2 rounded-full transition-all ${
                      index === onboardingStep
                        ? "w-8 bg-[#0D2E18]"
                        : "w-2 bg-[#DCCFB8]"
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleOnboardingNext}
                aria-label={
                  onboardingStep >= onboardingCards.length - 1
                    ? "Enter KadaServe"
                    : "Next onboarding slide"
                }
                className="group flex h-14 min-w-14 items-center justify-center rounded-full bg-[#0D2E18] px-5 font-sans text-sm font-bold text-[#FFF0DA] shadow-[0_12px_26px_rgba(13,46,24,0.20)] transition duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#0F441D] hover:shadow-[0_16px_34px_rgba(13,46,24,0.26)]"
              >
                <span
                  className={
                    onboardingStep >= onboardingCards.length - 1
                      ? "inline"
                      : "hidden sm:inline"
                  }
                >
                  {onboardingStep >= onboardingCards.length - 1
                    ? "Get Started"
                    : "Next"}
                </span>
                <ChevronRight className="h-5 w-5 transition group-hover:translate-x-0.5 sm:ml-2" />
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {guestActionMessage ? (
        <div className="fixed left-1/2 top-4 z-[80] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-[18px] border border-[#DCCFB8] bg-white px-4 py-3 text-center font-sans text-sm font-bold text-[#0D2E18] shadow-[0_14px_34px_rgba(13,46,24,0.18)]">
          {guestActionMessage}
        </div>
      ) : null}

      {!isSearchOpen &&
      activeSection !== "menu" &&
      !isSplashVisible &&
      !isTaglineVisible &&
      !isOnboardingOpen ? (
        <button
          type="button"
          onClick={openNotifications}
          aria-label="Open notifications"
          className="fixed right-4 top-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-[#DCCFB8] bg-white/95 text-[#0D2E18] shadow-[0_12px_26px_rgba(13,46,24,0.18)] backdrop-blur transition hover:bg-[#FFF8EF] md:hidden"
        >
          <Bell size={20} />
          {unreadNotificationCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C96A12] px-1 font-sans text-[10px] font-black text-white ring-2 ring-white">
              {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
            </span>
          ) : null}
        </button>
      ) : null}

      <nav className="fixed inset-x-3 bottom-3 z-50 rounded-[24px] bg-[#0D2E18] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_14px_34px_rgba(13,46,24,0.28)] md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {mobileTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              tab.kind === "section"
                ? activeSection === tab.id
                : isProfileOpen;

            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => {
                  if (tab.kind === "profile") {
                    if (!requireCustomerAccount("Login to open your profile.")) {
                      return;
                    }

                    setIsSidebarOpen(false);
                    setIsProfileOpen(true);
                    return;
                  }

                  handleSectionClick(tab.id);
                }}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[18px] font-sans text-[11px] font-bold transition ${
                  isActive
                    ? "bg-[#FFF0D8] text-[#0D2E18]"
                    : "text-[#FFF0D8]/76 hover:bg-[#0F441D]"
                }`}
              >
                {tab.kind === "profile" && profileAvatarUrl ? (
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 rounded-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${profileAvatarUrl})` }}
                  />
                ) : (
                  <Icon size={20} />
                )}
                <span>{tab.label}</span>
                {tab.kind === "section" &&
                tab.id === "orders" &&
                hasOrderAttention ? (
                  <span className="absolute right-4 top-2 h-2.5 w-2.5 animate-pulse rounded-full bg-[#C96A12] ring-2 ring-[#FFF0D8]" />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {isNotificationsOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0D2E18]/35 px-3 pb-0 pt-8 backdrop-blur-[2px] md:items-start md:justify-end md:p-5">
          <button
            type="button"
            aria-label="Close notifications"
            className="absolute inset-0 cursor-default"
            onClick={closeNotifications}
          />
          <section className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[30px] border border-[#DCCFB8] bg-[#FFF8EF] shadow-[0_-18px_40px_rgba(13,46,24,0.18)] md:mt-14 md:rounded-[26px] md:shadow-[0_18px_44px_rgba(13,46,24,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#DCCFB8] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0D2E18] text-[#FFF0DA]">
                  <Bell className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
                    Notifications
                  </p>
                  <h2 className="font-sans text-2xl font-black text-[#0D2E18]">
                    Updates
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={closeNotifications}
                aria-label="Close notifications"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3E6D1] text-[#123E26] transition hover:bg-[#E8D9BE]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {notifications.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[#D8C8A7] bg-white px-5 py-8 text-center">
                  <Bell className="mx-auto h-8 w-8 text-[#684B35]" />
                  <p className="mt-3 font-sans text-lg font-black text-[#0D2E18]">
                    No notifications yet
                  </p>
                  <p className="mx-auto mt-1 max-w-xs font-sans text-sm font-semibold leading-6 text-[#684B35]">
                    Order updates, receipt details, and feedback reminders will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => {
                    const isUnread = !readNotificationIds.includes(notification.id);

                    return (
                      <article
                        key={notification.id}
                        className={`rounded-[20px] border p-4 ${
                          isUnread
                            ? "border-[#C96A12]/40 bg-[#FFF0DA]"
                            : "border-[#E8D9BE] bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                              notification.kind === "feedback"
                                ? "bg-[#2D7A40]"
                                : notification.kind === "receipt"
                                ? "bg-[#0D2E18]"
                                : "bg-[#C96A12]"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[#F3E6D1] px-2.5 py-1 font-sans text-[10px] font-black uppercase tracking-[0.12em] text-[#684B35]">
                                {notification.typeLabel}
                              </span>
                              <time
                                dateTime={notification.timestamp}
                                className="font-sans text-xs font-bold text-[#8A755D]"
                              >
                                {formatNotificationTime(notification.timestamp)}
                              </time>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-sans text-base font-black text-[#0D2E18]">
                                {notification.title}
                              </h3>
                              {isUnread ? (
                                <span className="rounded-full bg-white px-2 py-0.5 font-sans text-[10px] font-black uppercase tracking-[0.12em] text-[#C96A12]">
                                  New
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 font-sans text-sm font-semibold leading-6 text-[#684B35]">
                              {notification.body}
                            </p>
                            {notification.receipt ? (
                              <div className="mt-3 rounded-[16px] border border-[#E8D9BE] bg-[#FFF8EF] p-3 font-sans text-xs font-semibold text-[#684B35]">
                                <div className="space-y-1.5">
                                  {notification.receipt.itemLines.map((line) => (
                                    <p key={line}>{line}</p>
                                  ))}
                                </div>
                                <div className="mt-3 space-y-1.5 border-t border-[#DCCFB8] pt-3">
                                  <div className="flex justify-between gap-3">
                                    <span>Items Total</span>
                                    <strong className="text-[#0D2E18]">
                                      {formatPrice(notification.receipt.itemsTotal)}
                                    </strong>
                                  </div>
                                  <div className="flex justify-between gap-3">
                                    <span>Delivery Fee</span>
                                    <strong className="text-[#0D2E18]">
                                      {formatPrice(notification.receipt.deliveryFee)}
                                    </strong>
                                  </div>
                                  <div className="flex justify-between gap-3 text-sm">
                                    <span>Total</span>
                                    <strong className="text-[#0D2E18]">
                                      {formatPrice(notification.receipt.grandTotal)}
                                    </strong>
                                  </div>
                                  <div className="flex justify-between gap-3">
                                    <span>Payment</span>
                                    <strong className="text-[#0D2E18]">
                                      {notification.receipt.paymentMethod}
                                    </strong>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleNotificationAction(notification)}
                              className="mt-3 rounded-full bg-[#0D2E18] px-4 py-2 font-sans text-xs font-black text-[#FFF0DA] transition hover:bg-[#0F441D]"
                            >
                              {notification.actionLabel}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {isFeedbackPromptOpen && selectedFeedbackItem ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0D2E18]/35 px-3 pb-0 pt-8 backdrop-blur-[2px] md:items-center md:p-6">
          <section className="max-h-[88vh] w-full max-w-xl overflow-hidden rounded-t-[30px] border border-[#DCCFB8] bg-[#FFF0DA] shadow-[0_-18px_40px_rgba(13,46,24,0.18)] md:rounded-[30px]">
            <div className="flex items-start justify-between gap-4 border-b border-[#DCCFB8] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E9F1E6] text-3xl">
                  {getFeedbackEmoji(selectedFeedbackItem.item_name)}
                </div>
                <div>
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
                    Quick Feedback
                  </p>
                  <h2 className="font-sans text-2xl font-bold leading-tight text-[#0D2E18]">
                    {selectedFeedbackItem.item_name}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={closeFeedbackPrompt}
                aria-label="Review later"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0D2E18] transition hover:bg-[#FFF8EF]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="max-h-[calc(88vh-5.5rem)] space-y-4 overflow-y-auto px-5 py-4">
              {visibleFeedbackItems.length > 1 ? (
                <label className="block">
                  <span className="font-sans text-sm font-bold text-[#684B35]">
                    Choose item
                  </span>
                  <select
                    value={selectedFeedbackItemId}
                    onChange={(event) =>
                      setSelectedFeedbackItemId(event.target.value)
                    }
                    className="mt-2 w-full rounded-[16px] border border-[#D8C8A7] bg-[#FFF8EF] px-4 py-3 font-sans text-sm outline-none"
                  >
                    {visibleFeedbackItems.map((item) => (
                      <option
                        key={item.order_item_id}
                        value={item.order_item_id}
                      >
                        {item.item_name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {(
                [
                  ["Taste Quality", tasteRating, setTasteRating],
                ] as const
              ).map(([label, value, setValue]) => (
                <div key={label} className="rounded-[20px] bg-[#FFF8EF] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-sans text-base font-black text-[#0D2E18]">
                      {label}
                    </p>
                    <span className="font-sans text-xs font-bold text-[#8A755D]">
                      {value > 0 ? `${value}/5` : "Select"}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between gap-1">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleRatingChange(setValue, score)}
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-3xl transition hover:bg-white hover:text-[#C96A12] ${
                          score <= value ? "text-[#C96A12]" : "text-[#D8C8A7]"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-[20px] bg-[#FFF8EF] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-sans text-base font-black text-[#0D2E18]">
                    Overall Satisfaction
                  </p>
                  <span className="font-sans text-xs font-bold text-[#8A755D]">
                    {overallRating > 0 ? `${overallRating}/5` : "Select"}
                  </span>
                </div>

                <div className="mt-3 flex justify-between gap-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => handleRatingChange(setOverallRating, score)}
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-3xl transition hover:bg-white hover:text-[#C96A12] ${
                        score <= overallRating
                          ? "text-[#C96A12]"
                          : "text-[#D8C8A7]"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] bg-[#FFF8EF] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-sans text-base font-black text-[#0D2E18]">
                    Drink Strength
                  </p>
                  <span className="font-sans text-xs font-bold text-[#8A755D]">
                    {strengthRating === 2
                      ? "Mild"
                      : strengthRating === 5
                      ? "Strong"
                      : "Balanced"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    ["Mild", 2],
                    ["Balanced", 3],
                    ["Strong", 5],
                  ].map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        handleRatingChange(setStrengthRating, Number(value))
                      }
                      className={`min-h-11 rounded-full border px-3 py-2 font-sans text-sm font-bold transition ${
                        strengthRating === value
                          ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0D8]"
                          : "border-[#D8C8A7] bg-white text-[#684B35]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={feedbackComment}
                onChange={(event) => setFeedbackComment(event.target.value)}
                placeholder="Optional note for KadaServe"
                className="min-h-20 w-full rounded-[18px] border border-[#D8C8A7] bg-[#FFF8EF] px-4 py-3 font-sans text-sm outline-none placeholder:text-[#A49175]"
              />

              {feedbackMessage ? (
                <p
                  className={`rounded-xl px-4 py-3 text-sm font-bold ${
                    feedbackMessage.toLowerCase().includes("success")
                      ? "bg-[#EEF8EC] text-[#2D7A40]"
                      : "bg-[#FFF1EC] text-[#9C543D]"
                  }`}
                >
                  {feedbackMessage}
                </p>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-[0.8fr_1.2fr]">
                <button
                  type="button"
                  onClick={handleFeedbackMaybeLater}
                  disabled={isSubmittingFeedback}
                  className="rounded-[18px] border border-[#D8C8A7] bg-white px-5 py-4 font-sans text-base font-black text-[#684B35] transition hover:bg-[#FFF8EF] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Maybe Later
                </button>
                <button
                  type="button"
                  onClick={handleSubmitFeedback}
                  disabled={!canSubmitFeedback}
                  className="flex items-center justify-center gap-2 rounded-[18px] bg-[#0D2E18] px-5 py-4 font-sans text-base font-black text-white transition hover:bg-[#0F441D] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isSubmittingFeedback ? (
                    <LoadingSpinner label="Submitting feedback" />
                  ) : null}
                  {isSubmittingFeedback ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {selectedMenuItem ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0D2E18]/45 px-3 pb-0 pt-10 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-t-[30px] border border-[#E5D6BB] bg-[#FFF8EF] shadow-[0_-18px_40px_rgba(13,46,24,0.18)] sm:rounded-[30px]">
            <div className="flex items-start justify-between gap-4 border-b border-[#E8D9BE] px-5 py-4 sm:px-6">
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8A755D]">
                  Customize Item
                </p>
                <h2 className="mt-1 font-sans text-3xl font-semibold leading-tight text-[#123E26] sm:text-4xl">
                  {selectedMenuItem.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeCustomizeModal}
                aria-label="Close customization"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3E6D1] text-[#123E26] transition hover:bg-[#E8D9BE]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-5.5rem)] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex aspect-square h-44 w-44 items-center justify-center overflow-hidden rounded-full bg-[#E7F1E6] text-6xl sm:h-52 sm:w-52">
                      {getMenuImage(selectedMenuItem) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getMenuImage(selectedMenuItem) ?? ""}
                          alt={selectedMenuItem.name}
                          className="aspect-square h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        getEmoji(selectedMenuItem)
                      )}
                    </div>

                    <div className="flex-1">
                      <span className="inline-flex rounded-full bg-white/80 px-3 py-1 font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#2D7A40] shadow-sm">
                        Available
                      </span>
                      <p className="mt-3 font-sans text-sm leading-6 text-[#6F634E]">
                        {selectedMenuItem.description ??
                          "Freshly prepared for pickup or delivery."}
                      </p>
                      <p className="mt-4 font-sans text-3xl font-black text-[#765531]">
                        {formatPrice(selectedMenuItem.base_price)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-5">
                    {selectedMenuItem.has_temp_option !== false ? (
                      <div>
                        <h3 className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#123E26]">
                          Temperature
                        </h3>
                        <div className="mt-3 grid rounded-full border border-[#D8C8A7] bg-white p-1 sm:max-w-xs sm:grid-cols-2">
                          {temperatures.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setTemperature(item.value)}
                              className={`rounded-full px-4 py-2.5 font-sans text-sm font-bold transition ${
                                temperature === item.value
                                  ? "bg-[#123E26] text-[#FFF0D8]"
                                  : "text-[#684B35] hover:bg-[#F5EAD7]"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedMenuItem.has_sugar_level !== false ? (
                      <div>
                        <h3 className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#123E26]">
                          Sugar Level
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {sugarLevels.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setSugarLevel(item.value)}
                              className={`rounded-full border px-4 py-2 font-sans text-sm font-bold transition ${
                                sugarLevel === item.value
                                  ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                                  : "border-[#D8C8A7] bg-white text-[#684B35]"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedMenuItem.has_ice_level !== false ? (
                      <div>
                        <h3 className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#123E26]">
                          Ice Level
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {iceLevels.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setIceLevel(item.value)}
                              className={`rounded-full border px-4 py-2 font-sans text-sm font-bold transition ${
                                iceLevel === item.value
                                  ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                                  : "border-[#D8C8A7] bg-white text-[#684B35]"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedMenuItem.has_size_option !== false ? (
                      <div>
                        <h3 className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#123E26]">
                          Size
                        </h3>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          {sizes.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setSize(item.value)}
                              className={`rounded-[18px] border p-4 text-left font-sans transition ${
                                size === item.value
                                  ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                                  : "border-[#D8C8A7] bg-white text-[#684B35]"
                              }`}
                            >
                              <p className="font-black">{item.label}</p>
                              <p className="mt-1 text-xs">
                                {item.price > 0
                                  ? `+${formatPrice(item.price)}`
                                  : "No extra charge"}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <aside className="rounded-[24px] border border-[#E1D0B2] bg-white/72 p-5">
                  <div className="mt-5">
                    <p className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                      Quantity
                    </p>
                    <div className="mt-2 inline-flex items-center rounded-full border border-[#D8C8A7] bg-[#FFF8EF] p-1">
                      <button
                        type="button"
                        onClick={() =>
                          setQuantity((current) => Math.max(1, current - 1))
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#123E26]"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="min-w-12 text-center font-sans text-lg font-black">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((current) => current + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#123E26]"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                      Add-ons
                    </p>
                    <div className="mt-3 grid gap-2">
                      {addons.map((item) => {
                        const selected = selectedAddons.includes(item.value);

                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => toggleAddon(item.value)}
                            className={`flex items-center justify-between rounded-[16px] border px-4 py-3 font-sans text-sm font-bold transition ${
                              selected
                                ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                                : "border-[#D8C8A7] bg-white text-[#684B35]"
                            }`}
                          >
                            <span>{item.label}</span>
                            <span>+{formatPrice(item.price)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {customizeMessage ? (
                    <p className="mt-4 rounded-xl bg-[#E7F4EA] px-4 py-3 font-sans text-sm font-bold text-[#0F7A40]">
                      {customizeMessage}
                    </p>
                  ) : null}

                  {selectedMenuFeedback ? (
                    <div className="mt-5 rounded-[20px] border border-[#D8C8A7] bg-[#FFF8EF] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-sans text-xs font-black uppercase tracking-[0.14em] text-[#8A755D]">
                            Customer Rating
                          </p>
                          <p className="mt-1 font-sans text-xs font-semibold leading-5 text-[#684B35]">
                            Anonymous feedback from completed orders.
                          </p>
                        </div>
                        <div className="shrink-0 rounded-full bg-[#FFE9A8] px-3 py-1 font-sans text-xs font-black text-[#684B35]">
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            {formatRating(selectedMenuFeedback.averageRating)}
                          </span>
                        </div>
                      </div>

                      <p className="mt-3 font-sans text-xs font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                        {formatRatingCount(selectedMenuFeedback.ratingCount)}
                      </p>

                      {selectedMenuFeedback.comments.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {selectedMenuFeedback.comments.map((comment) => (
                            <article
                              key={`${comment.createdAt}-${comment.comment}`}
                              className="rounded-[14px] bg-white px-3 py-2 font-sans"
                            >
                              <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#8A755D]">
                                <span>Anonymous</span>
                                <span className="inline-flex items-center gap-1 text-[#684B35]">
                                  <Star className="h-3 w-3 fill-current" />
                                  {formatRating(comment.rating)}
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-semibold leading-5 text-[#0D2E18]">
                                {comment.comment}
                              </p>
                              <p className="mt-1 text-[11px] font-semibold text-[#8A755D]">
                                {formatDateTime(comment.createdAt)}
                              </p>
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {selectedNutrition ? (
                    <div className="mt-5 rounded-[20px] border border-[#D8C8A7] bg-[#FFF8EF] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-sans text-xs font-black uppercase tracking-[0.14em] text-[#8A755D]">
                            Nutrition facts
                          </p>
                          <p className="mt-1 font-sans text-xs font-semibold leading-5 text-[#684B35]">
                            Recipe-calculated from KadaServe recipes and supplier labels.
                          </p>
                        </div>
                        <span className="rounded-full bg-[#E9F5E7] px-3 py-1 font-sans text-xs font-black text-[#2D7A40]">
                          {selectedNutrition.servingSizeMl} ml
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {nutritionMetricLabels.map((metric) => (
                          <div
                            key={metric.key}
                            className="rounded-[14px] bg-white px-3 py-2 font-sans"
                          >
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                              {metric.label}
                            </p>
                            <p className="mt-0.5 text-base font-black text-[#0D2E18]">
                              {formatNutritionMetric(
                                metric.key,
                                selectedNutrition[metric.key]
                              )}
                              {metric.unit ? ` ${metric.unit}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleAddCustomizedItem}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#123E26] px-5 py-4 font-sans text-base font-black text-white shadow-lg shadow-[#123E26]/20 transition hover:-translate-y-0.5 hover:bg-[#0D2E18]"
                  >
                    <ShoppingCart size={18} />
                    Add to Cart — {formatPrice(customizeTotal)}
                  </button>
                </aside>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {trackingOrder ? (
        <div className="fixed inset-0 z-[58] flex items-end justify-center bg-[#0D2E18]/35 px-0 backdrop-blur-md md:items-center md:px-5">
          <button
            type="button"
            aria-label="Close tracking modal"
            className="absolute inset-0 cursor-default"
            onClick={closeTrackingModal}
          />

          <section className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[30px] border border-[#DCCFB8] bg-[#FFF0DA] shadow-[0_-18px_40px_rgba(13,46,24,0.22)] md:max-w-3xl md:rounded-[30px] md:shadow-[0_24px_60px_rgba(13,46,24,0.22)]">
            <div
              className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[#DCCFB8] md:hidden"
              onTouchStart={(event) => {
                trackingTouchStartYRef.current = event.touches[0]?.clientY ?? null;
              }}
              onTouchEnd={(event) => {
                const startY = trackingTouchStartYRef.current;
                const endY = event.changedTouches[0]?.clientY ?? null;

                if (startY !== null && endY !== null && endY - startY > 70) {
                  closeTrackingModal();
                }

                trackingTouchStartYRef.current = null;
              }}
            />

            <div className="flex items-start justify-between gap-4 border-b border-[#DCCFB8] px-5 py-4 md:px-6 md:py-5">
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
                  Track Order
                </p>
                <h2 className="mt-1 font-sans text-3xl font-bold leading-tight text-[#0D2E18] md:text-4xl">
                  {formatOrderCode(trackingOrder.id)}
                </h2>
                <p className="mt-1 font-sans text-sm text-[#6F634E]">
                  {formatOrderType(trackingOrder.order_type)} order placed{" "}
                  {formatDateTime(trackingOrder.ordered_at)}
                </p>
                {currentOrders.length > 1 ? (
                  <label className="mt-3 block max-w-sm">
                    <span className="sr-only">Switch tracked order</span>
                    <div className="relative">
                      <select
                        value={trackingOrder.id}
                        onChange={(event) => handleCurrentOrderChange(event.target.value)}
                        className="min-h-11 w-full appearance-none rounded-full border border-[#DCCFB8] bg-white px-4 pr-10 font-sans text-sm font-bold text-[#0D2E18] outline-none transition focus:border-[#0D2E18] focus:ring-2 focus:ring-[#0D2E18]/15"
                      >
                        {currentOrders.map((order) => (
                          <option key={order.id} value={order.id}>
                            {formatOrderCode(order.id)} - {formatStatus(order.status)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={17}
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#684B35]"
                      />
                    </div>
                  </label>
                ) : null}
              </div>

              <button
                type="button"
                onClick={closeTrackingModal}
                aria-label="Close order tracking"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#DCCFB8] bg-[#FFF8EF] text-[#0D2E18] transition hover:bg-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
              <div className="rounded-[24px] border border-[#DCCFB8] bg-[#FFF8EF] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                      Order Status
                    </p>
                    <p className="mt-1 font-sans text-2xl font-black text-[#0D2E18]">
                      {formatStatus(trackingOrder.status)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#F8EBCF] px-3 py-1.5 font-sans text-xs font-bold text-[#684B35]">
                    {formatPrice(trackingOrder.total_amount)}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-5 gap-2">
                  {getTrackingSteps(trackingOrder.order_type).map(
                    (step, index) => {
                      const isCompleted = index < trackingOrderStep;
                      const isCurrent = index === trackingOrderStep;
                      const isReached = isCompleted || isCurrent;

                      return (
                        <div key={step} className="min-w-0">
                          <div className="flex items-center">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-black transition ${
                                isCurrent
                                  ? "animate-pulse border-[#684B35] bg-[#684B35] text-[#FFF0DA]"
                                  : isCompleted
                                  ? "border-[#0F441D] bg-[#0F441D] text-[#FFF0DA]"
                                  : "border-[#DCCFB8] bg-white text-[#9A856C]"
                              }`}
                            >
                              {index + 1}
                            </span>
                            {index < 4 ? (
                              <span
                                className={`h-1 flex-1 rounded-full ${
                                  isCompleted ? "bg-[#0F441D]" : "bg-[#DCCFB8]"
                                }`}
                              />
                            ) : null}
                          </div>
                          <p
                            className={`mt-2 line-clamp-2 font-sans text-[10px] font-bold leading-tight md:text-xs ${
                              isReached ? "text-[#0D2E18]" : "text-[#9A856C]"
                            }`}
                          >
                            {step}
                          </p>
                          {isCompleted ? (
                            <p className="mt-1 hidden font-sans text-[10px] text-[#8A755D] md:block">
                              Updated
                            </p>
                          ) : null}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-[24px] border border-[#DCCFB8] bg-white p-4">
                  <h3 className="font-sans text-2xl font-bold text-[#0D2E18]">
                    Order Details
                  </h3>

                  <div className="mt-3 space-y-3">
                    {trackingOrderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-[18px] bg-[#FFF8EF] p-2.5"
                      >
                        <div className="flex aspect-square h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E7F1E6] text-2xl">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="aspect-square h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            "☕"
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 font-sans text-base font-black text-[#0D2E18]">
                            {item.name}
                          </p>
                          <p className="mt-1 font-sans text-sm text-[#6F634E]">
                            Quantity × {item.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[24px] border border-[#DCCFB8] bg-white p-4">
                  <div className="rounded-[18px] bg-[#E9F5E7] p-3 font-sans text-sm text-[#2D7A40]">
                    Current step:{" "}
                    <span className="font-black">
                      {formatStatus(trackingOrder.status)}
                    </span>
                  </div>

                  <div
                    className={`mt-3 rounded-[18px] p-3 font-sans text-sm font-semibold ${
                      trackingOrder.payment_status === "paid"
                        ? "bg-[#E9F5E7] text-[#2D7A40]"
                      : "bg-[#FFF0DA] text-[#684B35]"
                    }`}
                  >
                    Payment status:{" "}
                    <span className="font-black">
                      {trackingOrder.payment_status === "paid"
                        ? "Paid"
                        : "Unpaid"}
                    </span>
                  </div>

                  {trackingQrPhPayment ? (
                    <div className="mt-3 rounded-[18px] border border-[#DCCFB8] bg-[#FFF8EF] p-3">
                      <p className="font-sans text-sm font-black text-[#0D2E18]">
                        Awaiting QR Ph payment
                      </p>
                      <p className="mt-1 font-sans text-xs font-semibold leading-5 text-[#684B35]">
                        Reopen the PayMongo QR to complete this order.
                      </p>
                      <button
                        type="button"
                        onClick={openTrackedQrPhPayment}
                        className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0D2E18] px-4 font-sans text-sm font-bold text-[#FFF0DA] transition hover:bg-[#0F441D]"
                      >
                        Show QR Code
                      </button>
                    </div>
                  ) : null}

                  {isTrackingQrPhExpired ? (
                    <div className="mt-3 rounded-[18px] border border-[#F2C8BD] bg-[#FFF1EC] p-3 font-sans text-sm font-semibold text-[#9C543D]">
                      QR expired. Please place a new order.
                    </div>
                  ) : null}

                  {isTrackingOnlinePaymentPending &&
                  !trackingQrPhPayment &&
                  !isTrackingQrPhExpired ? (
                    <div className="mt-3 rounded-[18px] border border-[#F2C8BD] bg-[#FFF1EC] p-3 font-sans text-sm font-semibold leading-6 text-[#9C543D]">
                      QR code is not available for this order. Cancel this unpaid
                      order, then place a new online order to generate a new QR.
                    </div>
                  ) : null}

                  {canCancelTrackingOrder ? (
                    <div className="mt-3 rounded-[18px] border border-[#F2C8BD] bg-[#FFF1EC] p-3">
                      {trackingActionMessage ? (
                        <p className="mt-2 font-sans text-xs font-semibold text-[#9C543D]">
                          {trackingActionMessage}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleCancelTrackedOrder}
                        disabled={isCancellingTrackedOrder}
                        className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#9C543D] px-4 font-sans text-sm font-bold text-[#FFF0D8] transition hover:bg-[#8A4632] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCancellingTrackedOrder
                          ? "Cancelling..."
                          : "Cancel Order"}
                      </button>
                    </div>
                  ) : null}

                  {!canCancelTrackingOrder && cancelUnavailableMessage ? (
                    <div className="mt-3 rounded-[18px] bg-[#FFF8EF] p-3 font-sans text-sm font-semibold text-[#684B35]">
                      {cancelUnavailableMessage}
                    </div>
                  ) : null}

                  {trackingOrder.payment_status === "paid" ||
                  ["out_for_delivery", "delivered"].includes(
                    trackingOrder.status
                  ) ? (
                    <div className="mt-3 rounded-[18px] bg-[#FFF0DA] p-3 font-sans text-sm font-semibold text-[#684B35]">
                      Check KadaServe notifications for order updates and receipt details.
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {qrPhPayment ? (
        <div className="fixed inset-0 z-[72] flex items-end justify-center bg-[#0D2E18]/55 px-3 backdrop-blur-sm md:items-center md:p-6">
          <section className="w-full max-w-md rounded-t-[28px] border border-[#D8C8A7] bg-white p-5 shadow-[0_-18px_42px_rgba(13,46,24,0.20)] md:rounded-[28px]">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#D8C8A7] md:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
                  PayMongo QR Ph
                </p>
                <h2 className="mt-1 font-sans text-2xl font-black text-[#0D2E18]">
                  Scan to pay {formatPrice(qrPhPayment.totalAmount)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setQrPhPayment(null)}
                aria-label="Close QR Ph payment"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D8C8A7] bg-[#FFF8EF] text-[#684B35]"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 rounded-[22px] border border-[#D8C8A7] bg-[#FFF8EF] p-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrPhPayment.qrCodeImageUrl}
                alt="PayMongo QR Ph payment code"
                className="mx-auto aspect-square w-full max-w-[280px] rounded-[18px] bg-white object-contain p-3"
              />
              <p className="mt-3 font-sans text-sm font-black text-[#0D2E18]">
                {formatOrderCode(qrPhPayment.orderId)}
              </p>
              <p className="mt-1 font-sans text-xs font-semibold leading-5 text-[#8A755D]">
                Pay with any QR Ph-supported wallet or banking app. This QR
                expires in about {qrPhMinutesLeft} minute
                {qrPhMinutesLeft === 1 ? "" : "s"}.
              </p>
            </div>

            <div className="mt-5 rounded-[16px] bg-[#E7F4EA] px-4 py-3 font-sans text-sm font-semibold leading-6 text-[#0F441D]">
              KadaServe will close this QR and open tracking after PayMongo
              confirms payment.
            </div>

            <button
              type="button"
              onClick={() => setQrPhPayment(null)}
              className="mt-4 w-full rounded-[18px] bg-[#0D2E18] px-5 py-4 font-sans text-base font-black text-[#FFF0DA] transition hover:bg-[#0F441D]"
            >
              Back to Order Tracker
            </button>
          </section>
        </div>
      ) : null}

      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ${
          isSidebarOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[85vw] max-w-[300px] flex-col rounded-r-[24px] bg-[#0D2E18] text-white shadow-[12px_0_30px_rgba(0,0,0,0.16)] transition-transform duration-300 ease-out sm:w-[280px] ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-7 pb-5 pt-10">
          <h2 className="font-sans text-[2.1rem] font-bold leading-none tracking-[-0.04em] text-[#FFF0D8]">
            KadaServe
          </h2>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close customer menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#FFF0D8]/10 bg-[#0F441D]/80 text-[#FFF0D8] transition hover:bg-[#0F441D]"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="mt-3 flex-1 space-y-5 px-4">
          <div className="space-y-2">
          {sections
            .filter((section) => section.id !== "feedback")
            .map(({ id, icon: Icon, label }) => {
            const isActive = activeSection === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSectionClick(id)}
                className={`flex w-full items-center gap-3 rounded-[14px] px-4 py-3.5 text-left font-sans text-base font-semibold transition ${
                  isActive
                    ? "bg-[#FFF0D8] text-[#123E26] shadow-[0_10px_18px_rgba(0,0,0,0.12)]"
                    : "text-white/80 hover:bg-[#0F441D]/45 hover:text-white"
                }`}
              >
                <Icon size={21} className="shrink-0" />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span>{label}</span>
                  {id === "orders" && hasOrderAttention ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-[#684B35] ring-2 ring-[#FFF0D8]" />
                  ) : null}
                </span>
              </button>
            );
          })}
          </div>

          <div className="space-y-2 border-t border-[#FFF0D8]/10 pt-5">
            {sections
              .filter((section) => section.id === "feedback")
              .map(({ id, icon: Icon, label }) => {
                const isActive = activeSection === id;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSectionClick(id)}
                    className={`flex w-full items-center gap-3 rounded-[14px] px-4 py-3.5 text-left font-sans text-base font-semibold transition ${
                      isActive
                        ? "bg-[#FFF0D8] text-[#123E26] shadow-[0_10px_18px_rgba(0,0,0,0.12)]"
                        : "text-white/80 hover:bg-[#0F441D]/45 hover:text-white"
                    }`}
                  >
                    <Icon size={21} className="shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
          </div>
        </nav>

      </aside>

      <div
        className={`fixed inset-0 z-[55] bg-[#0D2E18]/35 backdrop-blur-[2px] transition-opacity duration-300 ${
          isProfileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={closeProfileDrawer}
      />

      <aside
        className={`fixed bottom-0 left-0 right-0 z-[60] flex max-h-[92vh] w-full flex-col rounded-t-[30px] bg-[#FFF8EF] shadow-[0_-18px_40px_rgba(13,46,24,0.20)] transition-transform duration-300 ease-out md:left-auto md:bottom-auto md:right-0 md:top-0 md:h-full md:max-h-none md:max-w-[420px] md:rounded-none md:shadow-[-18px_0_40px_rgba(13,46,24,0.20)] ${
          isProfileOpen
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full"
        }`}
      >
        <div className="bg-[linear-gradient(135deg,_#0F441D_0%,_#0D2E18_62%,_#684B35_100%)] px-5 pb-5 pt-6 text-[#FFF0D8]">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#FFF0D8]/45 md:hidden" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="mt-1.5 font-sans text-3xl font-bold leading-tight">
                {isProfileSettingsOpen ? "Settings" : displayProfileName}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsProfileSettingsOpen((value) => !value);
                  setProfileSettingsMessage("");
                }}
                aria-label="Open profile settings"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#FFF0D8]/12 text-[#FFF0D8] transition hover:bg-[#0F441D] ${
                  isProfileSettingsOpen ? "bg-[#FFF0D8]/18" : "bg-[#0F441D]/70"
                }`}
              >
                <Settings size={19} />
              </button>

              <button
                type="button"
                onClick={closeProfileDrawer}
                aria-label="Close profile"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#FFF0D8]/12 bg-[#0F441D]/70 text-[#FFF0D8] transition hover:bg-[#0F441D]"
              >
                <X size={19} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-[#FFF0D8] p-3 text-[#0D2E18]">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[#684B35] bg-[#0D2E18] font-sans text-lg font-black text-[#FFF0D8]">
              {profileAvatarUrl ? (
                <span
                  aria-hidden="true"
                  className="h-full w-full rounded-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${profileAvatarUrl})` }}
                />
              ) : (
                profileInitials
              )}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                aria-label="Edit profile picture"
                title="Edit profile picture"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-[#FFF0D8] bg-[#0F441D] text-[#FFF0D8] shadow-sm transition hover:bg-[#123E26] disabled:cursor-wait disabled:opacity-70"
              >
                <Camera size={14} />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="min-w-0 flex-1 font-sans">
              <p className="truncate text-sm font-black text-[#0D2E18]">
                {displayProfileName}
              </p>
              {profileEmail ? (
                <p className="mt-0.5 truncate text-xs font-semibold text-[#684B35]">
                  {profileEmail}
                </p>
              ) : null}
              {isUploadingAvatar || avatarMessage ? (
                <p className="mt-1.5 font-sans text-[11px] leading-4 text-[#684B35]">
                  {isUploadingAvatar ? "Uploading your profile picture..." : avatarMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {isProfileSettingsOpen ? (
            <>
              <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-3.5">
                <div className="flex items-center gap-2">
                  <UserPen className="h-4 w-4 text-[#684B35]" />
                  <h3 className="font-sans text-xl font-bold text-[#0D2E18]">
                    Edit Profile
                  </h3>
                </div>

                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                      Full Name
                    </span>
                    <input
                      value={profileFullNameDraft}
                      onChange={(event) =>
                        setProfileFullNameDraft(event.target.value)
                      }
                      className="mt-1 w-full rounded-[14px] border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-2.5 font-sans text-sm text-[#0D2E18] outline-none focus:border-[#0F441D]"
                    />
                    {!isValidProfileName(normalizedProfileName) ? (
                      <span className="mt-1 block font-sans text-xs text-[#A14E32]">
                        Use letters, spaces, hyphen, apostrophe, or dot only.
                      </span>
                    ) : null}
                  </label>

                  <div className="block">
                    <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                      Phone
                    </span>
                    {!isProfilePhoneEditing ? (
                      <div className="mt-1 flex items-center justify-between gap-2 rounded-[14px] border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-2.5">
                        <span className="min-w-0 truncate font-sans text-sm font-bold text-[#0D2E18]">
                          {profilePhoneDraft || "No number saved"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsProfilePhoneEditing(true)}
                          className="rounded-full border border-[#DCCFB8] bg-white px-3 py-1.5 font-sans text-xs font-black text-[#684B35] transition hover:bg-[#FFF0DA]"
                        >
                          Edit
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 space-y-2">
                        <input
                          value={profilePhoneDraft}
                          onChange={(event) =>
                            setProfilePhoneDraft(formatProfilePhone(event.target.value))
                          }
                          inputMode="tel"
                          placeholder="0917-123-4567"
                          className="w-full rounded-[14px] border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-2.5 font-sans text-sm text-[#0D2E18] outline-none focus:border-[#0F441D]"
                        />
                        {!isValidOptionalPhone(profilePhoneDraft) ? (
                          <span className="block font-sans text-xs text-[#A14E32]">
                            Use a valid Philippine mobile number.
                          </span>
                        ) : null}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handleSaveProfileSettings}
                            disabled={!canSaveProfileSettings}
                            className="rounded-[12px] bg-[#0D2E18] px-3 py-2 font-sans text-xs font-black text-[#FFF0D8] transition hover:bg-[#0F441D] disabled:cursor-not-allowed disabled:bg-[#8AA083]"
                          >
                            Save Number
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProfilePhoneDraft(
                                formatProfilePhone(customerProfile?.phone ?? "")
                              );
                              setIsProfilePhoneEditing(false);
                            }}
                            className="rounded-[12px] border border-[#DCCFB8] px-3 py-2 font-sans text-xs font-black text-[#684B35] transition hover:bg-[#FFF0DA]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </section>

              <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-3.5">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-[#684B35]" />
                  <h3 className="font-sans text-xl font-bold text-[#0D2E18]">
                    Language
                  </h3>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["English", "Filipino"] as const).map((language) => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => setProfileLanguage(language)}
                      className={`rounded-[14px] border px-3 py-2.5 font-sans text-sm font-bold transition ${
                        profileLanguage === language
                          ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0D8]"
                          : "border-[#DCCFB8] bg-[#FFF8EF] text-[#684B35]"
                      }`}
                    >
                      {language}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-3.5">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-[#684B35]" />
                  <h3 className="font-sans text-xl font-bold text-[#0D2E18]">
                    FAQs
                  </h3>
                </div>

                <div className="mt-3 space-y-2">
                  {[
                    {
                      id: "order" as const,
                      title: "How to order?",
                      answer:
                        "Choose an item, customize it, add it to cart, then checkout for pickup or delivery.",
                    },
                    {
                      id: "delivery" as const,
                      title: "Delivery areas",
                      answer:
                        "Delivery is available near Kada Cafe PH service areas. Confirm your address before checkout.",
                    },
                  ].map((faq) => (
                    <div
                      key={faq.id}
                      className="rounded-[14px] border border-[#E8D9BE] bg-[#FFF8EF]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenProfileFaq(
                            openProfileFaq === faq.id ? null : faq.id
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left font-sans text-sm font-bold text-[#0D2E18]"
                      >
                        {faq.title}
                        <ChevronDown
                          size={16}
                          className={`transition ${
                            openProfileFaq === faq.id ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {openProfileFaq === faq.id ? (
                        <p className="px-3 pb-3 font-sans text-xs leading-5 text-[#6F634E]">
                          {faq.answer}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              {profileSettingsMessage ? (
                <p className="rounded-[16px] bg-[#E9F5E7] px-3.5 py-2.5 font-sans text-xs leading-5 text-[#2D7A40]">
                  {profileSettingsMessage}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-3.5">
                <h3 className="font-sans text-xl font-bold text-[#0D2E18]">
                  Taste Profile
                </h3>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ["Latte", tasteProfile.latte],
                    ["Non-Coffee", tasteProfile.nonCoffee],
                    ["Pastries", tasteProfile.pastries],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[14px] bg-[#F8EBCF] px-2.5 py-2.5 text-center"
                    >
                      <p className="font-sans text-lg font-black text-[#0D2E18]">
                        {value}%
                      </p>
                      <p className="font-sans text-[11px] font-bold text-[#684B35]">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {flavorBadges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-[#E9F5E7] px-2.5 py-1 font-sans text-xs font-bold text-[#2D7A40]"
                    >
                      {badge}
                    </span>
                  ))}
                </div>

                <div className="mt-3 rounded-[16px] bg-[#0D2E18] px-3.5 py-2.5 text-[#FFF0D8]">
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#DCCFB8]">
                    Hall of Fame
                  </p>
                  <p className="mt-1 font-sans text-xl font-bold">
                    {monthlyFavorite}
                  </p>
                </div>
              </section>

              <section className="rounded-[18px] border border-[#DCCFB8] bg-white p-3.5">
                <div className="flex items-center justify-between gap-3">
              <h3 className="font-sans text-xl font-bold text-[#0D2E18]">
                Recent Orders
              </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection("orders");
                      closeProfileDrawer();
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-[#F8EBCF] px-3 py-1.5 font-sans text-xs font-bold text-[#684B35]"
                  >
                    <History className="h-4 w-4" />
                    View All
                  </button>
                </div>

            <div className="mt-3 space-y-2.5">
              {visibleRecentOrders.length === 0 ? (
                <p className="font-sans text-sm text-[#6F634E]">
                  Your recent orders will appear here.
                </p>
              ) : (
                visibleRecentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-[14px] border border-[#E8D9BE] bg-[#FFF8EF] p-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-sans text-sm font-black text-[#0D2E18]">
                          {formatOrderCode(order.id)}
                        </p>
                        <p className="mt-1 line-clamp-1 font-sans text-xs text-[#6F634E]">
                          {formatOrderItemSummary(
                            order.order_items
                              .map((item) => item.menu_items?.name)
                              .filter(Boolean) as string[]
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReorder(order)}
                        className="rounded-full bg-[#0D2E18] px-3 py-1.5 font-sans text-xs font-bold text-white"
                      >
                        Reorder
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
              </section>

              <p className="flex gap-2 rounded-[16px] bg-[#E9F5E7] px-3.5 py-2.5 font-sans text-xs leading-5 text-[#2D7A40]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                KadaServe uses your order history only to improve
                recommendations and make ordering faster. We never share your
                personal data.
              </p>
            </>
          )}
        </div>

        {isProfileSettingsOpen ? (
          <div className="space-y-2 border-t border-[#DCCFB8] bg-[#FFF8EF] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={handleSaveProfileSettings}
              disabled={!canSaveProfileSettings}
              className="w-full rounded-[14px] bg-[#0D2E18] px-4 py-2.5 font-sans text-sm font-bold text-[#FFF0D8] transition hover:bg-[#0F441D] disabled:cursor-not-allowed disabled:bg-[#8AA083]"
            >
              {isSavingProfile ? "Saving..." : "Save Changes"}
            </button>

          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            disabled={isLoggingOut}
            className="w-full rounded-[14px] border border-[#E0A38F] bg-[#FFF1EC] px-4 py-2.5 font-sans text-sm font-bold text-[#9C543D] transition hover:bg-[#FBE4DC] disabled:opacity-60"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
          </div>
        ) : null}
      </aside>

      {isCartTrayOpen ? (
        <section
          className={`fixed bottom-24 left-4 right-4 z-50 rounded-[22px] border border-white/70 bg-white/95 p-2.5 text-[#0D2E18] shadow-[0_14px_30px_rgba(13,46,24,0.22)] backdrop-blur transition duration-300 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[360px] ${
            isCartPulseActive ? "scale-[1.03] ring-4 ring-[#F8EBCF]" : ""
          }`}
        >
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsCartTrayOpen(false)}
              aria-label="Collapse cart"
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#0D2E18] text-[#FFF0DA] shadow-[0_8px_16px_rgba(13,46,24,0.18)] ${
                isCartPulseActive ? "animate-bounce" : ""
              }`}
            >
              <ShoppingCart size={20} />
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#EF3B2D] px-1 font-sans text-[11px] font-black text-white">
                {cartCount}
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                {latestCartItem ? latestCartItem.name : "Your cart"}
              </p>
              <p className="font-sans text-2xl font-black leading-tight text-[#0D2E18]">
                {formatPrice(cartTotal)}
              </p>
              <p className="truncate font-sans text-[11px] font-semibold text-[#684B35]">
                {cartCount > 0
                  ? `${cartCount} item${cartCount === 1 ? "" : "s"} ready`
                  : "Add drinks to enable checkout"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!requireCustomerAccount("Login to checkout.")) {
                  return;
                }

                router.push("/customer/cart");
              }}
              disabled={cartCount === 0}
              className="min-h-12 shrink-0 rounded-[18px] bg-[#0D2E18] px-4 font-sans text-sm font-black text-[#FFF0DA] transition hover:bg-[#123E26] disabled:cursor-not-allowed disabled:bg-[#D8D8D8] disabled:text-white"
            >
              Checkout
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              router.push("/login");
              return;
            }

            setIsCartTrayOpen(true);
          }}
          aria-label="Open cart"
          className={`fixed bottom-24 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[#123E26] text-white shadow-[0_12px_24px_rgba(11,46,24,0.28)] transition duration-300 sm:bottom-6 sm:right-6 ${
            isCartPulseActive ? "animate-bounce ring-4 ring-[#F8EBCF]" : ""
          }`}
        >
          <ShoppingCart size={25} />
          {cartCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#EF3B2D] px-1 text-[11px] font-bold text-white">
              {cartCount}
            </span>
          ) : null}
        </button>
      )}

      {isLogoutConfirmOpen ? (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-[#0D2E18]/45 px-3 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="w-full max-w-sm rounded-t-[24px] border border-[#DCCFB8] bg-white p-5 shadow-[0_-18px_40px_rgba(13,46,24,0.18)] sm:rounded-[24px]">
            <h2 className="font-sans text-xl font-black text-[#0D2E18]">
              Log out?
            </h2>
            <p className="mt-2 font-sans text-sm font-semibold leading-6 text-[#684B35]">
              Are you sure you want to log out?
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-[14px] bg-[#9C543D] px-4 py-3 font-sans text-sm font-black text-[#FFF0D8] transition hover:bg-[#8A4632] disabled:opacity-60"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                disabled={isLoggingOut}
                className="rounded-[14px] border border-[#DCCFB8] px-4 py-3 font-sans text-sm font-black text-[#684B35] transition hover:bg-[#FFF0DA] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

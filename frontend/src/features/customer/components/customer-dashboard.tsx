"use client";

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  BadgePercent,
  Camera,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  CupSoda,
  Gift,
  HelpCircle,
  History,
  House,
  Languages,
  LockKeyhole,
  PartyPopper,
  QrCode,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Star,
  ShieldCheck,
  Ticket,
  X,
  Minus,
  Plus,
  UserPen,
  UserRound,
} from "lucide-react";
import { useCart } from "@/features/customer/providers/cart-provider";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { CustomerMenuItem } from "@/types/menu";
import type { CustomerOrder } from "@/types/orders";
import type { FeedbackItem } from "@/types/feedback";

type Section = "home" | "menu" | "orders" | "rewards" | "feedback";
type ProfileFaq = "order" | "delivery";
type RewardsTab = "missions" | "redeem" | "wallet";
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
  preferenceSignals?: Array<{
    menuItemId: string;
    overallRating: number;
  }>;
  initialSection?: Section;
  customerProfile?: {
    fullName: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    satisfactionAverage: number | null;
  };
  isAuthenticated?: boolean;
};

type RewardVoucher = {
  code: string;
  title: string;
  expiresAt: string;
  value: string;
};


const sections: Array<{
  id: Section;
  label: string;
  icon: typeof CupSoda;
}> = [
  { id: "home", label: "Home", icon: House },
  { id: "menu", label: "Menu", icon: CupSoda },
  { id: "orders", label: "My Orders", icon: ClipboardList },
  { id: "rewards", label: "Rewards", icon: Gift },
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
  { kind: "section", id: "rewards", label: "Rewards", icon: Gift },
  { kind: "profile", label: "Profile", icon: UserRound },
];

const menuFilters: Array<{
  value: Exclude<Filter, "all" | "latte-series" | "premium-blends">;
  label: string;
  icon: typeof CupSoda;
}> = [
  { value: "coffee", label: "Latte", icon: CupSoda },
  { value: "non-coffee", label: "Non-Coffee", icon: CupSoda },
  { value: "pastries", label: "Pastries", icon: Gift },
  { value: "best-deals", label: "Best Deals", icon: BadgePercent },
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
const rewardsWalletStorageKey = "kadaserve_rewards_wallet";
const checkInStorageKey = "kadaserve_daily_check_in";

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getRewardExpiry(daysFromNow = 30) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);

  return date.toISOString().slice(0, 10);
}

function readRewardWallet() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(rewardsWalletStorageKey) ?? "[]"
    ) as RewardVoucher[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
    default:
      return status;
  }
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
    const key = getMenuDedupeKey(item);
    const existingItem = uniqueItems.get(key);

    if (!existingItem || (!existingItem.is_available && item.is_available)) {
      uniqueItems.set(key, item);
    }
  });

  return Array.from(uniqueItems.values());
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
        !["delivered", "completed", "cancelled"].includes(order.status)
    ) ?? null
  );
}

function isFinalOrder(status: CustomerOrder["status"]) {
  return ["delivered", "completed", "cancelled"].includes(status);
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

function getOrderItemImage() {
  return null;
}

function getRecommendedItems(
  items: CustomerMenuItem[],
  orders: CustomerOrder[],
  preferenceSignals: NonNullable<CustomerDashboardProps["preferenceSignals"]>
) {
  const orderSignals = new Map<
    string,
    {
      frequency: number;
      recency: number;
    }
  >();
  const categoryScores = new Map<Filter, number>();
  const satisfactionScores = new Map<string, number[]>();
  const now = Date.now();
  const dayInMs = 1000 * 60 * 60 * 24;

  preferenceSignals.forEach((signal) => {
    if (!Number.isFinite(signal.overallRating)) {
      return;
    }

    const existing = satisfactionScores.get(signal.menuItemId) ?? [];
    satisfactionScores.set(signal.menuItemId, [
      ...existing,
      Math.min(Math.max(signal.overallRating, 1), 5) / 5,
    ]);
  });

  orders.forEach((order, orderIndex) => {
    const orderedAt = new Date(order.ordered_at).getTime();
    const ageInDays = Number.isFinite(orderedAt)
      ? Math.max(0, (now - orderedAt) / dayInMs)
      : orderIndex;
    const recency = Math.max(0.12, 1 / (1 + ageInDays / 14));

    order.order_items.forEach((orderItem) => {
      const menuItemId = orderItem.menu_items?.id;
      const itemName = orderItem.menu_items?.name?.toLowerCase();
      const frequency = Math.max(1, orderItem.quantity);

      if (menuItemId) {
        const current = orderSignals.get(menuItemId) ?? {
          frequency: 0,
          recency: 0,
        };

        orderSignals.set(menuItemId, {
          frequency: current.frequency + frequency,
          recency: Math.max(current.recency, recency),
        });
      }

      if (itemName) {
        const matchedItem = items.find(
          (item) => item.name.toLowerCase() === itemName
        );

        if (matchedItem) {
          const filter = getFilter(matchedItem.category);
          categoryScores.set(
            filter,
            (categoryScores.get(filter) ?? 0) + frequency + recency
          );
        }
      }
    });
  });

  const maxFrequency = Math.max(
    1,
    ...Array.from(orderSignals.values()).map((signal) => signal.frequency)
  );
  const weights = {
    recency: 0.35,
    frequency: 0.4,
    satisfaction: 0.25,
  };

  return items
    .filter((item) => item.is_available)
    .map((item) => ({
      item,
      categoryAffinity: categoryScores.get(getFilter(item.category)) ?? 0,
      signal: orderSignals.get(item.id) ?? { frequency: 0, recency: 0 },
      satisfaction:
        satisfactionScores.get(item.id)?.reduce((sum, rating) => sum + rating, 0) ??
        null,
    }))
    .map(({ item, categoryAffinity, signal, satisfaction }) => {
      const ratingCount = satisfactionScores.get(item.id)?.length ?? 0;
      const satisfactionAverage =
        satisfaction !== null && ratingCount > 0 ? satisfaction / ratingCount : 0.72;
      const normalizedFrequency =
        signal.frequency > 0
          ? signal.frequency / maxFrequency
          : Math.min(categoryAffinity / 10, 0.45);
      const normalizedRecency =
        signal.recency > 0 ? signal.recency : categoryAffinity > 0 ? 0.34 : 0.18;
      const score =
        weights.recency * normalizedRecency +
        weights.frequency * normalizedFrequency +
        weights.satisfaction * satisfactionAverage;
      const reason =
        satisfactionAverage >= 0.9
          ? "High rating match"
          : signal.recency >= 0.7
          ? "Recent favorite"
          : normalizedFrequency >= 0.6
          ? "Frequent pick"
          : "Taste match";

      return {
        item,
        reason,
        score,
      };
    })
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, 5)
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
  let coffee = 0;
  let pastries = 0;
  let other = 0;

  orders.forEach((order) => {
    order.order_items.forEach((item) => {
      const name = item.menu_items?.name?.toLowerCase() ?? "";
      const category = item.menu_items?.category
        ? getFilter(item.menu_items.category)
        : null;
      const quantity = item.quantity;

      if (category === "pastries" || category === "best-deals") {
        pastries += quantity;
      } else if (category === "coffee" || category === "non-coffee") {
        coffee += quantity;
      } else if (
        name.includes("cookie") ||
        name.includes("panini") ||
        name.includes("pastry") ||
        name.includes("sandwich")
      ) {
        pastries += quantity;
      } else if (name) {
        coffee += quantity;
      } else {
        other += quantity;
      }
    });
  });

  const total = coffee + pastries + other;

  if (total === 0) {
    return { coffee: 0, pastries: 0, other: 0 };
  }

  return {
    coffee: Math.round((coffee / total) * 100),
    pastries: Math.round((pastries / total) * 100),
    other: Math.round((other / total) * 100),
  };
}

function isDrinkRewardItem(item: CustomerOrder["order_items"][number]) {
  const category = item.menu_items?.category
    ? getFilter(item.menu_items.category)
    : null;

  if (
    category &&
    ["coffee", "non-coffee", "latte-series", "premium-blends"].includes(
      category
    )
  ) {
    return true;
  }

  if (category === "pastries") {
    return false;
  }

  const name = item.menu_items?.name?.toLowerCase() ?? "";

  return (
    Boolean(name) &&
    !["pastry", "cookie", "panini", "sandwich"].some((keyword) =>
      name.includes(keyword)
    )
  );
}

function getRewardDrinkCount(orders: CustomerOrder[]) {
  return orders
    .filter((order) => ["delivered", "completed"].includes(order.status))
    .reduce((sum, order) => {
      return (
        sum +
        order.order_items.reduce((itemSum, item) => {
          return itemSum + (isDrinkRewardItem(item) ? item.quantity : 0);
        }, 0)
      );
    }, 0);
}

function getFlavorBadges(orders: CustomerOrder[]) {
  const text = orders
    .flatMap((order) =>
      order.order_items.map((item) => item.menu_items?.name ?? "")
    )
    .join(" ")
    .toLowerCase();
  const badges = [];

  if (text.includes("latte") || text.includes("milk")) {
    badges.push("Loves Creamy");
  }

  if (
    text.includes("americano") ||
    text.includes("espresso") ||
    text.includes("macchiato")
  ) {
    badges.push("Frequent Espresso Drinker");
  }

  if (text.includes("matcha") || text.includes("strawberry")) {
    badges.push("Fruit + Matcha Fan");
  }

  if (text.includes("cookie") || text.includes("pastry")) {
    badges.push("Pastry Pairing");
  }

  return badges.length > 0 ? badges.slice(0, 3) : ["Discovering Preferences"];
}

export function CustomerDashboard({
  menuItems,
  orders,
  feedbackItems,
  preferenceSignals = [],
  initialSection = "home",
  customerProfile,
  isAuthenticated = false,
}: CustomerDashboardProps) {

  const router = useRouter();
  const { addItem, cartCount, items: cartItems } = useCart();
  const [customerOrders, setCustomerOrders] = useState(orders);
  const [activeSection, setActiveSection] = useState<Section>(initialSection);
  const [isSplashVisible, setIsSplashVisible] = useState(false);
  const [isTaglineVisible, setIsTaglineVisible] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [activePromoIndex, setActivePromoIndex] = useState(0);
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
  const [filter, setFilter] = useState<Filter>("coffee");
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
  const [isFeedbackPromptOpen, setIsFeedbackPromptOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [selectedFeedbackItemId, setSelectedFeedbackItemId] = useState("");
  const [tasteRating, setTasteRating] = useState(0);
  const [strengthRating, setStrengthRating] = useState(3);
  const [overallRating, setOverallRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [activeRewardsTab, setActiveRewardsTab] =
    useState<RewardsTab>("missions");
  const [bonusRewardPoints, setBonusRewardPoints] = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [claimedMissionIds, setClaimedMissionIds] = useState<string[]>([]);
  const [rewardWallet, setRewardWallet] = useState<RewardVoucher[]>([]);
  const [rewardCelebration, setRewardCelebration] = useState("");
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
  const [profileLanguage, setProfileLanguage] = useState<"English" | "Filipino">(
    "English"
  );
  const [openProfileFaq, setOpenProfileFaq] = useState<ProfileFaq | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSettingsMessage, setProfileSettingsMessage] = useState("");
  const profileInitials = getInitials(displayProfileName);
  const contentScrollerRef = useRef<HTMLDivElement>(null);
  const fullMenuRef = useRef<HTMLDivElement>(null);
  const menuCategoryRefs = useRef<
    Partial<Record<Exclude<Filter, "all" | "latte-series" | "premium-blends">, HTMLElement | null>>
  >({});
  const onboardingScrollerRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const trackingTouchStartYRef = useRef<number | null>(null);
  const isGuest = !isAuthenticated;

  const selectedFeedbackItem =
    feedbackItems.find((item) => item.order_item_id === selectedFeedbackItemId) ??
    feedbackItems[0];
  const canSubmitFeedback =
    Boolean(selectedFeedbackItem) && overallRating > 0 && !isSubmittingFeedback;
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
      title: "Rate, Earn, and Repeat",
      body: "Your voice matters. Share your feedback on every order to earn points and unlock exclusive vouchers for your next Kada Cafe visit.",
      icon: Gift,
      illustration: "rewards",
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

    window.sessionStorage.setItem("kadaserve_opening_seen", "true");
    setIsSplashVisible(true);
    const splashTimeoutId = window.setTimeout(() => {
      setIsSplashVisible(false);
      setIsTaglineVisible(false);
      showOnboardingIfNeeded();
    }, 5000);

    return () => {
      window.clearTimeout(splashTimeoutId);
    };
  }, []);

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
  }, [orders]);

  useEffect(() => {
    setCheckedInToday(
      window.localStorage.getItem(checkInStorageKey) === getTodayKey()
    );
    setRewardWallet(readRewardWallet());
  }, []);

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
    window.localStorage.setItem(
      rewardsWalletStorageKey,
      JSON.stringify(rewardWallet)
    );
  }, [rewardWallet]);

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
        return;
      }

      setFeedbackMessage("Feedback submitted successfully.");
      setIsFeedbackPromptOpen(false);
      setTasteRating(0);
      setStrengthRating(3);
      setOverallRating(0);
      setFeedbackComment("");
      setClaimedMissionIds((current) =>
        current.includes("feedback") ? current : [...current, "feedback"]
      );
      setBonusRewardPoints((current) => current + 15);
      setRewardCelebration("Feedback mission claimed. +15 points!");
      router.refresh();
    } catch {
      setFeedbackMessage("Something went wrong while submitting feedback.");
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
    if (isAuthenticated && feedbackItems.length > 0) {
      setIsFeedbackPromptOpen(true);
    } else {
      setIsFeedbackPromptOpen(false);
    }
  }, [feedbackItems.length, isAuthenticated]);

  useEffect(() => {
    if (!guestActionMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setGuestActionMessage("");
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [guestActionMessage]);

  useEffect(() => {
    if (!rewardCelebration) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRewardCelebration("");
    }, 2800);

    return () => window.clearTimeout(timeoutId);
  }, [rewardCelebration]);


  const uniqueMenuItems = useMemo(() => dedupeMenuItems(menuItems), [menuItems]);
  const activeOrder = useMemo(
    () => getActiveOrder(customerOrders),
    [customerOrders]
  );
  const orderHistory = useMemo(
    () => customerOrders.filter((order) => order.id !== activeOrder?.id),
    [activeOrder?.id, customerOrders]
  );
  const trackingOrder = useMemo(
    () =>
      trackingOrderId
        ? customerOrders.find((order) => order.id === trackingOrderId) ?? null
        : null,
    [customerOrders, trackingOrderId]
  );
  const trackingOrderStep = trackingOrder
    ? getOrderStepIndex(trackingOrder.status)
    : 0;
  const trackingOrderItems =
    trackingOrder?.order_items
      .map((item) => ({
        id: item.id,
        quantity: item.quantity,
        name: item.menu_items?.name ?? "Menu item",
        imageUrl: getOrderItemImage(),
      }))
      .slice(0, 4) ?? [];

  useEffect(() => {
    document.body.style.overflow =
      selectedMenuItem ||
      isProfileOpen ||
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
    isOnboardingOpen,
    isProfileOpen,
    isSplashVisible,
    isTaglineVisible,
    selectedMenuItem,
    trackingOrder,
  ]);

  const recommendedItems = useMemo(
    () => getRecommendedItems(uniqueMenuItems, customerOrders, preferenceSignals),
    [customerOrders, preferenceSignals, uniqueMenuItems]
  );
  const monthlyFavorite = useMemo(
    () => getMonthlyFavorite(customerOrders),
    [customerOrders]
  );
  const activeOrderStep = activeOrder ? getOrderStepIndex(activeOrder.status) : 0;
  const hasOrderAttention =
    activeOrder &&
    ["preparing", "ready", "out_for_delivery"].includes(activeOrder.status);
  const rewardDrinkCount = getRewardDrinkCount(customerOrders);
  const rewardCycleSize = 10;
  const completedInRewardCycle = rewardDrinkCount % rewardCycleSize;
  const hasVoucherReady = rewardDrinkCount > 0 && completedInRewardCycle === 0;
  const drinksUntilVoucher = hasVoucherReady
    ? 0
    : rewardCycleSize - completedInRewardCycle;
  const rewardProgress = hasVoucherReady
    ? 100
    : Math.round((completedInRewardCycle / rewardCycleSize) * 100);
  const rewardMessage = hasVoucherReady
    ? "Your free drink voucher is ready!"
    : `${drinksUntilVoucher} more drink${
        drinksUntilVoucher === 1 ? "" : "s"
      } until your free drink voucher!`;
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
  const rewardPoints = rewardDrinkCount * 20;
  const totalRewardPoints = rewardPoints + bonusRewardPoints;
  const feedbackMissionAvailable = feedbackItems.length > 0;
  const feedbackMissionProgress = Math.min(3, preferenceSignals.length);
  const hasPastryOrder = customerOrders.some((order) =>
    order.order_items.some((item) => {
      const text = `${item.menu_items?.name ?? ""} ${
        item.menu_items?.category ?? ""
      }`.toLowerCase();

      return (
        text.includes("pastry") ||
        text.includes("cookie") ||
        text.includes("panini") ||
        text.includes("sandwich")
      );
    })
  );
  const diversityMissionClaimed = claimedMissionIds.includes("diversity");
  const feedbackMissionClaimed = claimedMissionIds.includes("feedback");
  const pointsProgress = Math.min(100, Math.round((totalRewardPoints / 500) * 100));
  const pointsRingStyle = {
    background: `conic-gradient(#0D2E18 ${pointsProgress}%, #E8D9BE ${pointsProgress}% 100%)`,
  };
  const pastryMissionItem = uniqueMenuItems.find(
    (item) => item.is_available && isPastryMenuItem(item)
  );
  const promoCards = recommendedItems
    .filter(({ item }) => Boolean(getMenuImage(item)))
    .slice(0, 3)
    .map(({ item, reason }) => ({
      title: item.name,
      body: item.description || reason,
      image: getMenuImage(item) as string,
    }));
  const activePromo = promoCards[activePromoIndex] ?? null;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActivePromoIndex((current) =>
        promoCards.length > 0 ? (current + 1) % promoCards.length : 0
      );
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [promoCards.length]);

  function showPromo(direction: "previous" | "next") {
    setActivePromoIndex((current) =>
      direction === "next"
        ? (current + 1) % Math.max(1, promoCards.length)
        : (current - 1 + Math.max(1, promoCards.length)) %
          Math.max(1, promoCards.length)
    );
  }

  const filteredMenu = useMemo(() => {
    const matchingItems = uniqueMenuItems.filter((item) => {
      const matchesQuery =
        !debouncedQuery ||
        item.name.toLowerCase().includes(debouncedQuery) ||
        (item.description ?? "").toLowerCase().includes(debouncedQuery);

      return matchesQuery;
    });

    return sortMenuByAvailability(matchingItems);
  }, [debouncedQuery, uniqueMenuItems]);
  const menuGroups = menuFilters.map((item) => ({
    ...item,
    items: filteredMenu.filter((menuItem) => getFilter(menuItem.category) === item.value),
  }));
  const activeMenuFilter = menuFilters.some((item) => item.value === filter)
    ? filter
    : "coffee";
  useEffect(() => {
    if (activeSection !== "menu") {
      return;
    }

    const scroller = contentScrollerRef.current;

    if (!scroller || typeof IntersectionObserver === "undefined") {
      return;
    }

    const menuValues = menuFilters.map((item) => item.value);
    const chooseActiveCategory = () => {
      const scrollerRect = scroller.getBoundingClientRect();
      const activeLine = scrollerRect.top + Math.max(72, scrollerRect.height * 0.2);
      const sectionPositions = menuValues
        .map((value) => {
          const section = menuCategoryRefs.current[value];

          if (!section) {
            return null;
          }

          const rect = section.getBoundingClientRect();

          return {
            value,
            top: rect.top,
            bottom: rect.bottom,
          };
        })
        .filter(Boolean) as Array<{
        value: Exclude<Filter, "all" | "latte-series" | "premium-blends">;
        top: number;
        bottom: number;
      }>;

      const categoryAtGuideLine = sectionPositions.find(
        (section) => section.top <= activeLine && section.bottom > activeLine
      );
      const nearestPassedCategory = [...sectionPositions]
        .filter((section) => section.top <= activeLine)
        .sort((first, second) => second.top - first.top)[0];
      const nextCategory =
        categoryAtGuideLine?.value ??
        nearestPassedCategory?.value ??
        menuValues[0];

      setFilter((current) => (current === nextCategory ? current : nextCategory));
    };

    const observer = new IntersectionObserver(chooseActiveCategory, {
      root: scroller,
      rootMargin: "-18% 0px -68% 0px",
      threshold: [0, 0.15, 0.4, 0.7],
    });

    menuValues.forEach((value) => {
      const section = menuCategoryRefs.current[value];

      if (section) {
        observer.observe(section);
      }
    });

    const animationFrameId = window.requestAnimationFrame(chooseActiveCategory);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [activeSection, debouncedQuery, filteredMenu.length]);

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

  useEffect(() => {
    if (
      !isAuthenticated &&
      (activeSection === "orders" || activeSection === "rewards")
    ) {
      setGuestActionMessage("Login to unlock orders, rewards, and your profile.");
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

    if (!isAuthenticated) {
      setGuestActionMessage("Login to Order");
      router.push(
        `/login?callbackUrl=${encodeURIComponent(
          `/customer?customize=${customizeId}`
        )}&intent=login-to-order`
      );
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
  }, [isAuthenticated, router, selectedMenuItem, uniqueMenuItems]);

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
    const callbackUrl = `${window.location.pathname}${window.location.search}`;
    router.push(
      `/login?callbackUrl=${encodeURIComponent(
        callbackUrl
      )}&intent=login-to-order`
    );
    return false;
  }

  function openCustomizeModal(item: CustomerMenuItem) {
    if (!requireCustomerAccount()) {
      return;
    }

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
    setTrackingOrderId(orderId);
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
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarMessage("Please choose an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarMessage("Profile picture must be 2MB or smaller.");
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
        return;
      }

      setProfileAvatarUrl(result.avatarUrl ?? "");
      setAvatarMessage("Profile picture updated.");
      router.refresh();
    } catch {
      setAvatarMessage("Something went wrong while uploading your photo.");
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
        return;
      }

      setDisplayProfileName(result.profile?.fullName ?? normalizedProfileName);
      setProfilePhoneDraft(formatProfilePhone(result.profile?.phone ?? ""));
      setProfileSettingsMessage("Profile changes saved.");
      router.refresh();
    } catch {
      setProfileSettingsMessage("Something went wrong while saving profile.");
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

      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  function closeProfileDrawer() {
    setIsProfileOpen(false);
    setIsProfileSettingsOpen(false);
    setProfileSettingsMessage("");
  }

  function handleSectionClick(section: Section) {
    if (
      (section === "orders" || section === "rewards") &&
      !requireCustomerAccount("Login to unlock this member space.")
    ) {
      return;
    }

    setActiveSection(section);
    setIsSidebarOpen(false);
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

  function handleDailyCheckIn() {
    if (checkedInToday) {
      return;
    }

    window.localStorage.setItem(checkInStorageKey, getTodayKey());
    setCheckedInToday(true);
    setBonusRewardPoints((current) => current + 1);
    setRewardCelebration("Daily check-in complete. +1 point!");
  }

  function claimDiversityMission() {
    if (!hasPastryOrder || diversityMissionClaimed) {
      return;
    }

    setClaimedMissionIds((current) => [...current, "diversity"]);
    setBonusRewardPoints((current) => current + 10);
    setRewardCelebration("Diversity mission claimed. +10 points!");
  }

  function redeemReward(reward: RewardVoucher) {
    if (rewardWallet.some((item) => item.code === reward.code)) {
      setActiveRewardsTab("wallet");
      return;
    }

    setRewardWallet((current) => [reward, ...current]);
    setActiveRewardsTab("wallet");
    setRewardCelebration(`${reward.title} added to My Rewards.`);
  }

  function handleFilterSelect(
    value: Exclude<Filter, "all" | "latte-series" | "premium-blends">
  ) {
    setFilter(value);
    const scroller = contentScrollerRef.current;
    const section = menuCategoryRefs.current[value];

    if (!scroller || !section) {
      return;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();

    scroller.scrollTo({
      top: Math.max(0, scroller.scrollTop + sectionRect.top - scrollerRect.top - 12),
      behavior: "smooth",
    });
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
          <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[#D7C7A9] bg-[#F8F7F4]/95 px-4 py-3 backdrop-blur sm:px-5">
            {activeSection !== "home" ? (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                aria-label="Search menu"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#0D2E18] shadow-[0_10px_24px_rgba(13,46,24,0.16)] transition hover:bg-[#FFF8EF]"
              >
                <Search size={20} />
              </button>
            ) : (
              <span aria-hidden="true" className="h-11 w-11" />
            )}

            <button
              type="button"
              onClick={() => {
                if (!requireCustomerAccount("Login to open your profile.")) {
                  return;
                }

                setIsSidebarOpen(false);
                setIsProfileOpen(true);
              }}
              className="hidden max-w-[210px] items-center gap-3 rounded-full border border-[#D7C7A9] bg-white/80 py-1.5 pl-1.5 pr-3 text-left shadow-sm transition hover:bg-white sm:flex"
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
          </header>

          {isSearchOpen ? (
            <div className="fixed inset-x-4 top-4 z-[70] flex items-center gap-2 rounded-full border border-[#D7C7A9] bg-white px-3 py-2 shadow-[0_16px_36px_rgba(13,46,24,0.16)] sm:left-[104px] sm:right-auto sm:w-[360px]">
              <Search size={18} className="shrink-0 text-[#0D2E18]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF0DA] text-[#0D2E18]"
              >
                <X size={18} />
              </button>
            </div>
          ) : null}

          <div
            ref={contentScrollerRef}
            className="flex-1 overflow-y-auto px-4 py-5 pb-28 sm:px-5 2xl:px-8"
          >
            {activeSection === "home" && (
              <div className="mx-auto w-full max-w-[1180px] space-y-5">
                <section className="pt-1">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="font-sans text-sm font-bold text-[#684B35]">
                        {greeting}, {firstName}!
                      </p>
                      <h1 className="mt-2 max-w-3xl font-sans text-4xl font-bold leading-[1.02] text-[#0D2E18] sm:text-5xl">
                        Your latte hub is ready.
                      </h1>
                      <p className="mt-3 max-w-2xl font-sans text-base leading-7 text-[#684B35]">
                        Your next favorite cup is a tap away. Pick an intent,
                        track live orders, and earn rewards as you rate.
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
                  <div className="group overflow-hidden rounded-[28px] bg-[#0F441D] p-4 text-[#FFF0D8] shadow-[0_14px_30px_rgba(15,68,29,0.22)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#DCCFB8]">
                          Promotions
                        </p>
                        <h2 className="font-sans text-3xl font-bold">
                          Promos & cafe notes
                        </h2>
                      </div>
                    </div>

                    <div className="relative mt-4 overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#FFF0DA_0%,#F8EBCF_52%,#0F441D_180%)] p-4 text-[#0D2E18] sm:p-5">
                      <button
                        type="button"
                        onClick={() => showPromo("previous")}
                        aria-label="Show previous promotion"
                        className="absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#0D2E18] opacity-0 shadow-md transition group-hover:opacity-100 lg:flex"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={() => showPromo("next")}
                        aria-label="Show next promotion"
                        className="absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#0D2E18] opacity-0 shadow-md transition group-hover:opacity-100 lg:flex"
                      >
                        <ChevronRight size={20} />
                      </button>

                      <div
                        key={activePromo?.title ?? rewardMessage}
                        className="grid min-h-[190px] gap-4 transition-transform duration-300 ease-[cubic-bezier(0.2,0.9,0.22,1.12)] sm:grid-cols-[1fr_150px] sm:items-center"
                      >
                        <div>
                          <p className="font-sans text-2xl font-bold leading-tight">
                            {activePromo?.title ?? "Rewards in motion"}
                          </p>
                          <p className="mt-3 min-h-12 font-sans text-sm leading-6 text-[#684B35]">
                            {activePromo?.body ?? rewardMessage}
                          </p>
                        </div>

                        <div className="h-36 overflow-hidden rounded-[22px] bg-white/55 p-1.5 shadow-[inset_0_0_0_1px_rgba(104,75,53,0.14)]">
                          {activePromo?.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={activePromo.image}
                              alt=""
                              loading="lazy"
                              className="h-full w-full rounded-[18px] object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#E7F4EA] text-4xl">
                              <Gift />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 flex gap-2">
                        {promoCards.map((promo, index) => (
                          <button
                            key={promo.title}
                            type="button"
                            aria-label={`Show promotion ${index + 1}`}
                            onClick={() => setActivePromoIndex(index)}
                            className={`h-2 rounded-full transition-all ${
                              index === activePromoIndex
                                ? "w-8 bg-[#0D2E18]"
                                : "w-2 bg-[#DCCFB8]"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-y border-[#DCCFB8] py-4 lg:border-y-0 lg:border-l lg:py-1 lg:pl-5">
                    <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#684B35]">
                      Reward Mission
                    </p>
                    <h2 className="mt-1 font-sans text-3xl font-bold leading-tight text-[#0D2E18]">
                      Got thoughts?
                    </h2>
                    <p className="mt-2 font-sans text-sm leading-6 text-[#6F634E]">
                      Rate your last order and earn 10 points. Feedback helps
                      KadaServe improve your recommendations.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !requireCustomerAccount(
                            "Login to earn rewards from feedback."
                          )
                        ) {
                          return;
                        }

                        if (feedbackMissionAvailable) {
                          setIsFeedbackPromptOpen(true);
                        } else {
                          handleSectionClick("rewards");
                        }
                      }}
                      className="mt-4 min-h-12 w-full rounded-full bg-[#0D2E18] px-4 font-sans text-sm font-bold text-[#FFF0D8] transition hover:bg-[#0F441D]"
                    >
                      {feedbackMissionAvailable
                        ? "Rate Last Order"
                        : "View Ways to Earn"}
                    </button>
                  </div>
                </section>

                {activeOrder ? (
                  <section className="rounded-[26px] border border-[#DCCFB8] bg-white/88 p-4 shadow-[0_8px_20px_rgba(0,0,0,0.06)] sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8A755D]">
                          Active Pulse
                        </p>
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
              </div>
            )}

            {activeSection === "menu" && (
              <div className="mx-auto w-full max-w-[1440px] space-y-4">
                <div className="grid grid-cols-[74px_1fr] gap-3 md:grid-cols-[92px_1fr]">
                  <aside className="sticky top-2 z-30 h-[calc(100dvh-12rem)] self-start overflow-visible rounded-r-[22px] bg-[#0D2E18] px-1.5 py-2 shadow-[8px_0_18px_rgba(13,46,24,0.16)] md:h-[calc(100dvh-9rem)]">
                    <div className="space-y-1 overflow-visible pb-[calc(5rem+env(safe-area-inset-bottom))]">
                      {menuFilters.map((item) => {
                        const Icon = item.icon;

                        return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => handleFilterSelect(item.value)}
                          aria-current={
                            activeMenuFilter === item.value ? "true" : undefined
                          }
                          className={`relative flex min-h-[76px] w-full flex-col items-center justify-center gap-1 rounded-[16px] px-1 text-center font-sans text-[10px] font-black leading-tight transition ${
                            activeMenuFilter === item.value
                              ? "bg-[#FFF0DA] text-[#0D2E18] shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
                              : "text-[#F8EBCF] hover:bg-[#164B2A]"
                          }`}
                        >
                          {activeMenuFilter === item.value ? (
                            <span className="absolute left-0 top-3 h-10 w-1 rounded-r-full bg-[#0D2E18]" />
                          ) : null}
                          <Icon size={22} />
                          <span>{item.label}</span>
                        </button>
                        );
                      })}
                    </div>
                  </aside>

                  <div
                    ref={fullMenuRef}
                    className="space-y-10 scroll-mt-24 pb-28"
                  >
                    {menuGroups.map((group) => (
                      <section
                        key={group.value}
                        ref={(element) => {
                          menuCategoryRefs.current[group.value] = element;
                        }}
                        className="scroll-mt-4"
                      >
                        <h2 className="mb-4 border-l-4 border-[#0D2E18] pl-3 font-sans text-xl font-black text-[#0D2E18]">
                          {group.label}
                        </h2>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 xl:grid-cols-4">
                          {group.items.map((item) => {
                            const menuImage = getMenuImage(item);
                            const isQuickAdded = quickAddFeedback?.itemId === item.id;

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
                                className="h-full w-full rounded-full object-cover"
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
                        </button>
                      </article>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                  </div>
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
                  <p className="mt-1 text-sm text-[#6F634E]">
                    Track live orders first, then quickly reorder your usuals.
                  </p>
                </div>

                {activeOrder ? (
                  <article
                    className="rounded-[28px] border border-[#DCCFB8] bg-white p-4 shadow-[0_12px_28px_rgba(13,46,24,0.10)] transition hover:shadow-[0_14px_32px_rgba(13,46,24,0.14)] sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#8A755D]">
                          Live Pulse
                        </p>
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
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => openTrackingModal(order.id)}
                                className="rounded-full border border-[#D8C8A7] px-3 py-2 font-sans text-xs font-bold text-[#684B35]"
                              >
                                Track
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReorder(order)}
                                className="rounded-full bg-[#123E26] px-3 py-2 font-sans text-xs font-bold text-white"
                              >
                                Reorder
                              </button>
                            </div>
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
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => openTrackingModal(order.id)}
                                  className="rounded-full border border-[#D8C8A7] px-3 py-2 font-sans text-xs font-bold text-[#684B35]"
                                >
                                  Track
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReorder(order)}
                                  className="rounded-full bg-[#123E26] px-3 py-2 font-sans text-xs font-bold text-white"
                                >
                                  Reorder
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </section>
              </div>
            )}

            {activeSection === "rewards" && (
              <div className="mx-auto w-full max-w-5xl space-y-4">
                <div className="sticky top-0 z-20 -mx-3 bg-[#FFF0DA]/95 px-3 pb-3 pt-1 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:pt-0">
                  <h1 className="text-center font-sans text-2xl font-black text-[#0D2E18] md:text-3xl">
                    Missions and Rewards
                  </h1>

                  <div className="mt-4 grid grid-cols-3 border-b border-[#C8D0C4]">
                    {[
                      ["missions", "Missions"],
                      ["redeem", "Redeem Rewards"],
                      ["wallet", "My Rewards"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setActiveRewardsTab(value as RewardsTab)}
                        className={`relative px-2 pb-3 font-sans text-sm font-bold transition sm:text-base ${
                          activeRewardsTab === value
                            ? "text-[#0D2E18]"
                            : "text-[#9B9B9B]"
                        }`}
                      >
                        {label}
                        {activeRewardsTab === value ? (
                          <span className="absolute inset-x-2 bottom-0 h-1 rounded-t-full bg-[#0D2E18]" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                {rewardCelebration ? (
                  <div className="kada-fade-up fixed left-1/2 top-4 z-[95] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-[18px] bg-[#0D2E18] px-4 py-3 text-[#FFF0DA] shadow-[0_18px_40px_rgba(13,46,24,0.24)]">
                    <PartyPopper className="h-5 w-5 shrink-0" />
                    <p className="font-sans text-sm font-bold">
                      {rewardCelebration}
                    </p>
                  </div>
                ) : null}

                {activeRewardsTab === "missions" ? (
                  <div className="space-y-5 pb-4">
                    <section className="flex flex-col items-center rounded-[28px] bg-white p-5 shadow-[0_12px_28px_rgba(13,46,24,0.08)]">
                      <div
                        className="flex h-56 w-56 items-center justify-center rounded-full p-3"
                        style={pointsRingStyle}
                      >
                        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center">
                          <CupSoda className="h-16 w-16 text-[#0D2E18]" />
                          <p className="mt-3 font-sans text-5xl font-black leading-none text-[#0D2E18]">
                            {totalRewardPoints}
                          </p>
                          <p className="font-sans text-sm font-bold text-[#684B35]">
                            points
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[24px] border border-[#E8D9BE] bg-white p-5 shadow-[0_10px_24px_rgba(13,46,24,0.08)]">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="font-sans text-2xl font-black text-[#0D2E18]">
                          Daily Check-in
                        </h2>
                        <CalendarCheck className="h-6 w-6 text-[#8C7A64]" />
                      </div>
                      <div className="mt-4 grid grid-cols-7 gap-2">
                        {[1, 1, 1, 3, 1, 1, 21].map((points, index) => (
                          <div key={`${points}-${index}`} className="text-center">
                            <div
                              className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full font-sans text-xs font-bold ${
                                index === 0 && checkedInToday
                                  ? "bg-[#0D2E18] text-[#FFF0DA]"
                                  : "bg-[#F2EFE9] text-[#B5AA9A]"
                              }`}
                            >
                              {points}pt{points === 1 ? "" : "s"}
                            </div>
                            <p className="mt-1 font-sans text-[11px] font-semibold text-[#A49786]">
                              Day {index + 1}
                            </p>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleDailyCheckIn}
                        disabled={checkedInToday}
                        className="mt-5 w-full rounded-full border-2 border-[#0D2E18] px-5 py-3 font-sans text-base font-black text-[#0D2E18] transition hover:bg-[#0D2E18] hover:text-[#FFF0DA] disabled:border-[#D8C8A7] disabled:text-[#8C7A64] disabled:hover:bg-transparent"
                      >
                        {checkedInToday ? "Checked In Today" : "Check In & Get 1 pt"}
                      </button>
                    </section>

                    <section>
                      <h2 className="font-sans text-2xl font-black text-[#0D2E18]">
                        Complete missions & get exclusive rewards
                      </h2>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <article className="rounded-[22px] border border-[#E8D9BE] bg-white p-4 shadow-[0_10px_22px_rgba(13,46,24,0.08)]">
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#FFF0DA] text-[#684B35]">
                              <Star size={22} />
                            </span>
                            <span className="rounded-full bg-[#E9F5E7] px-3 py-1 font-sans text-xs font-bold text-[#2D7A40]">
                              +15 pts
                            </span>
                          </div>
                          <h3 className="mt-4 font-sans text-lg font-black text-[#0D2E18]">
                            Rate 3 orders this week
                          </h3>
                          <p className="mt-1 font-sans text-sm text-[#684B35]">
                            {feedbackMissionProgress}/3 ratings completed.
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsFeedbackPromptOpen(true)}
                            disabled={!feedbackMissionAvailable || feedbackMissionClaimed}
                            className="mt-4 w-full rounded-full bg-[#0D2E18] px-4 py-2.5 font-sans text-sm font-bold text-[#FFF0DA] disabled:cursor-not-allowed disabled:bg-[#D8C8A7] disabled:text-[#8A755D]"
                          >
                            {feedbackMissionClaimed
                              ? "Claimed"
                              : feedbackMissionAvailable
                                ? "Rate Now"
                                : "No Order Yet"}
                          </button>
                        </article>

                        <article className="rounded-[22px] border border-[#E8D9BE] bg-white p-4 shadow-[0_10px_22px_rgba(13,46,24,0.08)]">
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#E9F5E7] text-[#2D7A40]">
                              <Gift size={22} />
                            </span>
                            <span className="rounded-full bg-[#E9F5E7] px-3 py-1 font-sans text-xs font-bold text-[#2D7A40]">
                              +10 pts
                            </span>
                          </div>
                          <h3 className="mt-4 font-sans text-lg font-black text-[#0D2E18]">
                            Try a Pastry from the Hall of Fame
                          </h3>
                          <p className="mt-1 font-sans text-sm text-[#684B35]">
                            Expands your taste profile beyond drinks.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              if (hasPastryOrder) {
                                claimDiversityMission();
                                return;
                              }

                              if (pastryMissionItem) {
                                handleQuickAdd(pastryMissionItem);
                                router.push("/customer/cart");
                              }
                            }}
                            disabled={
                              diversityMissionClaimed ||
                              (!hasPastryOrder && !pastryMissionItem)
                            }
                            className="mt-4 w-full rounded-full bg-[#0D2E18] px-4 py-2.5 font-sans text-sm font-bold text-[#FFF0DA] disabled:cursor-not-allowed disabled:bg-[#D8C8A7] disabled:text-[#8A755D]"
                          >
                            {diversityMissionClaimed
                              ? "Claimed"
                              : hasPastryOrder
                                ? "Claim Reward"
                                : pastryMissionItem
                                  ? `Order ${pastryMissionItem.name}`
                                  : "No pastry available"}
                          </button>
                        </article>
                      </div>
                    </section>
                  </div>
                ) : null}

                {activeRewardsTab === "redeem" ? (
                  <div className="space-y-5 pb-4">
                    <section className="rounded-[24px] bg-[#F8FBF7] p-5">
                      <p className="font-sans text-sm font-bold text-[#0D2E18]">
                        KadaServe Points
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-4">
                        <button className="rounded-[18px] bg-[#0D2E18] px-5 py-4 text-left text-[#FFF0DA]">
                          <span className="block font-sans text-3xl font-black">
                            {totalRewardPoints} pts
                          </span>
                          <span className="font-sans text-xs font-bold text-[#DCCFB8]">
                            Ready to redeem
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveRewardsTab("wallet")}
                          className="rounded-full border-2 border-[#0D2E18] px-5 py-3 font-sans text-sm font-black text-[#0D2E18]"
                        >
                          My Rewards
                        </button>
                      </div>
                    </section>

                    <section>
                      <h2 className="font-sans text-2xl font-black text-[#0D2E18]">
                        KadaServe Rewards
                      </h2>
                      <div className="mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {[
                          {
                            code: "KADA10",
                            title: "\u20B110 Discount",
                            expiresAt: getRewardExpiry(),
                            value: "\u20B110 off",
                            cost: 500,
                          },
                          {
                            code: "KADA30",
                            title: "\u20B130 Discount",
                            expiresAt: getRewardExpiry(),
                            value: "\u20B130 off",
                            cost: 1500,
                          },
                        ].map((reward) => (
                          <article
                            key={reward.code}
                            className="min-w-[16rem] snap-start overflow-hidden rounded-[22px] border border-[#E8D9BE] bg-white shadow-[0_10px_22px_rgba(13,46,24,0.08)]"
                          >
                            <div className="bg-[#0D2E18] p-5 text-[#FFF0DA]">
                              <p className="font-sans text-5xl font-black">
                                {reward.title}
                              </p>
                            </div>
                            <div className="p-4">
                              <p className="font-sans text-sm font-bold text-[#684B35]">
                                Redeem with
                              </p>
                              <p className="font-sans text-2xl font-black text-[#0D2E18]">
                                {reward.cost} pts
                              </p>
                              <button
                                type="button"
                                onClick={() => redeemReward(reward)}
                                className="mt-4 w-full rounded-full bg-[#0D2E18] px-4 py-2.5 font-sans text-sm font-bold text-[#FFF0DA]"
                              >
                                Redeem
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h2 className="font-sans text-2xl font-black text-[#0D2E18]">
                        Exclusive Tier Rewards
                      </h2>
                      <article className="mt-4 rounded-[22px] border border-[#E8D9BE] bg-white p-5 shadow-[0_10px_22px_rgba(13,46,24,0.08)]">
                        <div className="flex items-start justify-between gap-3">
                          <BadgePercent className="h-9 w-9 text-[#0D2E18]" />
                          {flavorBadges.includes("Loves Creamy") ? (
                            <CheckCircle2 className="h-6 w-6 text-[#2D7A40]" />
                          ) : (
                            <LockKeyhole className="h-6 w-6 text-[#8C7A64]" />
                          )}
                        </div>
                        <h3 className="mt-4 font-sans text-xl font-black text-[#0D2E18]">
                          Free Add-on for Creamy Drinks
                        </h3>
                        <p className="mt-2 font-sans text-sm text-[#684B35]">
                          Unlocks when your taste profile includes Loves Creamy.
                        </p>
                        <button
                          type="button"
                          disabled={!flavorBadges.includes("Loves Creamy")}
                          onClick={() =>
                            redeemReward({
                              code: "CREAMYADDON",
                              title: "Free Creamy Add-on",
                              expiresAt: getRewardExpiry(21),
                              value: "Free add-on",
                            })
                          }
                          className="mt-4 w-full rounded-full bg-[#0D2E18] px-4 py-2.5 font-sans text-sm font-bold text-[#FFF0DA] disabled:cursor-not-allowed disabled:bg-[#D8C8A7] disabled:text-[#8A755D]"
                        >
                          {flavorBadges.includes("Loves Creamy")
                            ? "Redeem Exclusive"
                            : "Locked"}
                        </button>
                      </article>
                    </section>
                  </div>
                ) : null}

                {activeRewardsTab === "wallet" ? (
                  <div className="min-h-[26rem] pb-4">
                    {rewardWallet.length > 0 ? (
                      <div className="space-y-4">
                        {rewardWallet.map((voucher) => (
                          <article
                            key={voucher.code}
                            className="rounded-[24px] border border-[#E8D9BE] bg-white p-5 shadow-[0_10px_22px_rgba(13,46,24,0.08)]"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[#684B35]">
                                  Active Voucher
                                </p>
                                <h2 className="mt-1 font-sans text-2xl font-black text-[#0D2E18]">
                                  {voucher.title}
                                </h2>
                                <p className="mt-1 font-sans text-sm text-[#684B35]">
                                  Use code {voucher.code} before {voucher.expiresAt}
                                </p>
                              </div>
                              <div className="flex h-20 w-20 items-center justify-center rounded-[18px] bg-[#0D2E18] text-[#FFF0DA]">
                                <QrCode className="h-10 w-10" />
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-[25rem] flex-col items-center justify-center text-center">
                        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[#C8D0E4] text-white">
                          <Ticket className="h-14 w-14" />
                        </div>
                        <p className="mt-6 font-sans text-2xl font-bold text-[#B6BDD3]">
                          No Available Voucher
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveRewardsTab("missions")}
                          className="mt-5 rounded-full bg-[#0D2E18] px-5 py-3 font-sans text-sm font-bold text-[#FFF0DA]"
                        >
                          Complete missions to earn your first reward!
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
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
                        className="w-full rounded-[18px] bg-[#123E26] px-5 py-4 text-lg font-bold text-white disabled:opacity-60"
                      >
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
                            <Gift className="absolute right-4 top-4 h-8 w-8 text-[#FFF0D8]" />
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

      <nav className="fixed inset-x-3 bottom-3 z-50 rounded-[24px] bg-[#0D2E18] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_14px_34px_rgba(13,46,24,0.28)] md:hidden">
        <div className="grid grid-cols-5 gap-1">
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
                onClick={() => setIsFeedbackPromptOpen(false)}
                aria-label="Review later"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0D2E18] transition hover:bg-[#FFF8EF]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="max-h-[calc(88vh-5.5rem)] space-y-4 overflow-y-auto px-5 py-4">
              {feedbackItems.length > 1 ? (
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
                    {feedbackItems.map((item) => (
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

              <div className="rounded-[20px] bg-[#FFF8EF] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-sans text-base font-black text-[#0D2E18]">
                    Overall Experience
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

              <button
                type="button"
                onClick={handleSubmitFeedback}
                disabled={!canSubmitFeedback}
                className="w-full rounded-[18px] bg-[#0D2E18] px-5 py-4 font-sans text-base font-black text-white transition hover:bg-[#0F441D] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isSubmittingFeedback ? "Submitting..." : "Quick Submit"}
              </button>
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
                    <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-[24px] bg-[#E7F1E6] text-6xl sm:w-52">
                      {getMenuImage(selectedMenuItem) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getMenuImage(selectedMenuItem) ?? ""}
                          alt={selectedMenuItem.name}
                          className="h-full w-full object-cover"
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
                  <h3 className="font-sans text-xl font-black text-[#123E26]">
                    Order Builder
                  </h3>

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
                      Live Status
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
                        <div className="flex aspect-[9/16] h-20 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#E7F1E6] text-2xl">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
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
                  <h3 className="font-sans text-2xl font-bold text-[#0D2E18]">
                    What Happens Next
                  </h3>
                  <p className="mt-2 font-sans text-sm leading-6 text-[#6F634E]">
                    This tracker updates automatically when staff moves your
                    order through the queue. No refresh needed.
                  </p>

                  <div className="mt-4 rounded-[18px] bg-[#E9F5E7] p-3 font-sans text-sm text-[#2D7A40]">
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

                  {trackingOrder.payment_status === "paid" ||
                  ["out_for_delivery", "delivered"].includes(
                    trackingOrder.status
                  ) ? (
                    <div className="mt-3 rounded-[18px] bg-[#FFF0DA] p-3 font-sans text-sm font-semibold text-[#684B35]">
                      Check your email for the latest Kada Cafe PH update.
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
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
              <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[#DCCFB8]">
                {isProfileSettingsOpen ? "Profile Settings" : "Your Profile"}
              </p>
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-sans text-sm font-bold text-[#684B35]">
                  Voucher Progress
                </p>
                <p className="font-sans text-xl font-black">
                  {rewardProgress}%
                </p>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#DCCFB8]"
                title={rewardMessage}
              >
                <div
                  className="h-full rounded-full bg-[#0F441D]"
                  style={{ width: `${rewardProgress}%` }}
                />
              </div>
              <p className="mt-1.5 font-sans text-[11px] leading-4 text-[#684B35]">
                {isUploadingAvatar
                  ? "Uploading your profile picture..."
                  : avatarMessage || rewardMessage}
              </p>
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

                  <label className="block">
                    <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                      Phone
                    </span>
                    <input
                      value={profilePhoneDraft}
                      onChange={(event) =>
                        setProfilePhoneDraft(formatProfilePhone(event.target.value))
                      }
                      inputMode="tel"
                      placeholder="0917-123-4567"
                      className="mt-1 w-full rounded-[14px] border border-[#DCCFB8] bg-[#FFF8EF] px-3 py-2.5 font-sans text-sm text-[#0D2E18] outline-none focus:border-[#0F441D]"
                    />
                    {!isValidOptionalPhone(profilePhoneDraft) ? (
                      <span className="mt-1 block font-sans text-xs text-[#A14E32]">
                        Use a valid Philippine mobile number.
                      </span>
                    ) : null}
                  </label>

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
                    ["Latte", tasteProfile.coffee],
                    ["Pastries", tasteProfile.pastries],
                    ["Other", tasteProfile.other],
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
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full rounded-[14px] border border-[#DCCFB8] px-4 py-2.5 font-sans text-sm font-bold text-[#684B35] transition hover:bg-[#FFF0DA] disabled:opacity-60"
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
    </main>
  );
}

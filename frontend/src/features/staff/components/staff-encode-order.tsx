"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Minus,
    Plus,
    RefreshCw,
    Search,
    ShoppingCart,
    Trash2,
    X,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EncodeOrderHeaderControls } from "./encode-order-header-controls";
import type { MenuCategory, MenuFilterCategory, StaffMenuItem } from "@/types/menu";
import type { OrderType, PaymentMethod, PaymentStatus } from "@/types/orders";

type Size = "regular";

type AddonOption = {
    label: string;
    value: string;
    price: number;
};

type CartItem = {
    id: string;
    name: string;
    price: number;
    category: MenuCategory;
    imageUrl: string | null;
    size: Size;
    quantity: number;
    sugar_level: number;
    addons: string[];
    addon_price: number;
    special_instructions: string;
};

type StaffProfile = {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
};

const categoryButtons: Array<{ key: MenuFilterCategory; label: string }> = [
    { key: "all", label: "All" },
    { key: "non-coffee", label: "Non-Coffee" },
    { key: "pastries", label: "Pastries" },
    { key: "latte-series", label: "Latte Series" },
    { key: "premium-blends", label: "Premium Blends" },
    { key: "best-deals", label: "Best Deals" },
];

const sweetnessLevels = [
    { label: "100%", value: 100 },
    { label: "75%", value: 75 },
    { label: "50%", value: 50 },
    { label: "25%", value: 25 },
    { label: "0% (No Sugar)", value: 0 },
];

const addonOptions: AddonOption[] = [
    { label: "Extra Coffee", value: "extra_coffee", price: 20 },
    { label: "Extra Milk", value: "extra_milk", price: 15 },
    { label: "Vanilla Syrup", value: "vanilla_syrup", price: 15 },
    { label: "Caramel Syrup", value: "caramel_syrup", price: 15 },
    { label: "Hazelnut Syrup", value: "hazelnut_syrup", price: 15 },
    { label: "Chocolate Syrup", value: "chocolate_syrup", price: 15 },
];

function formatPrice(value: number) {
    return Math.round(value);
}

function formatCategory(category: MenuCategory) {
    switch (category) {
        case "coffee":
            return "Latte";
        case "non-coffee":
            return "Non-Coffee";
        case "pastries":
            return "Pastries";
        case "latte-series":
            return "Latte Series";
        case "premium-blends":
            return "Premium Blends";
        case "best-deals":
            return "Best Deal";
        default:
            return category;
    }
}

function formatSweetnessLabel(value: number) {
    return value === 0 ? "No Sugar" : `${value}% Sugar`;
}

function formatAddonLabel(value: string) {
    return value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}


function getCategoryBadgeStyle(category: MenuCategory) {
    switch (category) {
        case "coffee":
            return "bg-[#E6F2E8] text-[#0D2E18]";
        case "non-coffee":
            return "bg-[#E7F4EA] text-[#0F441D]";
        case "pastries":
            return "bg-[#FFF0E5] text-[#B76522]";
        case "latte-series":
            return "bg-[#E6F2E8] text-[#0D2E18]";
        case "premium-blends":
            return "bg-[#FFF0DA] text-[#684B35]";
        case "best-deals":
            return "bg-[#FFF0DA] text-[#684B35]";
        default:
            return "bg-[#F4EEE6] text-[#684B35]";
    }
}

export function StaffEncodeOrder() {
    const [menuItems, setMenuItems] = useState<StaffMenuItem[]>([]);
    const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<MenuFilterCategory>("all");
    const [orderType, setOrderType] = useState<OrderType>("pickup");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
    const [walkinName, setWalkinName] = useState("");
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [deliveryEmail, setDeliveryEmail] = useState("");
    const [deliveryPhone, setDeliveryPhone] = useState("");
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customizingItem, setCustomizingItem] = useState<StaffMenuItem | null>(null);
    const [customizingQuantity, setCustomizingQuantity] = useState(1);
    const [customizingSugarLevel, setCustomizingSugarLevel] = useState(100);
    const [customizingAddons, setCustomizingAddons] = useState<string[]>([]);
    const [isLoadingMenu, setIsLoadingMenu] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastMenuSyncedAt, setLastMenuSyncedAt] = useState<Date | null>(null);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const filteredItems = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return menuItems.filter((item) => {
            const matchesCategory =
                activeCategory === "all" || item.category === activeCategory;

            const matchesSearch =
                !keyword ||
                item.name.toLowerCase().includes(keyword) ||
                formatCategory(item.category).toLowerCase().includes(keyword);

            return matchesCategory && matchesSearch;
        });
    }, [activeCategory, menuItems, search]);

    const categoryCounts = useMemo(() => {
        return categoryButtons.reduce<Record<MenuFilterCategory, number>>(
            (counts, button) => {
                counts[button.key] =
                    button.key === "all"
                        ? menuItems.length
                        : menuItems.filter((item) => item.category === button.key).length;

                return counts;
            },
            {
                all: 0,
                coffee: 0,
                "non-coffee": 0,
                pastries: 0,
                "latte-series": 0,
                "premium-blends": 0,
                "best-deals": 0,
            }
        );
    }, [menuItems]);

    const subtotal = useMemo(() => {
        return cart.reduce(
            (sum, item) => sum + (item.price + item.addon_price) * item.quantity,
            0
        );
    }, [cart]);

    const total = useMemo(() => {
        return subtotal + (orderType === "delivery" ? deliveryFee : 0);
    }, [subtotal, deliveryFee, orderType]);

    const customizingAddonTotal = useMemo(() => {
        return customizingAddons.reduce(
            (sum, addonValue) =>
                sum + (addonOptions.find((item) => item.value === addonValue)?.price ?? 0),
            0
        );
    }, [customizingAddons]);

    const hasRequiredDeliveryInfo =
        orderType !== "delivery" ||
        (deliveryAddress.trim().length > 0 && deliveryPhone.trim().length > 0);
    const hasRequiredCustomerName =
        orderType !== "pickup" || walkinName.trim().length > 0;

    const cartCount = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    }, [cart]);
    const rawStaffName = staffProfile?.fullName?.trim() || "Chrizelda";
    const normalizedStaffName =
        rawStaffName.replace(/^staff\s+/i, "").trim() || "Chrizelda";
    const staffFirstName = normalizedStaffName.split(/\s+/)[0] || "Chrizelda";
    const staffRole =
        staffProfile?.role?.replace("_", " ").replace(/\b\w/g, (letter) =>
            letter.toUpperCase()
        ) || "Staff";
    const staffChipLabel = `Staff ${staffFirstName}`;
    const menuSyncMeta = isLoadingMenu
        ? "Syncing..."
        : `Menu sync${
            lastMenuSyncedAt
                ? ` - Last ${lastMenuSyncedAt.toLocaleTimeString("en-PH", {
                    hour: "numeric",
                    minute: "2-digit",
                })}`
                : ""
        }`;

    useEffect(() => {
        loadMenuItems();
    }, []);

    async function loadMenuItems() {
        setIsLoadingMenu(true);
        setError("");

        try {
            const response = await fetch("/api/staff/menu", {
                method: "GET",
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || "Failed to load menu items.");
                return;
            }

            setMenuItems(result.menuItems ?? []);
            setStaffProfile(result.staffProfile ?? null);
            setLastMenuSyncedAt(new Date());
        } catch {
            setError("Something went wrong while loading menu items.");
        } finally {
            setIsLoadingMenu(false);
        }
    }


    function getSelectedQuantity(itemId: string) {
        return selectedQuantities[itemId] ?? 0;
    }


    function changeItemQuantity(itemId: string, delta: number) {
        setSelectedQuantities((prev) => {
            const current = prev[itemId] ?? 0;
            const next = Math.max(0, current + delta);

            return {
                ...prev,
                [itemId]: next,
            };
        });
    }

    function buildCartSignature(item: Pick<CartItem, "id" | "size" | "sugar_level" | "addons">) {
        return JSON.stringify({
            id: item.id,
            size: item.size,
            sugar_level: item.sugar_level,
            addons: [...item.addons].sort(),
        });
    }

    function openCustomization(item: StaffMenuItem) {
        const quantity = getSelectedQuantity(item.id);

        if (quantity <= 0) return;

        setCustomizingItem(item);
        setCustomizingQuantity(quantity);
        setCustomizingSugarLevel(100);
        setCustomizingAddons([]);
        setSuccessMessage("");
    }

    function closeCustomization() {
        setCustomizingItem(null);
        setCustomizingQuantity(1);
        setCustomizingSugarLevel(100);
        setCustomizingAddons([]);
    }

    function toggleCustomizationAddon(value: string) {
        setCustomizingAddons((current) =>
            current.includes(value)
                ? current.filter((item) => item !== value)
                : [...current, value]
        );
    }

    function confirmCustomization() {
        if (!customizingItem || customizingQuantity <= 0) return;

        const size: Size = "regular";
        const addonPrice = customizingAddons.reduce(
            (sum, addonValue) => sum + (addonOptions.find((item) => item.value === addonValue)?.price ?? 0),
            0
        );
        const payload: CartItem = {
            id: customizingItem.id,
            name: customizingItem.name,
            price: customizingItem.price,
            category: customizingItem.category,
            imageUrl: customizingItem.imageUrl,
            size,
            quantity: customizingQuantity,
            sugar_level: customizingSugarLevel,
            addons: [...customizingAddons],
            addon_price: addonPrice,
            special_instructions: "",
        };

        setCart((prev) => {
            const existingIndex = prev.findIndex(
                (cartItem) => buildCartSignature(cartItem) === buildCartSignature(payload)
            );

            if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = {
                    ...next[existingIndex],
                    quantity: next[existingIndex].quantity + customizingQuantity,
                };
                return next;
            }

            return [...prev, payload];
        });

        setSelectedQuantities((prev) => ({
            ...prev,
            [customizingItem.id]: 0,
        }));

        setSuccessMessage(`Added ${customizingItem.name} to cart.`);
        closeCustomization();
    }

    function changeCartQuantity(index: number, delta: number) {
        setCart((prev) => {
            const next = [...prev];
            const updatedQuantity = next[index].quantity + delta;

            if (updatedQuantity <= 0) {
                next.splice(index, 1);
                return next;
            }

            next[index] = {
                ...next[index],
                quantity: updatedQuantity,
            };

            return next;
        });
    }

    function removeCartItem(index: number) {
        setCart((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    }

    async function handleSubmitOrderQueue() {
        if (cart.length === 0 || isSubmitting) return;

        if (!hasRequiredCustomerName) {
            setError("Customer name is required for walk-in pickup.");
            return;
        }

        if (!hasRequiredDeliveryInfo) {
            setError("Delivery address and phone are required.");
            return;
        }

        setIsSubmitting(true);
        setError("");
        setSuccessMessage("");

        try {
            const response = await fetch("/api/staff/orders/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    orderType,
                    items: cart,
                    totalAmount: total,
                    deliveryFee: orderType === "delivery" ? deliveryFee : 0,
                    walkinName,
                    deliveryAddress,
                    deliveryEmail,
                    deliveryPhone,
                    paymentMethod,
                    paymentStatus,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || "Failed to submit order.");
                return;
            }

            setCart([]);
            setSelectedQuantities({});
            setOrderType("pickup");
            setPaymentMethod("cash");
            setPaymentStatus("paid");
            setWalkinName("");
            setDeliveryAddress("");
            setDeliveryEmail("");
            setDeliveryPhone("");
            setDeliveryFee(0);
            setSuccessMessage(
                `Order #${result.orderId.slice(0, 8).toUpperCase()} added to queue.`
            );
        } catch {
            setError("Something went wrong while submitting the order.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="bg-[#FFF0DA] text-[#0D2E18] lg:h-[calc(100dvh-4.5rem)] lg:overflow-hidden">
            <EncodeOrderHeaderControls
                search={search}
                onSearchChange={setSearch}
                isLoadingMenu={isLoadingMenu}
                onRefresh={loadMenuItems}
                menuSyncMeta={menuSyncMeta}
            />

            <section className="flex min-h-[calc(100dvh-4.5rem)] flex-col gap-0 lg:grid lg:h-[calc(100dvh-4.5rem)] lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
                {/* Products Section */}
                <div className="min-w-0 flex flex-1 flex-col lg:h-full lg:overflow-hidden">
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {/* Categories */}
                    <div className="sticky top-0 z-10 bg-[#FFF0DA]/95 px-4 py-2 backdrop-blur sm:px-5 lg:px-6">
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {categoryButtons.map((button) => (
                                <button
                                    key={button.key}
                                    type="button"
                                    onClick={() => setActiveCategory(button.key)}
                                    className={`flex-shrink-0 rounded-full border px-4 py-2 font-sans text-sm font-semibold transition-all duration-200 ${
                                        activeCategory === button.key
                                            ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA] shadow-[0_4px_12px_rgba(13,46,24,0.15)]"
                                            : "border-[#D6C6AC] bg-white text-[#684B35] hover:border-[#0D2E18] hover:bg-[#FFF8EF]"
                                    }`}
                                >
                                    {button.label}
                                    <span className="ml-1.5 opacity-60">{categoryCounts[button.key]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="px-4 py-2 sm:px-5 lg:px-6">
                        {error && (
                            <div className="mb-3 animate-in rounded-[14px] bg-[#FFF1EC] px-4 py-3 font-sans text-sm font-medium text-[#A6422A] shadow-sm">
                                {error}
                            </div>
                        )}

                        {successMessage && (
                            <div className="mb-3 animate-in rounded-[14px] border border-[#0F441D]/15 bg-white px-4 py-3 font-sans text-sm font-medium text-[#0D2E18] shadow-[0_2px_8px_rgba(13,46,24,0.08)]">
                                ✓ {successMessage}
                            </div>
                        )}
                    </div>

                    {/* Loading State */}
                    {isLoadingMenu && (
                        <div className="px-4 py-12 text-center sm:px-5 lg:px-6">
                            <div className="inline-flex items-center gap-2 rounded-[14px] bg-white px-4 py-3 shadow-sm">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#D6C6AC] border-t-[#0D2E18]" />
                                <span className="font-sans text-sm text-[#8C7A64]">Loading menu items...</span>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoadingMenu && filteredItems.length === 0 && (
                        <div className="px-4 py-12 text-center sm:px-5 lg:px-6">
                            <div className="inline-block rounded-[14px] bg-[#FFF8EF] px-6 py-4 text-center">
                                <p className="font-sans text-sm text-[#8C7A64]">No menu items found</p>
                            </div>
                        </div>
                    )}

                    {/* Product Grid */}
                    {!isLoadingMenu && filteredItems.length > 0 && (
                        <div className="px-4 py-2 sm:px-5 lg:px-6">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                {filteredItems.map((item) => {
                                    const selectedQuantity = getSelectedQuantity(item.id);

                                    return (
                                        <article
                                            key={`${item.category}-${item.id}`}
                                            className="group flex gap-3 overflow-hidden rounded-[16px] border border-[#E6D7C0] bg-white shadow-[0_2px_8px_rgba(104,75,53,0.06)] transition-all duration-200 hover:border-[#D6C6AC] hover:shadow-[0_6px_16px_rgba(104,75,53,0.12)] hover:-translate-y-0.5 p-3"
                                        >
                                            {/* Image - Left Side, Compact */}
                                            <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-gradient-to-br from-[#F7F5F1] to-[#EFE9DF]">
                                                {item.imageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={item.imageUrl}
                                                        alt={item.name}
                                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center bg-[#E6D7C0]">
                                                        <ShoppingCart size={32} className="text-[#D6C6AC]" />
                                                    </div>
                                                )}

                                                {/* Category Badge - Top Left Corner */}
                                                <div className="absolute left-1.5 top-1.5">
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 font-sans text-xs font-bold backdrop-blur-sm ${getCategoryBadgeStyle(
                                                            item.category
                                                        )}`}
                                                    >
                                                        {formatCategory(item.category)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Content - Right Side */}
                                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                                {/* Header */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="font-sans text-sm font-bold leading-tight text-[#0D2E18]">
                                                            {item.name}
                                                        </h3>
                                                    </div>
                                                    <p className="flex-shrink-0 font-sans text-base font-bold text-[#684B35]">
                                                        ₱{formatPrice(item.price)}
                                                    </p>
                                                </div>

                                                {/* Quantity & Add Button */}
                                                <div className="mt-auto flex items-center justify-between gap-2">
                                                    {/* Quantity Controls */}
                                                    <div className="flex items-center gap-1 rounded-[10px] border border-[#D6C6AC] bg-[#FFF8EF]">
                                                        <button
                                                            type="button"
                                                            onClick={() => changeItemQuantity(item.id, -1)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#0D2E18] transition-all hover:bg-white active:bg-[#E7F4EA]"
                                                            aria-label={`Decrease ${item.name}`}
                                                        >
                                                            <Minus size={14} strokeWidth={2.5} />
                                                        </button>

                                                        <span className="w-6 text-center font-sans text-xs font-bold text-[#3C332A]">
                                                            {selectedQuantity}
                                                        </span>

                                                        <button
                                                            type="button"
                                                            onClick={() => changeItemQuantity(item.id, 1)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#0D2E18] transition-all hover:bg-white active:bg-[#E7F4EA]"
                                                            aria-label={`Increase ${item.name}`}
                                                        >
                                                            <Plus size={14} strokeWidth={2.5} />
                                                        </button>
                                                    </div>

                                                    {/* Add to Cart Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => openCustomization(item)}
                                                        disabled={selectedQuantity === 0}
                                                        className="flex-1 rounded-[10px] bg-[#0D2E18] px-3 py-2 font-sans text-xs font-bold text-[#FFF0DA] transition-all duration-200 hover:bg-[#123821] hover:shadow-md active:scale-95 disabled:bg-[#EFE3CF] disabled:text-[#8C7A64]"
                                                    >
                                                        Customize
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    </div>
                </div>

                {/* Cart Section */}
                <aside className="flex flex-col border-l border-[#E6D7C0] bg-white lg:sticky lg:top-0 lg:h-full lg:max-h-[calc(100dvh-4.5rem)] lg:self-start lg:overflow-hidden">
                    {/* Cart Header */}
                    <div className="shrink-0 border-b border-[#E6D7C0] px-3 py-2 sm:px-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="font-sans text-xs font-bold uppercase tracking-widest text-[#8C7A64]">
                                    Active Order
                                </p>
                                <h2 className="font-sans text-[1.2rem] font-bold text-[#0D2E18]">
                                    Cart
                                </h2>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#0D2E18] shadow-sm">
                                <ShoppingCart size={17} className="text-[#FFF0DA]" />
                            </div>
                        </div>
                    </div>

                    {/* Cart Content */}
                    <div className="min-w-0 flex flex-1 flex-col overflow-hidden">
                        {/* Order Type */}
                        <div className="shrink-0 border-b border-[#E6D7C0] px-3 py-2 sm:px-4">
                            <p className="mb-2 font-sans text-xs font-bold uppercase tracking-widest text-[#684B35]">
                                Delivery Type
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {(["pickup", "delivery"] as const).map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => {
                                            setOrderType(type);
                                            if (type === "delivery") {
                                                setPaymentMethod("cash");
                                            }
                                        }}
                                        className={`rounded-[10px] border-2 px-3 py-1.5 font-sans text-xs font-bold transition-all duration-200 ${
                                            orderType === type
                                                ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA] shadow-sm"
                                                : "border-[#D6C6AC] bg-white text-[#684B35] hover:border-[#0D2E18] hover:bg-[#FFF8EF]"
                                        }`}
                                    >
                                        {type === "pickup" ? "Pickup" : "Delivery"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div className="shrink-0 border-b border-[#E6D7C0] px-3 py-2 sm:px-4">
                            <label className="block">
                                <span className="font-sans text-xs font-bold uppercase tracking-widest text-[#684B35]">
                                    Customer{" "}
                                    {orderType === "pickup" && <span className="text-[#C55432]">*</span>}
                                </span>
                                <input
                                    value={walkinName}
                                    onChange={(event) => setWalkinName(event.target.value)}
                                    placeholder="Customer name"
                                    className="mt-1 w-full rounded-[10px] border-2 border-[#D6C6AC] bg-white px-3 py-1.5 font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74] transition-all focus:border-[#0D2E18] focus:shadow-sm"
                                />
                            </label>
                        </div>

                        {/* Delivery Info */}
                        {orderType === "delivery" && (
                            <div className="shrink-0 border-b border-[#E6D7C0] px-3 py-2 sm:px-4">
                                <p className="mb-2 font-sans text-xs font-bold uppercase tracking-widest text-[#684B35]">
                                    Delivery Details
                                </p>
                                <div className="space-y-1">
                                    <input
                                        value={deliveryAddress}
                                        onChange={(event) => setDeliveryAddress(event.target.value)}
                                        placeholder="Street address"
                                        required
                                        className="w-full rounded-[10px] border-2 border-[#D6C6AC] bg-white px-3 py-1.5 font-sans text-xs text-[#0D2E18] outline-none placeholder:text-[#9B8A74] transition-all focus:border-[#0D2E18] focus:shadow-sm"
                                    />
                                    <input
                                        type="tel"
                                        value={deliveryPhone}
                                        onChange={(event) => setDeliveryPhone(event.target.value)}
                                        placeholder="Phone number"
                                        required
                                        className="w-full rounded-[10px] border-2 border-[#D6C6AC] bg-white px-3 py-1.5 font-sans text-xs text-[#0D2E18] outline-none placeholder:text-[#9B8A74] transition-all focus:border-[#0D2E18] focus:shadow-sm"
                                    />
                                    <input
                                        type="email"
                                        value={deliveryEmail}
                                        onChange={(event) => setDeliveryEmail(event.target.value)}
                                        placeholder="Email (optional)"
                                        className="w-full rounded-[10px] border-2 border-[#D6C6AC] bg-white px-3 py-1.5 font-sans text-xs text-[#0D2E18] outline-none placeholder:text-[#9B8A74] transition-all focus:border-[#0D2E18] focus:shadow-sm"
                                    />
                                    <input
                                        type="number"
                                        value={deliveryFee}
                                        onChange={(event) => setDeliveryFee(Math.max(0, Number(event.target.value) || 0))}
                                        placeholder="Delivery fee"
                                        min="0"
                                        step="1"
                                        className="w-full rounded-[10px] border-2 border-[#D6C6AC] bg-white px-3 py-1.5 font-sans text-xs text-[#0D2E18] outline-none placeholder:text-[#9B8A74] transition-all focus:border-[#0D2E18] focus:shadow-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Cart Items */}
                        <div className="min-h-0 flex-1 border-b border-[#E6D7C0]">
                            {cart.length === 0 ? (
                                <div className="flex h-full items-center justify-center px-3 py-3 text-center sm:px-4">
                                    <div className="inline-block rounded-[14px] border border-dashed border-[#D6C6AC] bg-[#F7F5F1] px-4 py-3">
                                        <p className="font-sans text-xs text-[#8C7A64]">
                                            No items in cart
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full overflow-y-auto px-3 py-2 sm:px-4">
                                    <div className="space-y-1.5">
                                    {cart.map((item, index) => (
                                        <div
                                            key={`${item.id}-${item.size}-${index}`}
                                            className="flex gap-2 rounded-[10px] border-2 border-[#E6D7C0] bg-white p-2 transition-all hover:border-[#0D2E18]"
                                        >
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[#E7F4EA]">
                                                {item.imageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={item.imageUrl}
                                                        alt={item.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-5 w-5 rounded-full bg-[#D9D9D9]" />
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1 flex flex-col">
                                                <div className="flex items-start justify-between gap-1.5">
                                                    <div className="min-w-0">
                                                        <p className="font-sans text-xs font-bold leading-tight text-[#0D2E18]">
                                                            {item.name}
                                                        </p>
                                                        <p className="font-sans text-[11px] text-[#8C7A64]">
                                                            ₱{formatPrice(item.price + item.addon_price)} × {item.quantity}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCartItem(index)}
                                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[#C55432] transition-all hover:bg-[#FFF1EC]"
                                                        aria-label={`Remove ${item.name}`}
                                                    >
                                                        <Trash2 size={11} />
                                                    </button>
                                                </div>

                                                    <p className="mt-1 font-sans text-[11px] text-[#8C7A64]">
                                                        Sweetness: {formatSweetnessLabel(item.sugar_level)}
                                                    </p>
                                                    {item.addons.length > 0 ? (
                                                        <p className="mt-0.5 font-sans text-[11px] text-[#8C7A64]">
                                                            Add-ons: {item.addons.map(formatAddonLabel).join(", ")}
                                                        </p>
                                                    ) : null}

                                                <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                                                    <p className="font-sans text-xs font-bold text-[#0D2E18]">
                                                        ₱{formatPrice((item.price + item.addon_price) * item.quantity)}
                                                    </p>
                                                    <div className="flex items-center gap-0.5 rounded-[6px] border border-[#D6C6AC] bg-[#FFF8EF]">
                                                        <button
                                                            type="button"
                                                            onClick={() => changeCartQuantity(index, -1)}
                                                            className="flex h-5 w-5 items-center justify-center text-[#0D2E18] hover:bg-white"
                                                        >
                                                            <Minus size={10} strokeWidth={2.5} />
                                                        </button>
                                                        <span className="w-3 text-center font-sans text-[11px] font-bold text-[#3C332A]">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => changeCartQuantity(index, 1)}
                                                            className="flex h-5 w-5 items-center justify-center text-[#0D2E18] hover:bg-white"
                                                        >
                                                            <Plus size={10} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Payment Method (Only show if cart has items) */}
                        {cart.length > 0 && (
                            <div className="shrink-0 border-b border-[#E6D7C0] px-3 py-2 sm:px-4">
                                <p className="mb-2 font-sans text-xs font-bold uppercase tracking-widest text-[#684B35]">
                                    Payment
                                </p>
                                <div className="space-y-1.5">
                                    <div>
                                        <p className="mb-1 font-sans text-xs font-semibold text-[#684B35]">
                                            Method
                                        </p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {(orderType === "delivery"
                                                ? (["cash"] as const)
                                                : (["cash", "gcash"] as const)
                                            ).map((method) => (
                                                <button
                                                    key={method}
                                                    type="button"
                                                    onClick={() => setPaymentMethod(method)}
                                                    className={`rounded-[8px] border-2 px-2 py-1.5 font-sans text-xs font-bold transition-all duration-200 ${
                                                        paymentMethod === method
                                                            ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA] shadow-sm"
                                                            : "border-[#D6C6AC] bg-white text-[#684B35] hover:border-[#0D2E18]"
                                                    }`}
                                                >
                                                    {method === "cash" ? "Cash" : "GCash"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="mb-1 font-sans text-xs font-semibold text-[#684B35]">
                                            Status
                                        </p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {(["paid", "unpaid"] as const).map((status) => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => setPaymentStatus(status)}
                                                    className={`rounded-[8px] border-2 px-2 py-1.5 font-sans text-xs font-bold transition-all duration-200 ${
                                                        paymentStatus === status
                                                            ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA] shadow-sm"
                                                            : "border-[#D6C6AC] bg-white text-[#684B35] hover:border-[#0D2E18]"
                                                    }`}
                                                >
                                                    {status === "paid" ? "Paid" : "Unpaid"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Cart Footer */}
                    <div className="shrink-0 border-t border-[#E6D7C0] bg-[#FFF8EF] px-3 py-2 sm:px-4">
                        {/* Totals */}
                        <div className="mb-2 flex items-center justify-between gap-3 rounded-[10px] border border-[#D6C6AC] bg-white px-3 py-1.5">
                            <div>
                                <p className="font-sans text-[11px] text-[#8C7A64]">
                                    Subtotal: ₱{formatPrice(subtotal)}
                                </p>
                                {orderType === "delivery" && (
                                    <p className="font-sans text-[11px] text-[#8C7A64]">
                                        Delivery fee: ₱{formatPrice(deliveryFee)}
                                    </p>
                                )}
                                <p className="font-sans text-xs uppercase tracking-widest text-[#8C7A64]">
                                    {cartCount} item{cartCount === 1 ? "" : "s"}
                                </p>
                                <p className="font-sans text-sm font-bold text-[#0D2E18]">
                                    Total
                                </p>
                            </div>
                            <p className="font-sans text-[1.55rem] font-bold text-[#0D2E18]">
                                ₱{formatPrice(total)}
                            </p>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="button"
                            onClick={handleSubmitOrderQueue}
                            disabled={
                                cart.length === 0 ||
                                isSubmitting ||
                                !hasRequiredCustomerName ||
                                !hasRequiredDeliveryInfo
                            }
                            className="flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-[#0D2E18] bg-[#0D2E18] px-4 py-2.5 font-sans text-sm font-bold text-[#FFF0DA] transition-all duration-200 hover:bg-[#123821] hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:border-[#BFD0B8] disabled:bg-[#F7FBF5] disabled:text-[#8D9C87]"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFF0DA] border-t-transparent" />
                                    Submitting...
                                </>
                            ) : (
                                "Submit Order"
                            )}
                        </button>
                    </div>
                </aside>
            </section>

            {customizingItem ? (
                <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0D2E18]/35 px-0 backdrop-blur-md md:items-center md:px-5">
                    <button
                        type="button"
                        aria-label="Close customization modal"
                        className="absolute inset-0 cursor-default"
                        onClick={closeCustomization}
                    />

                    <section className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[30px] border border-[#DCCFB8] bg-[#FFF0DA] shadow-[0_-18px_40px_rgba(13,46,24,0.22)] md:max-w-3xl md:rounded-[30px] md:shadow-[0_24px_60px_rgba(13,46,24,0.22)]">
                        <div className="flex items-start justify-between gap-4 border-b border-[#DCCFB8] px-5 py-4 sm:px-6">
                            <div>
                                <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[#684B35]">
                                    Customize Item
                                </p>
                                <h2 className="mt-1 font-sans text-xl font-black text-[#0D2E18]">
                                    {customizingItem.name}
                                </h2>
                                <p className="mt-1 font-sans text-sm text-[#6F634E]">
                                    Add sweetness and add-ons before placing it in the cart.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeCustomization}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D6C6AC] bg-white text-[#684B35] transition hover:bg-[#FFF8EF]"
                                aria-label="Close customization modal"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                            <div className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
                                <div className="space-y-5">
                                    <section>
                                        <h3 className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#123E26]">
                                            Sweetness Level
                                        </h3>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {sweetnessLevels.map((item) => (
                                                <button
                                                    key={item.value}
                                                    type="button"
                                                    onClick={() => setCustomizingSugarLevel(item.value)}
                                                    aria-pressed={customizingSugarLevel === item.value}
                                                    className={`rounded-full border px-4 py-2.5 font-sans text-sm font-bold transition ${
                                                        customizingSugarLevel === item.value
                                                            ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8] shadow-[0_8px_18px_rgba(13,46,24,0.16)]"
                                                            : "border-[#D8C8A7] bg-white text-[#684B35]"
                                                    }`}
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#123E26]">
                                            Add-ons
                                        </h3>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            {addonOptions.map((item) => {
                                                const selected = customizingAddons.includes(item.value);

                                                return (
                                                    <button
                                                        key={item.value}
                                                        type="button"
                                                        onClick={() => toggleCustomizationAddon(item.value)}
                                                        className={`rounded-[18px] border px-4 py-4 text-left font-sans transition ${
                                                            selected
                                                                ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                                                                : "border-[#D8C8A7] bg-white text-[#684B35]"
                                                        }`}
                                                    >
                                                        <p className="font-black">{item.label}</p>
                                                        <p className="mt-1 text-xs">
                                                            +₱{formatPrice(item.price)}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </div>

                                <aside className="flex h-fit flex-col rounded-[24px] border border-[#E1D0B2] bg-white/72 p-5">
                                    <div className="space-y-3 border-b border-[#E9DCC1] pb-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-sans text-sm font-semibold text-[#6F634E]">Base Price</span>
                                            <span className="font-sans text-sm font-bold text-[#0D2E18]">₱{formatPrice(customizingItem.price)}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-sans text-sm font-semibold text-[#6F634E]">Sweetness</span>
                                            <span className="font-sans text-sm font-bold text-[#0D2E18]">{formatSweetnessLabel(customizingSugarLevel)}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-sans text-sm font-semibold text-[#6F634E]">Add-ons</span>
                                            <span className="font-sans text-sm font-bold text-[#0D2E18]">₱{formatPrice(customizingAddonTotal)}</span>
                                        </div>
                                    </div>

                                    <div className="mt-5">
                                        <p className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-[#8A755D]">
                                            Quantity
                                        </p>
                                        <div className="mt-2 inline-flex items-center rounded-full border border-[#D8C8A7] bg-[#FFF8EF] p-1">
                                            <button
                                                type="button"
                                                onClick={() => setCustomizingQuantity((current) => Math.max(1, current - 1))}
                                                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#123E26]"
                                            >
                                                <Minus size={16} />
                                            </button>
                                            <span className="min-w-12 text-center font-sans text-lg font-black">
                                                {customizingQuantity}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setCustomizingQuantity((current) => current + 1)}
                                                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#123E26]"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-6 border-t border-[#E2D6BE] pt-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-base font-semibold">Total</span>
                                            <span className="text-3xl font-black text-[#765531]">
                                                ₱{formatPrice((customizingItem.price + customizingAddonTotal) * customizingQuantity)}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={confirmCustomization}
                                        className="sticky bottom-0 mt-6 flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#123E26] px-5 py-4 text-lg font-bold text-white transition hover:opacity-95"
                                    >
                                        <ShoppingCart size={18} />
                                        Add to Cart
                                    </button>
                                </aside>
                            </div>
                        </div>
                    </section>
                </div>
            ) : null}
        </main>
    );
}

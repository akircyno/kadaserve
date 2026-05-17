"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    CreditCard,
    Minus,
    PackageCheck,
    Plus,
    ReceiptText,
    ShoppingCart,
    Trash2,
    UserRound,
    X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { EncodeOrderHeaderControls } from "./encode-order-header-controls";
import type { MenuCategory, MenuFilterCategory, StaffMenuItem } from "@/types/menu";
import type { PaymentMethod, PaymentStatus } from "@/types/orders";

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

function peso(value: number) {
    return `PHP ${formatPrice(value)}`;
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
    const { showToast } = useToast();
    const [menuItems, setMenuItems] = useState<StaffMenuItem[]>([]);
    const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<MenuFilterCategory>("all");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
    const [walkinName, setWalkinName] = useState("");
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

    const total = subtotal;

    const customizingAddonTotal = useMemo(() => {
        return customizingAddons.reduce(
            (sum, addonValue) =>
                sum + (addonOptions.find((item) => item.value === addonValue)?.price ?? 0),
            0
        );
    }, [customizingAddons]);

    const hasRequiredCustomerName = walkinName.trim().length > 0;

    const cartCount = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    }, [cart]);
    const cartQuantityByItemId = useMemo(() => {
        return cart.reduce<Record<string, number>>((items, item) => {
            items[item.id] = (items[item.id] ?? 0) + item.quantity;
            return items;
        }, {});
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
    const canSubmitOrder =
        cart.length > 0 &&
        !isSubmitting &&
        hasRequiredCustomerName;
    const visibleCategoryLabel =
        categoryButtons.find((button) => button.key === activeCategory)?.label ?? "All";
    const paymentMethodLabel =
        paymentMethod === "gcash" ? "GCash" : "Cash";
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

    const loadMenuItems = useCallback(async () => {
        setIsLoadingMenu(true);
        setError("");

        try {
            const response = await fetch("/api/staff/menu", {
                method: "GET",
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || "Failed to load menu items.");
                showToast({
                    title: "Menu not loaded",
                    description: result.error || "Failed to load menu items.",
                    variant: "error",
                });
                return;
            }

            setMenuItems(result.menuItems ?? []);
            setStaffProfile(result.staffProfile ?? null);
            setLastMenuSyncedAt(new Date());
        } catch {
            setError("Something went wrong while loading menu items.");
            showToast({
                title: "Menu not loaded",
                description: "Something went wrong while loading menu items.",
                variant: "error",
            });
        } finally {
            setIsLoadingMenu(false);
        }
    }, [showToast]);

    useEffect(() => {
        loadMenuItems();
    }, [loadMenuItems]);


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
        showToast({
            title: "Added to active order",
            description: `${customizingItem.name} was added to the staff cart.`,
            variant: "success",
        });
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
            setError("Customer name is required for walk-in order.");
            showToast({
                title: "Customer name required",
                description: "Add the customer name before submitting walk-in order.",
                variant: "error",
            });
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
                    orderType: "pickup",
                    items: cart,
                    totalAmount: total,
                    walkinName,
                    paymentMethod,
                    paymentStatus,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || "Failed to submit order.");
                showToast({
                    title: "Order not submitted",
                    description: result.error || "Failed to submit order.",
                    variant: "error",
                });
                return;
            }

            setCart([]);
            setSelectedQuantities({});
            setPaymentMethod("cash");
            setPaymentStatus("paid");
            setWalkinName("");
            setSuccessMessage(
                `Order #${result.orderId.slice(0, 8).toUpperCase()} added to queue.`
            );
            showToast({
                title: "Order added to queue",
                description: `Order #${result.orderId.slice(0, 8).toUpperCase()} is ready for staff processing.`,
                variant: "success",
            });
        } catch {
            setError("Something went wrong while submitting the order.");
            showToast({
                title: "Order not submitted",
                description: "Something went wrong while submitting the order.",
                variant: "error",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="min-h-[calc(100dvh-7rem)] bg-[#FFF0DA] text-[#0D2E18] lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
            <EncodeOrderHeaderControls
                search={search}
                onSearchChange={setSearch}
                isLoadingMenu={isLoadingMenu}
                onRefresh={loadMenuItems}
                menuSyncMeta={menuSyncMeta}
            />

            <section className="flex min-h-[calc(100dvh-7rem)] flex-col gap-4 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-0 lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
                {/* Products Section */}
                <div className="min-w-0 flex flex-1 flex-col lg:h-full lg:overflow-hidden">
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[20px] border border-[#E6D7C0] bg-[#FFF0DA] lg:rounded-none lg:border-0">
                    {/* Categories */}
                    <div className="sticky top-0 z-10 border-b border-[#E6D7C0] bg-[#FFF0DA]/95 px-4 py-3 backdrop-blur sm:px-5 lg:px-6">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#E6D7C0] bg-white px-4 shadow-[0_4px_12px_rgba(104,75,53,0.04)]">
                                <span className="font-sans text-[10px] font-black uppercase tracking-[0.14em] text-[#8C7A64]">
                                    Menu
                                </span>
                                <span className="font-sans text-base font-black text-[#0D2E18]">{menuItems.length}</span>
                            </div>
                            <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#E6D7C0] bg-white px-4 shadow-[0_4px_12px_rgba(104,75,53,0.04)]">
                                <span className="font-sans text-[10px] font-black uppercase tracking-[0.14em] text-[#8C7A64]">
                                    Showing
                                </span>
                                <span className="font-sans text-base font-black text-[#0D2E18]">{filteredItems.length}</span>
                            </div>
                            <div className="inline-flex h-10 min-w-0 max-w-full items-center gap-2 rounded-full border border-[#E6D7C0] bg-white px-4 shadow-[0_4px_12px_rgba(104,75,53,0.04)]">
                                <span className="font-sans text-[10px] font-black uppercase tracking-[0.14em] text-[#8C7A64]">
                                    Category
                                </span>
                                <span className="truncate font-sans text-sm font-black text-[#0D2E18]">{visibleCategoryLabel}</span>
                            </div>
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {categoryButtons.map((button) => (
                                <button
                                    key={button.key}
                                    type="button"
                                    onClick={() => setActiveCategory(button.key)}
                                    className={`flex h-10 flex-shrink-0 items-center gap-2 rounded-full border px-4 font-sans text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                                        activeCategory === button.key
                                            ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA] shadow-[0_4px_12px_rgba(13,46,24,0.15)]"
                                            : "border-[#D6C6AC] bg-white text-[#684B35] hover:border-[#0D2E18] hover:bg-[#FFF8EF]"
                                    }`}
                                >
                                    {button.label}
                                    <span className="rounded-full bg-current/10 px-2 py-0.5 text-xs">{categoryCounts[button.key]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="px-4 pt-2 sm:px-5 lg:px-6">
                        {error && (
                            <div className="mb-3 flex items-start gap-2 rounded-[14px] border border-[#F2C8BD] bg-[#FFF1EC] px-4 py-3 font-sans text-sm font-semibold text-[#A6422A] shadow-sm">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {successMessage && (
                            <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full border border-[#BFD1B5] bg-white px-4 py-2 font-sans text-sm font-semibold text-[#0D2E18] shadow-[0_2px_8px_rgba(13,46,24,0.08)]">
                                <CheckCircle2 className="h-4 w-4 shrink-0 fill-[#0F441D] text-white" />
                                <span>{successMessage}</span>
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
                        <div className="px-4 py-3 sm:px-5 lg:px-6">
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 min-[1720px]:grid-cols-3">
                                {filteredItems.map((item) => {
                                    const selectedQuantity = getSelectedQuantity(item.id);
                                    const cartQuantity = cartQuantityByItemId[item.id] ?? 0;
                                    const isActiveItem = selectedQuantity > 0 || cartQuantity > 0;
                                    return (
                                        <article
                                            key={`${item.category}-${item.id}`}
                                            className={`group grid min-h-[110px] grid-cols-[82px_minmax(0,1fr)] gap-3 overflow-hidden rounded-[18px] border p-3 transition-all duration-200 ${
                                                isActiveItem
                                                    ? "border-[#0D2E18] bg-[#FBFFF7] shadow-[0_10px_24px_rgba(13,46,24,0.12)]"
                                                    : "border-[#E6D7C0] bg-white shadow-[0_4px_14px_rgba(104,75,53,0.06)] hover:border-[#BDAE92] hover:shadow-[0_10px_24px_rgba(104,75,53,0.1)]"
                                            }`}
                                        >
                                            <div className="flex h-[88px] w-[82px] items-center justify-center overflow-hidden rounded-[16px] bg-[#F4EEE6]">
                                                {item.imageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={item.imageUrl}
                                                        alt={item.name}
                                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center bg-[#E6D7C0]">
                                                        <ShoppingCart size={28} className="text-[#BDAE92]" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                                                        <h3 className="min-w-0 flex-1 font-sans text-[15px] font-black leading-tight text-[#0D2E18]">
                                                            {item.name}
                                                        </h3>
                                                        <p className="shrink-0 whitespace-nowrap text-right font-sans text-sm font-black text-[#684B35]">
                                                            {peso(item.price)}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`inline-flex max-w-full rounded-full px-2.5 py-1 font-sans text-[11px] font-black leading-none ${getCategoryBadgeStyle(
                                                            item.category
                                                        )}`}
                                                    >
                                                        {formatCategory(item.category)}
                                                    </span>
                                                    {cartQuantity > 0 ? (
                                                        <span className="ml-1.5 inline-flex rounded-full bg-[#0D2E18] px-2.5 py-1 font-sans text-[11px] font-black leading-none text-[#FFF0DA]">
                                                            {cartQuantity} in cart
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div
                                                        className={`flex h-9 items-center justify-between rounded-full border px-1 transition-all ${
                                                            selectedQuantity > 0
                                                                ? "border-[#0D2E18] bg-white"
                                                                : "border-[#D6C6AC] bg-[#FFF8EF]"
                                                        }`}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => changeItemQuantity(item.id, -1)}
                                                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#0D2E18] transition-all hover:bg-white active:bg-[#E7F4EA]"
                                                            aria-label={`Decrease ${item.name}`}
                                                        >
                                                            <Minus size={14} strokeWidth={2.5} />
                                                        </button>

                                                        <span className="min-w-7 text-center font-sans text-sm font-black text-[#0D2E18]">
                                                            {selectedQuantity}
                                                        </span>

                                                        <button
                                                            type="button"
                                                            onClick={() => changeItemQuantity(item.id, 1)}
                                                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#0D2E18] transition-all hover:bg-white active:bg-[#E7F4EA]"
                                                            aria-label={`Increase ${item.name}`}
                                                        >
                                                            <Plus size={14} strokeWidth={2.5} />
                                                        </button>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => openCustomization(item)}
                                                        disabled={selectedQuantity === 0}
                                                        className="h-9 rounded-full bg-[#0D2E18] px-5 font-sans text-xs font-black text-[#FFF0DA] transition-all duration-200 hover:bg-[#123821] hover:shadow-md active:scale-95 disabled:bg-transparent disabled:px-3 disabled:text-[#8C7A64] disabled:shadow-none"
                                                    >
                                                        {selectedQuantity > 0 ? "Customize" : "Select qty"}
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
                <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-[20px] border border-[#E6D7C0] bg-white shadow-[0_12px_28px_rgba(104,75,53,0.08)] lg:h-full lg:min-h-0 lg:self-start lg:rounded-none lg:border-y-0 lg:border-r-0 lg:shadow-none">
                    {/* Cart Header */}
                    <div className="shrink-0 border-b border-[#E6D7C0] bg-[#FFF8EF] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="mt-1 font-sans text-2xl font-black text-[#0D2E18]">
                                    {cartCount} item{cartCount === 1 ? "" : "s"}
                                </h2>
                                <p className="mt-1 font-sans text-xs font-bold text-[#8C7A64]">
                                    Encoded by {staffChipLabel} - {staffRole}
                                </p>
                            </div>
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0D2E18] text-[#FFF0DA] shadow-sm">
                                <ReceiptText size={20} />
                            </div>
                        </div>
                    </div>

                    {/* Cart Content */}
                    <div className="min-w-0 flex-1 overflow-y-auto">
                        {/* Order Type */}
                        <div className="shrink-0 border-b border-[#E6D7C0] px-4 py-4">
                            <div className="rounded-[24px] border border-[#0D2E18] bg-[#0D2E18] p-3 font-sans text-[#FFF0DA] shadow-[0_10px_22px_rgba(13,46,24,0.16)]">
                                <PackageCheck size={18} />
                                <p className="mt-2 text-sm font-black">Walk-in</p>
                                <p className="mt-0.5 text-xs font-semibold opacity-75">
                                    Counter order
                                </p>
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div className="shrink-0 border-b border-[#E6D7C0] px-4 py-4">
                            <label className="block">
                                <span className="flex items-center gap-2 font-sans text-xs font-black uppercase tracking-[0.16em] text-[#684B35]">
                                    <UserRound size={14} />
                                    Customer Name <span className="text-[#C55432]">*</span>
                                </span>
                                <input
                                    value={walkinName}
                                    onChange={(event) => setWalkinName(event.target.value)}
                                    placeholder="Customer name"
                                    className="mt-2 h-11 w-full rounded-[18px] border border-[#D6C6AC] bg-white px-3 font-sans text-sm font-bold text-[#0D2E18] outline-none placeholder:text-[#9B8A74] transition-all focus:border-[#0D2E18] focus:ring-2 focus:ring-[#0D2E18]/10"
                                />
                            </label>
                        </div>

                        {/* Cart Items */}
                        <div className="border-b border-[#E6D7C0]">
                            {cart.length === 0 ? (
                                <div className="flex h-full min-h-[220px] items-center justify-center px-3 py-3 text-center sm:px-4">
                                    <div className="w-full max-w-[260px] rounded-[24px] border border-dashed border-[#D6C6AC] bg-[#FFF8EF] px-4 py-8">
                                        <ShoppingCart className="mx-auto h-6 w-6 text-[#BDAE92]" />
                                        <p className="mt-2 font-sans text-sm font-black text-[#0D2E18]">
                                            Cart is empty
                                        </p>
                                        <p className="mt-1 font-sans text-xs font-semibold text-[#8C7A64]">
                                            Add quantities from the menu, then customize.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="max-h-[220px] overflow-y-auto px-4 py-4">
                                    <div className="space-y-2">
                                    {cart.map((item, index) => (
                                        <div
                                            key={`${item.id}-${item.size}-${index}`}
                                            className="flex gap-3 rounded-[20px] border border-[#E6D7C0] bg-white p-3 transition-all hover:border-[#0D2E18]"
                                        >
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#E7F4EA]">
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
                                                        <p className="line-clamp-2 font-sans text-sm font-black leading-tight text-[#0D2E18]">
                                                            {item.name}
                                                        </p>
                                                        <p className="font-sans text-[11px] text-[#8C7A64]">
                                                            {peso(item.price + item.addon_price)} x {item.quantity}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCartItem(index)}
                                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#F2C8BD] bg-[#FFF1EC] text-[#A6422A] transition-all hover:bg-[#FFE2D9]"
                                                        aria-label={`Remove ${item.name}`}
                                                    >
                                                        <Trash2 size={14} />
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
                                                    <p className="font-sans text-base font-black text-[#0D2E18]">
                                                        {peso((item.price + item.addon_price) * item.quantity)}
                                                    </p>
                                                    <div className="flex h-8 items-center gap-0.5 rounded-full border border-[#D6C6AC] bg-[#FFF8EF] p-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => changeCartQuantity(index, -1)}
                                                            className="flex h-6 w-6 items-center justify-center rounded-full text-[#0D2E18] hover:bg-white"
                                                        >
                                                            <Minus size={10} strokeWidth={2.5} />
                                                        </button>
                                                        <span className="w-3 text-center font-sans text-[11px] font-bold text-[#3C332A]">
                                                            {item.quantity}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => changeCartQuantity(index, 1)}
                                                            className="flex h-6 w-6 items-center justify-center rounded-full text-[#0D2E18] hover:bg-white"
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
                            <div className="shrink-0 border-b border-[#E6D7C0] px-4 py-4">
                                <p className="mb-2 flex items-center gap-2 font-sans text-xs font-black uppercase tracking-[0.16em] text-[#684B35]">
                                    <CreditCard size={14} />
                                    Payment
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <p className="mb-1 font-sans text-xs font-semibold text-[#684B35]">
                                            Method
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(["cash", "gcash"] as const).map((method) => (
                                                <button
                                                    key={method}
                                                    type="button"
                                                    onClick={() => setPaymentMethod(method)}
                                                    className={`rounded-[20px] border px-3 py-3 text-left font-sans transition-all duration-200 ${
                                                        paymentMethod === method
                                                            ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA] shadow-sm"
                                                            : "border-[#D6C6AC] bg-white text-[#684B35] hover:border-[#0D2E18]"
                                                    }`}
                                                >
                                                    <p className="text-sm font-black">
                                                        {method === "cash" ? "Cash" : "GCash"}
                                                    </p>
                                                    <p className="mt-0.5 text-xs font-semibold opacity-75">
                                                        {method === "cash"
                                                            ? "Counter payment"
                                                            : "Digital wallet"}
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="mb-1 font-sans text-xs font-semibold text-[#684B35]">
                                            Status
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(["paid", "unpaid"] as const).map((status) => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => setPaymentStatus(status)}
                                                    className={`rounded-[20px] border px-3 py-2.5 font-sans text-sm font-black transition-all duration-200 ${
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
                    <div className="shrink-0 border-t border-[#E6D7C0] bg-[#FFF8EF] px-4 py-4">
                        {/* Totals */}
                        <div className="mb-3 rounded-[16px] border border-[#D6C6AC] bg-white p-4">
                            <div className="space-y-2 border-b border-[#EFE3CF] pb-3">
                                <p className="flex items-center justify-between font-sans text-sm font-bold text-[#684B35]">
                                    <span>Items subtotal</span>
                                    <span>{peso(subtotal)}</span>
                                </p>
                                <p className="hidden font-sans text-[11px] text-[#8C7A64]">
                                    Subtotal: {peso(subtotal)}
                                </p>
                                <p className="flex items-center justify-between font-sans text-sm font-bold text-[#684B35]">
                                    <span>Payment</span>
                                    <span className="text-right">{paymentMethodLabel} - {paymentStatus}</span>
                                </p>
                            </div>
                            <div className="mt-3 flex items-end justify-between gap-3">
                                <div>
                                    <p className="font-sans text-[10px] font-black uppercase tracking-[0.18em] text-[#8C7A64]">
                                        Grand Total
                                    </p>
                                    <p className="font-sans text-sm font-bold text-[#684B35]">
                                        Walk-in order
                                    </p>
                                </div>
                                <p className="font-sans text-3xl font-black text-[#0D2E18]">
                                    {peso(total)}
                                </p>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="button"
                            onClick={handleSubmitOrderQueue}
                            disabled={!canSubmitOrder}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0D2E18] px-4 font-sans text-sm font-black text-[#FFF0DA] transition-all duration-200 hover:bg-[#123821] hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:bg-[#DCE8D7] disabled:text-[#75836F]"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FFF0DA] border-t-transparent" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <PackageCheck size={17} />
                                    Submit Order
                                </>
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

                    <section className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-[#DCCFB8] bg-[#FFF8EF] shadow-[0_-18px_40px_rgba(13,46,24,0.22)] md:max-w-3xl md:rounded-[28px] md:shadow-[0_24px_60px_rgba(13,46,24,0.22)]">
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
                                                        className={`rounded-[22px] border px-4 py-4 text-left font-sans transition ${
                                                            selected
                                                                ? "border-[#123E26] bg-[#123E26] text-[#FFF0D8]"
                                                                : "border-[#D8C8A7] bg-white text-[#684B35]"
                                                        }`}
                                                    >
                                                        <p className="font-black">{item.label}</p>
                                                        <p className="mt-1 text-xs">
                                                            +{peso(item.price)}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </div>

                                <aside className="flex h-fit flex-col rounded-[24px] border border-[#E1D0B2] bg-white p-5">
                                    <div className="space-y-3 border-b border-[#E9DCC1] pb-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-sans text-sm font-semibold text-[#6F634E]">Base Price</span>
                                            <span className="font-sans text-sm font-bold text-[#0D2E18]">{peso(customizingItem.price)}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-sans text-sm font-semibold text-[#6F634E]">Sweetness</span>
                                            <span className="font-sans text-sm font-bold text-[#0D2E18]">{formatSweetnessLabel(customizingSugarLevel)}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-sans text-sm font-semibold text-[#6F634E]">Add-ons</span>
                                            <span className="font-sans text-sm font-bold text-[#0D2E18]">{peso(customizingAddonTotal)}</span>
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
                                                {peso((customizingItem.price + customizingAddonTotal) * customizingQuantity)}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={confirmCustomization}
                                        className="sticky bottom-0 mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#123E26] px-5 py-4 text-lg font-bold text-white transition hover:opacity-95"
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

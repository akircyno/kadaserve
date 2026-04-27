"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, RefreshCw, Search, ShoppingCart, Trash2 } from "lucide-react";
import type { MenuCategory, MenuFilterCategory, StaffMenuItem } from "@/types/menu";
import type { OrderType, PaymentMethod, PaymentStatus } from "@/types/orders";

type Size = "regular";

type CartItem = {
    id: string;
    name: string;
    price: number;
    category: MenuCategory;
    imageUrl: string | null;
    size: Size;
    quantity: number;
};

const categoryButtons: Array<{ key: MenuFilterCategory; label: string }> = [
    { key: "all", label: "All" },
    { key: "non-coffee", label: "Non-Coffee" },
    { key: "pastries", label: "Pastries" },
    { key: "latte-series", label: "Latte Series" },
    { key: "premium-blends", label: "Premium Blends" },
    { key: "best-deals", label: "Best Deals" },
];

function formatPrice(value: number) {
    return Math.round(value);
}

function formatCategory(category: MenuCategory) {
    switch (category) {
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


function getCategoryBadgeStyle(category: MenuCategory) {
    switch (category) {
        case "non-coffee":
            return "bg-[#E7F4EA] text-[#0F441D]";
        case "pastries":
            return "bg-[#FFF0E5] text-[#B76522]";
        case "latte-series":
            return "bg-[#F1E3FF] text-[#7A3FB4]";
        case "premium-blends":
            return "bg-[#E8F0FF] text-[#2454C5]";
        case "best-deals":
            return "bg-[#FFF0DA] text-[#684B35]";
        default:
            return "bg-[#F4EEE6] text-[#684B35]";
    }
}

export function StaffEncodeOrder() {
    const [menuItems, setMenuItems] = useState<StaffMenuItem[]>([]);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState<MenuFilterCategory>("all");
    const [orderType, setOrderType] = useState<OrderType>("pickup");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
    const [walkinName, setWalkinName] = useState("");
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [deliveryEmail, setDeliveryEmail] = useState("");
    const [deliveryPhone, setDeliveryPhone] = useState("");
    const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isLoadingMenu, setIsLoadingMenu] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
                "non-coffee": 0,
                pastries: 0,
                "latte-series": 0,
                "premium-blends": 0,
                "best-deals": 0,
            }
        );
    }, [menuItems]);

    const total = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }, [cart]);

    const hasRequiredDeliveryInfo =
        orderType !== "delivery" ||
        (deliveryAddress.trim().length > 0 && deliveryPhone.trim().length > 0);

    const cartCount = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    }, [cart]);

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

    function addToCart(item: StaffMenuItem) {
        const quantity = getSelectedQuantity(item.id);
        const size: Size = "regular";

        if (quantity <= 0) return;

        setCart((prev) => {
            const existingIndex = prev.findIndex(
                (cartItem) => cartItem.id === item.id && cartItem.size === size
            );

            if (existingIndex >= 0) {
                const next = [...prev];

                next[existingIndex] = {
                    ...next[existingIndex],
                    quantity: next[existingIndex].quantity + quantity,
                };

                return next;
            }

            return [
                ...prev,
                {
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    category: item.category,
                    imageUrl: item.imageUrl,
                    size,
                    quantity,
                },
            ];
        });

        setSelectedQuantities((prev) => ({
            ...prev,
            [item.id]: 0,
        }));
        setSuccessMessage("");
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
        <main className="min-h-screen bg-[#FFF0DA] text-[#0D2E18]">
            <header className="border-b border-[#DCCFB8] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                    <label className="flex w-full max-w-[520px] items-center gap-3 rounded-full border border-[#BFD0B8] bg-[#F7FBF5] px-5 py-3">
                        <Search size={18} className="text-[#6F7F69]" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search menu items..."
                            className="w-full bg-transparent font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#8D9C87]"
                        />
                    </label>

                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={loadMenuItems}
                            disabled={isLoadingMenu}
                            className="inline-flex items-center gap-2 rounded-full border border-[#BFD0B8] bg-[#F7FBF5] px-5 py-3 font-sans text-sm font-semibold text-[#0D2E18] transition hover:bg-[#EDF6EA] disabled:opacity-60"
                        >
                            <RefreshCw size={16} />
                            {isLoadingMenu ? "Loading..." : "Refresh Menu"}
                        </button>

                        <div className="hidden items-center gap-3 sm:flex">
                            <div className="h-11 w-11 rounded-full bg-[#D9D9D9]" />
                            <div className="font-sans">
                                <p className="text-sm font-semibold text-[#3C332A]">
                                    Chrizelda P. Norial
                                </p>
                                <p className="text-[11px] text-[#8C7A64]">
                                    chrizeldanorial@gmail.com
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <section className="grid min-h-[calc(100vh-77px)] xl:grid-cols-[minmax(0,1fr)_370px]">
                <div className="min-w-0 px-6 py-6">
                    <div className="flex flex-wrap gap-3">
                        {categoryButtons.map((button) => (
                            <button
                                key={button.key}
                                type="button"
                                onClick={() => setActiveCategory(button.key)}
                                className={`rounded-full border px-5 py-2.5 font-sans text-sm font-semibold transition ${activeCategory === button.key
                                    ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                                    : "border-[#D6C6AC] bg-[#FFF8EF] text-[#684B35] hover:border-[#0D2E18]"
                                    }`}
                            >
                                {button.label}
                                <span className="ml-2 opacity-70">{categoryCounts[button.key]}</span>
                            </button>
                        ))}
                    </div>

                    {error ? (
                        <div className="mt-5 rounded-[18px] bg-[#FFF1EC] px-5 py-4 font-sans text-sm text-[#9C543D]">
                            {error}
                        </div>
                    ) : null}

                    {successMessage ? (
                        <div className="mt-5 rounded-[18px] border border-[#0F441D]/20 bg-white px-5 py-4 font-sans text-sm font-semibold text-[#0D2E18] shadow-[0_8px_20px_rgba(13,46,24,0.08)]">
                            {successMessage}
                        </div>
                    ) : null}


                    {isLoadingMenu ? (
                        <div className="mt-6 rounded-[22px] border border-[#D8C6A8] bg-white p-6 font-sans text-sm text-[#8C7A64]">
                            Loading menu items...
                        </div>
                    ) : null}

                    {!isLoadingMenu && filteredItems.length === 0 ? (
                        <div className="mt-6 rounded-[22px] border border-dashed border-[#D8C6A8] bg-[#FFF8EF] p-8 text-center font-sans text-sm text-[#8C7A64]">
                            No menu items found.
                        </div>
                    ) : null}

                    <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {filteredItems.map((item) => {
                            const selectedQuantity = getSelectedQuantity(item.id);

                            return (
                                <article
                                    key={`${item.category}-${item.id}`}
                                    className="group rounded-[24px] border border-[#D8C6A8] bg-white p-4 shadow-[0_8px_20px_rgba(104,75,53,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(104,75,53,0.12)]"
                                >
                                    <div className="flex gap-4">
                                        <div className="flex h-[112px] w-[112px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-[#E7F4EA]">
                                            {item.imageUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.name}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="h-12 w-12 rounded-full bg-[#D9D9D9]" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <span
                                                    className={`rounded-full px-3 py-1 font-sans text-[11px] font-semibold ${getCategoryBadgeStyle(
                                                        item.category
                                                    )}`}
                                                >
                                                    {formatCategory(item.category)}
                                                </span>

                                                <p className="font-sans text-lg font-bold text-[#684B35]">
                                                    {"\u20B1"}
                                                    {formatPrice(item.price)}
                                                </p>
                                            </div>

                                            <h2 className="mt-3 font-sans text-2xl font-bold leading-tight text-[#0D2E18]">
                                                {item.name}
                                            </h2>

                                            <div className="mt-4 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 rounded-full border border-[#D6C6AC] bg-[#FFF8EF] p-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => changeItemQuantity(item.id, -1)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0D2E18] transition hover:bg-[#E7F4EA]"
                                                        aria-label={`Decrease ${item.name}`}
                                                    >
                                                        <Minus size={14} />
                                                    </button>

                                                    <span className="min-w-[28px] text-center font-sans text-sm font-bold text-[#3C332A]">
                                                        {selectedQuantity}
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() => changeItemQuantity(item.id, 1)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0D2E18] transition hover:bg-[#E7F4EA]"
                                                        aria-label={`Increase ${item.name}`}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => addToCart(item)}
                                                    disabled={selectedQuantity === 0}
                                                    className="min-w-[84px] rounded-full bg-[#0D2E18] px-4 py-2.5 font-sans text-sm font-semibold text-[#FFF0DA] transition hover:bg-[#123821] disabled:cursor-not-allowed disabled:bg-[#EFE3CF] disabled:text-[#8C7A64]"
                                                >
                                                    Add
                                                </button>

                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>

                <aside className="border-t border-[#D8C6A8] bg-white px-5 py-5 xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto xl:border-l xl:border-t-0">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="font-sans text-sm uppercase tracking-[0.14em] text-[#8C7A64]">
                                Staff Cart
                            </p>
                            <h2 className="font-sans text-3xl font-bold text-[#684B35]">
                                Cart
                            </h2>
                        </div>

                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E7F4EA] text-[#0D2E18]">
                            <ShoppingCart size={22} />
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
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
                                className={`rounded-[16px] border px-4 py-3 font-sans text-sm font-semibold transition ${orderType === type
                                    ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                                    : "border-[#0D2E18] bg-white text-[#0D2E18] hover:bg-[#F7FBF5]"
                                    }`}
                            >
                                {type === "pickup" ? "Walk-in Pickup" : "Delivery"}
                            </button>
                        ))}
                    </div>

                    <label className="mt-4 block">
                        <span className="font-sans text-sm font-semibold text-[#684B35]">
                            Customer name
                        </span>
                        <input
                            value={walkinName}
                            onChange={(event) => setWalkinName(event.target.value)}
                            placeholder="Walk-in Customer"
                            className="mt-2 w-full rounded-[14px] border border-[#D6C6AC] bg-[#FFF8EF] px-4 py-3 font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                        />
                    </label>

                    {orderType === "delivery" ? (
                        <div className="mt-4 space-y-3 rounded-[18px] border border-[#DCCFB8] bg-[#FFF8EF] p-4">
                            <p className="font-sans text-sm font-semibold uppercase tracking-[0.12em] text-[#684B35]">
                                Delivery Info
                            </p>

                            <label className="block">
                                <span className="font-sans text-sm font-semibold text-[#684B35]">
                                    Address <span className="text-[#C55432]">*</span>
                                </span>
                                <input
                                    value={deliveryAddress}
                                    onChange={(event) => setDeliveryAddress(event.target.value)}
                                    placeholder="Customer delivery address"
                                    required={orderType === "delivery"}
                                    className="mt-2 w-full rounded-[14px] border border-[#D6C6AC] bg-white px-4 py-3 font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                                />
                            </label>

                            <label className="block">
                                <span className="font-sans text-sm font-semibold text-[#684B35]">
                                    Email <span className="text-[#8C7A64]">(optional)</span>
                                </span>
                                <input
                                    type="email"
                                    value={deliveryEmail}
                                    onChange={(event) => setDeliveryEmail(event.target.value)}
                                    placeholder="customer@email.com"
                                    className="mt-2 w-full rounded-[14px] border border-[#D6C6AC] bg-white px-4 py-3 font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                                />
                            </label>

                            <label className="block">
                                <span className="font-sans text-sm font-semibold text-[#684B35]">
                                    Phone <span className="text-[#C55432]">*</span>
                                </span>
                                <input
                                    type="tel"
                                    value={deliveryPhone}
                                    onChange={(event) => setDeliveryPhone(event.target.value)}
                                    placeholder="09xxxxxxxxx"
                                    required={orderType === "delivery"}
                                    className="mt-2 w-full rounded-[14px] border border-[#D6C6AC] bg-white px-4 py-3 font-sans text-sm text-[#0D2E18] outline-none placeholder:text-[#9B8A74]"
                                />
                            </label>
                            <p className="font-sans text-xs text-[#8C7A64]">
                                Address and phone are required for delivery.
                                Email can be added if the customer wants a
                                digital contact record.
                            </p>
                        </div>
                    ) : null}

                    {cart.length > 0 ? (
                    <div className="mt-4 space-y-3 rounded-[18px] border border-[#DCCFB8] bg-[#FFF8EF] p-4">
                        <p className="font-sans text-sm font-semibold uppercase tracking-[0.12em] text-[#684B35]">
                            Payment
                        </p>

                        <div>
                            <p className="font-sans text-sm font-semibold text-[#684B35]">
                                Method
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                {(orderType === "delivery"
                                    ? (["cash"] as const)
                                    : (["cash", "gcash"] as const)
                                ).map((method) => (
                                    <button
                                        key={method}
                                        type="button"
                                        onClick={() => setPaymentMethod(method)}
                                        className={`rounded-full border px-4 py-2.5 font-sans text-sm font-semibold transition ${paymentMethod === method
                                            ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                                            : "border-[#D6C6AC] bg-white text-[#684B35]"
                                            }`}
                                    >
                                        {method === "cash" ? "Cash" : "GCash"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="font-sans text-sm font-semibold text-[#684B35]">
                                Status
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                {(["paid", "unpaid"] as const).map((status) => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => setPaymentStatus(status)}
                                        className={`rounded-full border px-4 py-2.5 font-sans text-sm font-semibold transition ${paymentStatus === status
                                            ? "border-[#0D2E18] bg-[#0D2E18] text-[#FFF0DA]"
                                            : "border-[#D6C6AC] bg-white text-[#684B35]"
                                            }`}
                                    >
                                        {status === "paid" ? "Paid" : "Unpaid"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    ) : null}


                    <div className="mt-5 space-y-4">
                        {cart.length === 0 ? (
                            <div className="rounded-[20px] border border-dashed border-[#D8C6A8] bg-[#FFF7E9] px-4 py-8 text-center font-sans text-sm text-[#8C7A64]">
                                No items in cart yet
                            </div>
                        ) : null}

                        {cart.map((item, index) => (
                            <div
                                key={`${item.id}-${item.size}-${index}`}
                                className="rounded-[20px] border border-[#E6D7C0] bg-[#FFF8EF] p-4"
                            >
                                <div className="flex gap-3">
                                    <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-[#E7F4EA]">
                                        {item.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={item.imageUrl}
                                                alt={item.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-[#D9D9D9]" />
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-sans text-lg font-bold leading-tight text-[#0D2E18]">
                                                    {item.name}
                                                </p>
                                                <p className="mt-1 font-sans text-sm text-[#8C7A64]">
                                                    Qty x {item.quantity}

                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeCartItem(index)}
                                                className="rounded-full p-1.5 text-[#C55432] transition hover:bg-[#FFF1EC]"
                                                aria-label={`Remove ${item.name} from cart`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between gap-3">
                                            <p className="font-sans text-xl font-bold text-[#684B35]">
                                                {"\u20B1"}
                                                {formatPrice(item.price * item.quantity)}
                                            </p>

                                            <div className="flex items-center gap-2 rounded-full border border-[#D6C6AC] bg-white p-1">
                                                <button
                                                    type="button"
                                                    onClick={() => changeCartQuantity(index, -1)}
                                                    className="flex h-7 w-7 items-center justify-center rounded-full text-[#0D2E18] transition hover:bg-[#E7F4EA]"
                                                    aria-label={`Decrease ${item.name} in cart`}
                                                >
                                                    <Minus size={13} />
                                                </button>

                                                <span className="min-w-[22px] text-center font-sans text-sm font-bold text-[#3C332A]">
                                                    {item.quantity}
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={() => changeCartQuantity(index, 1)}
                                                    className="flex h-7 w-7 items-center justify-center rounded-full text-[#0D2E18] transition hover:bg-[#E7F4EA]"
                                                    aria-label={`Increase ${item.name} in cart`}
                                                >
                                                    <Plus size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 border-t border-[#E6D7C0] pt-5">
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <p className="font-sans text-sm uppercase tracking-[0.14em] text-[#8C7A64]">
                                    {cartCount} item{cartCount === 1 ? "" : "s"}
                                </p>
                                <p className="font-sans text-2xl font-bold text-[#3C332A]">
                                    Total
                                </p>
                            </div>

                            <p className="font-sans text-4xl font-bold text-[#0D2E18]">
                                {"\u20B1"}
                                {formatPrice(total)}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleSubmitOrderQueue}
                            disabled={
                                cart.length === 0 ||
                                isSubmitting ||
                                !hasRequiredDeliveryInfo
                            }
                            className="mt-5 w-full rounded-[16px] border border-[#0D2E18] bg-[#0D2E18] px-4 py-4 font-sans text-base font-bold text-[#FFF0DA] transition hover:bg-[#123821] disabled:cursor-not-allowed disabled:border-[#BFD0B8] disabled:bg-[#F7FBF5] disabled:text-[#8D9C87]"
                        >
                            {isSubmitting ? "Submitting..." : "Submit Order Queue"}
                        </button>
                    </div>
                </aside>
            </section>
        </main>
    );
}

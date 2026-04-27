"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Minus, Plus, ShoppingCart } from "lucide-react";
import { useCart } from "@/features/customer/providers/cart-provider";
import type { CustomizableMenuItem } from "@/types/menu";

type CustomizeOrderProps = {
  menuItem: CustomizableMenuItem;
};

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

const addons = [
  { label: "Extra Sugar", value: "extra_sugar", price: 10 },
  { label: "Extra Coffee", value: "extra_coffee", price: 20 },
  { label: "Extra Milk", value: "extra_milk", price: 15 },
  { label: "Vanilla Syrup", value: "vanilla_syrup", price: 15 },
  { label: "Caramel Syrup", value: "caramel_syrup", price: 15 },
  { label: "Hazelnut Syrup", value: "hazelnut_syrup", price: 15 },
  { label: "Chocolate Syrup", value: "chocolate_syrup", price: 15 },
];

function peso(value: number) {
  return `₱${Math.round(value)}`;
}

function getEmoji(name: string, category: string) {
  const text = `${name} ${category}`.toLowerCase();

  if (text.includes("matcha")) return "🍵";
  if (text.includes("strawberry")) return "🍓";
  if (text.includes("mocha") || text.includes("chocolate")) return "🍫";
  if (text.includes("tea")) return "🧋";
  return "☕";
}

export function CustomizeOrder({ menuItem }: CustomizeOrderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addItem, updateItem, getItemById } = useCart();

  const cartItemId = searchParams.get("cartItemId");
  const editingItem = cartItemId ? getItemById(cartItemId) : undefined;
  const isEditing = Boolean(editingItem);

  const [quantity, setQuantity] = useState(1);
  const [sugarLevel, setSugarLevel] = useState(50);
  const [iceLevel, setIceLevel] = useState("regular");
  const [size, setSize] = useState("medium");
  const [temperature, setTemperature] = useState("iced");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [addedMessage, setAddedMessage] = useState("");

  useEffect(() => {
    if (!editingItem) return;

    startTransition(() => {
      setQuantity(editingItem.quantity);
      setSugarLevel(editingItem.sugar_level);
      setIceLevel(editingItem.ice_level ?? "regular");
      setSize(editingItem.size);
      setTemperature(editingItem.temperature);
      setSelectedAddons(editingItem.addons);
      setSpecialInstructions(editingItem.special_instructions);
    });
  }, [editingItem]);

  const selectedSize = sizes.find((item) => item.value === size);
  const selectedAddonRows = addons.filter((item) =>
    selectedAddons.includes(item.value)
  );

  const addonTotal = selectedAddonRows.reduce((sum, item) => sum + item.price, 0);
  const sizeCharge = selectedSize?.price ?? 0;

  const total = useMemo(() => {
    return (menuItem.base_price + addonTotal + sizeCharge) * quantity;
  }, [addonTotal, menuItem.base_price, quantity, sizeCharge]);

  function toggleAddon(value: string) {
    setSelectedAddons((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function handleSaveCartItem() {
    const payload = {
      menu_item_id: menuItem.id,
      name: menuItem.name,
      base_price: menuItem.base_price,
      quantity,
      sugar_level: sugarLevel,
      ice_level: menuItem.has_ice_level ? iceLevel : null,
      size,
      temperature,
      addons: selectedAddons,
      addon_price: addonTotal + sizeCharge,
      special_instructions: specialInstructions.trim(),
      image_url: menuItem.image_url,
    };

    if (isEditing && cartItemId) {
      updateItem(cartItemId, payload);
      setAddedMessage("Cart item updated successfully.");
    } else {
      addItem(payload);
      setAddedMessage("Added to cart successfully.");
    }

    setTimeout(() => {
      router.push("/customer/cart");
    }, 700);
  }

  return (
    <main className="min-h-screen bg-[#F8EBCF] px-4 py-6 text-[#123E26]">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/customer"
          className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#0B3F22] px-4 py-2 text-sm font-semibold text-[#FFF0D8]"
        >
          <ArrowLeft size={16} />
          Back to Menu
        </Link>

        <section className="overflow-hidden rounded-[32px] border border-[#D8C8A7] bg-[#FAECD3] shadow-[0_20px_60px_rgba(11,46,24,0.16)]">
          <div className="border-b border-[#DECFAF] px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-[24px] bg-[#E7F1E6] text-6xl sm:w-48">
                {menuItem.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={menuItem.image_url}
                    alt={menuItem.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getEmoji(menuItem.name, menuItem.category)
                )}
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6D7A61]">
                  {isEditing ? "Edit Cart Item" : "Customize Order"}
                </p>
                <h1 className="mt-2 text-4xl font-black tracking-tight">
                  {menuItem.name}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#6F634E]">
                  {menuItem.description ?? "Freshly prepared drink."}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-3xl font-black text-[#765531]">
                    {peso(menuItem.base_price)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
                      menuItem.is_available
                        ? "bg-[#E9F5E7] text-[#2D7A40]"
                        : "bg-[#FBE9E2] text-[#9C543D]"
                    }`}
                  >
                    {menuItem.is_available ? "Available" : "Unavailable"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-6">
              {menuItem.has_sugar_level && (
                <div>
                  <h2 className="text-lg font-bold">Sugar Level</h2>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {sugarLevels.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setSugarLevel(item.value)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          sugarLevel === item.value
                            ? "border-[#123E26] bg-[#123E26] text-[#FFF1D8]"
                            : "border-[#708061] bg-white/60 text-[#26402F]"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {menuItem.has_ice_level && (
                <div>
                  <h2 className="text-lg font-bold">Ice Level</h2>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {iceLevels.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setIceLevel(item.value)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          iceLevel === item.value
                            ? "border-[#123E26] bg-[#123E26] text-[#FFF1D8]"
                            : "border-[#708061] bg-white/60 text-[#26402F]"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {menuItem.has_size_option && (
                <div>
                  <h2 className="text-lg font-bold">Size</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {sizes.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setSize(item.value)}
                        className={`rounded-[18px] border px-4 py-4 text-left transition ${
                          size === item.value
                            ? "border-[#123E26] bg-[#123E26] text-[#FFF1D8]"
                            : "border-[#708061] bg-white/60 text-[#26402F]"
                        }`}
                      >
                        <p className="font-bold">{item.label}</p>
                        <p className="mt-1 text-sm">
                          {item.price > 0 ? `+${peso(item.price)}` : "No extra charge"}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {menuItem.has_temp_option && (
                <div>
                  <h2 className="text-lg font-bold">Temperature</h2>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {temperatures.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setTemperature(item.value)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          temperature === item.value
                            ? "border-[#123E26] bg-[#123E26] text-[#FFF1D8]"
                            : "border-[#708061] bg-white/60 text-[#26402F]"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-lg font-bold">Add-ons</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {addons.map((item) => {
                    const selected = selectedAddons.includes(item.value);

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => toggleAddon(item.value)}
                        className={`rounded-[18px] border px-4 py-4 text-left transition ${
                          selected
                            ? "border-[#123E26] bg-[#123E26] text-[#FFF1D8]"
                            : "border-[#708061] bg-white/60 text-[#26402F]"
                        }`}
                      >
                        <p className="font-bold">{item.label}</p>
                        <p className="mt-1 text-sm">+{peso(item.price)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold">Special Instructions</h2>
                <textarea
                  value={specialInstructions}
                  onChange={(event) => setSpecialInstructions(event.target.value)}
                  placeholder="Add a note for your order"
                  className="mt-3 min-h-28 w-full rounded-[20px] border border-[#CDBD9E] bg-white/70 px-4 py-3 outline-none placeholder:text-[#8D856F]"
                />
              </div>
            </div>

            <aside className="h-fit rounded-[24px] border border-[#D9C9A7] bg-white/70 p-5">
              <h2 className="text-xl font-black">Order Summary</h2>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-[#6F634E]">Base Price</span>
                <span className="font-bold">{peso(menuItem.base_price)}</span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-[#6F634E]">Size Charge</span>
                <span className="font-bold">{peso(sizeCharge)}</span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-[#6F634E]">Add-ons</span>
                <span className="font-bold">{peso(addonTotal)}</span>
              </div>

              <div className="mt-5">
                <p className="text-sm font-semibold text-[#6F634E]">Quantity</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#123E26] text-white"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="min-w-10 text-center text-xl font-black">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => current + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#123E26] text-white"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-6 border-t border-[#E2D6BE] pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">Total</span>
                  <span className="text-3xl font-black text-[#765531]">
                    {peso(total)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveCartItem}
                disabled={!menuItem.is_available}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#123E26] px-5 py-4 text-lg font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingCart size={18} />
                {isEditing ? "Update Cart" : "Add to Cart"}
              </button>

              {addedMessage ? (
                <p className="mt-3 text-sm font-semibold text-[#2D7A40]">
                  {addedMessage}
                </p>
              ) : null}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { CartItem } from "@/types/cart";
export type { CartItem } from "@/types/cart";

type AddCartItemInput = Omit<CartItem, "id">;

type UpdateCartItemInput = Omit<CartItem, "id">;

type CartContextValue = {
  items: CartItem[];
  cartCount: number;
  addItem: (item: AddCartItemInput) => void;
  updateItem: (id: string, updates: UpdateCartItemInput) => void;
  getItemById: (id: string) => CartItem | undefined;
  removeItem: (id: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const STORAGE_KEY = "kadaserve-cart";

function readStoredItems() {
  if (typeof window === "undefined") {
    return [];
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildSignature(item: AddCartItemInput) {
  return JSON.stringify({
    menu_item_id: item.menu_item_id,
    sugar_level: item.sugar_level,
    ice_level: item.ice_level,
    size: item.size,
    temperature: item.temperature,
    addons: [...item.addons].sort(),
    special_instructions: item.special_instructions.trim(),
  });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readStoredItems());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  function addItem(item: AddCartItemInput) {
    setItems((current) => {
      const incomingSignature = buildSignature(item);

      const existingIndex = current.findIndex(
        (currentItem) =>
          buildSignature({
            menu_item_id: currentItem.menu_item_id,
            name: currentItem.name,
            base_price: currentItem.base_price,
            quantity: currentItem.quantity,
            sugar_level: currentItem.sugar_level,
            ice_level: currentItem.ice_level,
            size: currentItem.size,
            temperature: currentItem.temperature,
            addons: currentItem.addons,
            addon_price: currentItem.addon_price,
            special_instructions: currentItem.special_instructions,
            image_url: currentItem.image_url,
          }) === incomingSignature
      );

      if (existingIndex >= 0) {
        const updated = [...current];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + item.quantity,
        };
        return updated;
      }

      return [
        ...current,
        {
          ...item,
          id: crypto.randomUUID(),
        },
      ];
    });
  }

  function updateItem(id: string, updates: UpdateCartItemInput) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...updates,
              id,
            }
          : item
      )
    );
  }

  function getItemById(id: string) {
    return items.find((item) => item.id === id);
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function clearCart() {
    setItems([]);
  }

  const value: CartContextValue = {
    items,
    cartCount: items.reduce((sum, item) => sum + item.quantity, 0),
    addItem,
    updateItem,
    getItemById,
    removeItem,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}

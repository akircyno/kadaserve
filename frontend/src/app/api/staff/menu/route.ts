import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type MenuItemRow = {
  id: string;
  name: string;
  base_price: number;
  category: string | null;
  image_url: string | null;
  is_available: boolean;
  updated_at: string | null;
};

type StaffMenuCategory =
  | "coffee"
  | "non-coffee"
  | "pastries"
  | "latte-series"
  | "premium-blends"
  | "best-deals";

const categoryOrder: StaffMenuCategory[] = [
  "coffee",
  "non-coffee",
  "pastries",
  "latte-series",
  "premium-blends",
  "best-deals",
];

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/_/g, "-")
    .replace(/\s+/g, " ");
}

function normalizeCategory(category: string | null): StaffMenuCategory | null {
  const normalizedCategory = normalizeText(category ?? "");

  if (
    normalizedCategory === "all-coffee" ||
    normalizedCategory === "hot-coffee" ||
    normalizedCategory === "iced-coffee" ||
    normalizedCategory === "coffee"
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

  if (normalizedCategory === "latte-series") {
    return "latte-series";
  }

  if (normalizedCategory === "premium-blends") {
    return "premium-blends";
  }

  if (normalizedCategory === "best-deals" || normalizedCategory === "others") {
    return "best-deals";
  }

  return null;
}

function shouldReplaceExistingItem(
  existingItem: {
    imageUrl: string | null;
    updatedAt: string | null;
  },
  nextItem: MenuItemRow
) {
  if (!existingItem.imageUrl && nextItem.image_url) {
    return true;
  }

  if (existingItem.imageUrl && !nextItem.image_url) {
    return false;
  }

  if (!existingItem.updatedAt) {
    return true;
  }

  if (!nextItem.updated_at) {
    return false;
  }

  return new Date(nextItem.updated_at) > new Date(existingItem.updatedAt);
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    if (!profile || !["staff", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id, name, base_price, category, image_url, is_available, updated_at")
      .eq("is_available", true)
      .order("name", { ascending: true });

    if (menuError) {
      return NextResponse.json({ error: menuError.message }, { status: 500 });
    }

    const normalizedItems = new Map<
      string,
      {
        id: string;
        name: string;
        price: number;
        category: StaffMenuCategory;
        imageUrl: string | null;
        updatedAt: string | null;
      }
    >();

    for (const row of (menuItems ?? []) as MenuItemRow[]) {
      const category = normalizeCategory(row.category);

      if (!category) {
        continue;
      }

      const dedupeKey = `${category}:${normalizeText(row.name)}`;
      const existingItem = normalizedItems.get(dedupeKey);

      if (existingItem && !shouldReplaceExistingItem(existingItem, row)) {
        continue;
      }

      normalizedItems.set(dedupeKey, {
        id: row.id,
        name: row.name,
        price: row.base_price,
        category,
        imageUrl: row.image_url,
        updatedAt: row.updated_at,
      });
    }

    const staffMenuItems = Array.from(normalizedItems.values())
      .map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        imageUrl: item.imageUrl,
      }))
      .sort((first, second) => {
        const firstCategoryIndex = categoryOrder.indexOf(first.category);
        const secondCategoryIndex = categoryOrder.indexOf(second.category);

        if (firstCategoryIndex !== secondCategoryIndex) {
          return firstCategoryIndex - secondCategoryIndex;
        }

        return first.name.localeCompare(second.name);
      });

    return NextResponse.json({ menuItems: staffMenuItems });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while loading menu items.",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type MenuItemRow = {
  id: string;
  name: string;
  base_price: number;
  category: string | null;
  image_url: string | null;
  is_available: boolean;
};

type StaffMenuCategory =
  | "non-coffee"
  | "pastries"
  | "latte-series"
  | "premium-blends"
  | "best-deals";

type ApprovedMenuItem = {
  name: string;
  category: StaffMenuCategory;
  aliases: string[];
};

const categoryOrder: StaffMenuCategory[] = [
  "non-coffee",
  "pastries",
  "latte-series",
  "premium-blends",
  "best-deals",
];

const approvedMenuItems: ApprovedMenuItem[] = [
  {
    name: "Choco Milk",
    category: "non-coffee",
    aliases: ["choco milk", "chocolate milk"],
  },
  {
    name: "Strawberry Latte",
    category: "non-coffee",
    aliases: ["strawberry latte"],
  },
  {
    name: "Americano",
    category: "non-coffee",
    aliases: ["americano"],
  },
  {
    name: "Choco Chil Cookie",
    category: "pastries",
    aliases: [
      "choco chil cookie",
      "choco chip cookie",
      "chocolate chip cookie",
      "choco cookie",
    ],
  },
  {
    name: "Red Velvet Cookie",
    category: "pastries",
    aliases: ["red velvet cookie"],
  },
  {
    name: "Matcha Latte",
    category: "latte-series",
    aliases: ["matcha latte"],
  },
  {
    name: "French Vanilla Latte",
    category: "latte-series",
    aliases: ["french vanilla latte"],
  },
  {
    name: "Hazelnut Latte",
    category: "latte-series",
    aliases: ["hazelnut latte"],
  },
  {
    name: "Brown Sugar Latte",
    category: "latte-series",
    aliases: ["brown sugar latte"],
  },
  {
    name: "Spanish Latte",
    category: "latte-series",
    aliases: ["spanish latte"],
  },
  {
    name: "Strawberry Matcha",
    category: "premium-blends",
    aliases: ["strawberry matcha"],
  },
  {
    name: "Macchiato",
    category: "premium-blends",
    aliases: ["macchiato"],
  },
  {
    name: "Mocha",
    category: "premium-blends",
    aliases: ["mocha"],
  },
  {
    name: "Signature Blend",
    category: "premium-blends",
    aliases: ["signature blend"],
  },
  {
    name: "Premium x Lattee",
    category: "best-deals",
    aliases: ["premium x lattee", "premium x latte"],
  },
  {
    name: "Premium x Pastries",
    category: "best-deals",
    aliases: ["premium x pastries"],
  },
  {
    name: "Strawberry Matcha",
    category: "best-deals",
    aliases: ["strawberry matcha", "strawberry matcha deal", "best strawberry matcha"],
  },
  {
    name: "Patries",
    category: "best-deals",
    aliases: ["patries", "pastries", "pastries deal", "pastry deal"],
  },
];

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
}

function normalizeCategoryValue(value: string | null) {
  return normalizeText(value ?? "");
}

function findApprovedMenuItem(
  rowName: string,
  rowCategory: string | null
): ApprovedMenuItem | null {
  const normalizedName = normalizeText(rowName);
  const normalizedCategory = normalizeCategoryValue(rowCategory);
  const exactMatches = approvedMenuItems.filter((item) =>
    item.aliases.map(normalizeText).includes(normalizedName)
  );

  if (exactMatches.length === 0) {
    return null;
  }

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  const categoryMatch = exactMatches.find((item) => {
    if (item.category === "non-coffee") {
      return normalizedCategory.includes("non");
    }

    if (item.category === "pastries") {
      return normalizedCategory.includes("pastr");
    }

    if (item.category === "latte-series") {
      return normalizedCategory.includes("latte");
    }

    if (item.category === "premium-blends") {
      return normalizedCategory.includes("premium");
    }

    return normalizedCategory.includes("best");
  });

  return categoryMatch ?? exactMatches[0];
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
      .select("id, name, base_price, category, image_url, is_available")
      .eq("is_available", true)
      .order("name", { ascending: true });

    if (menuError) {
      return NextResponse.json({ error: menuError.message }, { status: 500 });
    }

    const approvedItems = new Map<
      string,
      {
        id: string;
        name: string;
        price: number;
        category: StaffMenuCategory;
        imageUrl: string | null;
      }
    >();

    for (const row of (menuItems ?? []) as MenuItemRow[]) {
      const approvedItem = findApprovedMenuItem(row.name, row.category);

      if (!approvedItem) {
        continue;
      }

      const dedupeKey = `${approvedItem.category}:${normalizeText(
        approvedItem.name
      )}`;

      if (approvedItems.has(dedupeKey)) {
        continue;
      }

      approvedItems.set(dedupeKey, {
        id: row.id,
        name: approvedItem.name,
        price: row.base_price,
        category: approvedItem.category,
        imageUrl: row.image_url,
      });
    }

    const normalizedMenuItems = Array.from(approvedItems.values()).sort(
      (first, second) => {
        const firstCategoryIndex = categoryOrder.indexOf(first.category);
        const secondCategoryIndex = categoryOrder.indexOf(second.category);

        if (firstCategoryIndex !== secondCategoryIndex) {
          return firstCategoryIndex - secondCategoryIndex;
        }

        return first.name.localeCompare(second.name);
      }
    );

    return NextResponse.json({ menuItems: normalizedMenuItems });
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

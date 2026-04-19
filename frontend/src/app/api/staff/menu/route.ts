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

const nonCoffeeItems = ["choco milk", "strawberry latte", "americano"];
const pastriesItems = ["choco chip cookie", "red velvet cookie"];
const latteSeriesItems = [
  "matcha latte",
  "french vanilla latte",
  "hazelnut latte",
  "brown sugar latte",
  "spanish latte",
];
const premiumBlendItems = [
  "strawberry matcha",
  "macchiato",
  "mocha",
  "signature blend",
];
const bestDealItems = ["premium x latte", "premium x pastries", "pastries"];

function normalizeCategory(
  category: string | null,
  name: string
): StaffMenuCategory {
  const categoryValue = category?.trim().toLowerCase() ?? "";
  const nameValue = name.trim().toLowerCase();

  if (categoryValue.includes("best")) return "best-deals";
  if (categoryValue.includes("pastr")) return "pastries";
  if (categoryValue.includes("latte")) return "latte-series";
  if (categoryValue.includes("premium")) return "premium-blends";
  if (categoryValue.includes("non")) return "non-coffee";

  if (bestDealItems.includes(nameValue)) return "best-deals";
  if (pastriesItems.includes(nameValue)) return "pastries";
  if (latteSeriesItems.includes(nameValue)) return "latte-series";
  if (premiumBlendItems.includes(nameValue)) return "premium-blends";
  if (nonCoffeeItems.includes(nameValue)) return "non-coffee";

  return "premium-blends";
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

    const normalizedMenuItems = ((menuItems ?? []) as MenuItemRow[]).map(
      (item) => ({
        id: item.id,
        name: item.name,
        price: item.base_price,
        category: normalizeCategory(item.category, item.name),
        imageUrl: item.image_url,
      })
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

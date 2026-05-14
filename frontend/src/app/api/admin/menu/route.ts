import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AdminMenuCategory =
  | "coffee"
  | "non-coffee"
  | "pastries"
  | "latte-series"
  | "premium-blends"
  | "best-deals";

type MenuRequestBody = {
  id?: string;
  name?: string;
  category?: AdminMenuCategory;
  price?: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
};

const allowedCategories: AdminMenuCategory[] = [
  "coffee",
  "non-coffee",
  "pastries",
  "latte-series",
  "premium-blends",
  "best-deals",
];


async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return {
      supabase,
      error: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  if (!profile || profile.role !== "admin") {
    return {
      supabase,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, error: null };
}

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}


function normalizeImageUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function isValidCategory(value: unknown): value is AdminMenuCategory {
  return (
    typeof value === "string" &&
    allowedCategories.includes(value as AdminMenuCategory)
  );
}

function normalizePrice(value: unknown) {
  const price = Number(value);

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return price;
}

export async function GET() {
  const { supabase, error } = await requireAdmin();

  if (error) {
    return error;
  }

  const { data: menuItems, error: menuError } = await supabase
    .from("menu_items")
    .select(
      `
        id,
        name,
        category,
        base_price,
        image_url,
        is_available,
        created_at,
        updated_at
      `
    )
    .order("name", { ascending: true });

  if (menuError) {
    return NextResponse.json({ error: menuError.message }, { status: 500 });
  }

  return NextResponse.json({
    menuItems: (menuItems ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.base_price,
      imageUrl: item.image_url,
      isAvailable: item.is_available,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const { supabase, error } = await requireAdmin();

  if (error) {
    return error;
  }

  const body = (await request.json()) as MenuRequestBody;

  const name = normalizeName(body.name);
  const price = normalizePrice(body.price);
  const imageUrl = normalizeImageUrl(body.imageUrl);
  const isAvailable = body.isAvailable ?? true;

  if (!name) {
    return NextResponse.json(
      { error: "Menu item name is required." },
      { status: 400 }
    );
  }

  if (!isValidCategory(body.category)) {
    return NextResponse.json(
      { error: "Valid menu category is required." },
      { status: 400 }
    );
  }

  if (price === null) {
    return NextResponse.json(
      { error: "Valid menu item price is required." },
      { status: 400 }
    );
  }

  const { data: menuItem, error: insertError } = await supabase
    .from("menu_items")
    .insert({
      name,
      category: body.category,
      base_price: price,
      image_url: imageUrl,
      is_available: isAvailable,
    })
    .select(
      `
        id,
        name,
        category,
        base_price,
        image_url,
        is_available,
        created_at,
        updated_at
      `
    )
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    menuItem: {
      id: menuItem.id,
      name: menuItem.name,
      category: menuItem.category,
      price: menuItem.base_price,
      imageUrl: menuItem.image_url,
      isAvailable: menuItem.is_available,
      createdAt: menuItem.created_at,
      updatedAt: menuItem.updated_at,
    },
  });
}

export async function PATCH(request: Request) {
  const { supabase, error } = await requireAdmin();

  if (error) {
    return error;
  }

  const body = (await request.json()) as MenuRequestBody;

  if (!body.id) {
    return NextResponse.json(
      { error: "Menu item ID is required." },
      { status: 400 }
    );
  }

  const updates: Record<string, string | number | boolean | null> = {};

  if (body.name !== undefined) {
    const name = normalizeName(body.name);

    if (!name) {
      return NextResponse.json(
        { error: "Menu item name cannot be empty." },
        { status: 400 }
      );
    }

    updates.name = name;
  }


  if (body.category !== undefined) {
    if (!isValidCategory(body.category)) {
      return NextResponse.json(
        { error: "Valid menu category is required." },
        { status: 400 }
      );
    }

    updates.category = body.category;
  }

  if (body.price !== undefined) {
    const price = normalizePrice(body.price);

    if (price === null) {
      return NextResponse.json(
        { error: "Valid menu item price is required." },
        { status: 400 }
      );
    }

    updates.base_price = price;
  }

  if (body.imageUrl !== undefined) {
    updates.image_url = normalizeImageUrl(body.imageUrl);
  }

  if (body.isAvailable !== undefined) {
    updates.is_available = body.isAvailable;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No menu item updates were provided." },
      { status: 400 }
    );
  }

  updates.updated_at = new Date().toISOString();

  const { data: menuItem, error: updateError } = await supabase
    .from("menu_items")
    .update(updates)
    .eq("id", body.id)
    .select(
      `
        id,
        name,
        category,
        base_price,
        image_url,
        is_available,
        created_at,
        updated_at
      `
    )
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    menuItem: {
      id: menuItem.id,
      name: menuItem.name,
      category: menuItem.category,
      price: menuItem.base_price,
      imageUrl: menuItem.image_url,
      isAvailable: menuItem.is_available,
      createdAt: menuItem.created_at,
      updatedAt: menuItem.updated_at,
    },
  });
}

export async function DELETE(request: Request) {
  const { supabase, error } = await requireAdmin();

  if (error) {
    return error;
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Menu item ID is required." },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

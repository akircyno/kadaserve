import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type InventoryRequestBody = {
  id?: string;
  name?: string;
  unit?: string;
  onHand?: number;
  minNeed?: number;
  maxCap?: number;
  supplier?: string;
  addStock?: number;
};

type InventoryItemRow = {
  id: string;
  name: string;
  unit: string;
  on_hand: number;
  min_need: number;
  max_cap: number;
  supplier: string;
  created_at: string;
  updated_at: string;
};

const inventorySelect = `
  id,
  name,
  unit,
  on_hand,
  min_need,
  max_cap,
  supplier,
  created_at,
  updated_at
`;

async function requireInventoryAccess() {
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

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return {
      supabase,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, error: null };
}

function inventorySetupError(message: string) {
  return message.toLowerCase().includes("inventory_items")
    ? "Inventory is not set up yet. Run backend/seed/inventory-items.sql in Supabase."
    : message;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInventoryNumber(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return Math.round(numberValue);
}

function serializeInventoryItem(item: InventoryItemRow) {
  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    onHand: item.on_hand,
    minNeed: item.min_need,
    maxCap: item.max_cap,
    supplier: item.supplier,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

export async function GET() {
  const { supabase, error } = await requireInventoryAccess();

  if (error) {
    return error;
  }

  const { data: inventoryItems, error: inventoryError } = await supabase
    .from("inventory_items")
    .select(inventorySelect)
    .order("name", { ascending: true })
    .returns<InventoryItemRow[]>();

  if (inventoryError) {
    return NextResponse.json(
      { error: inventorySetupError(inventoryError.message) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    inventoryItems: (inventoryItems ?? []).map(serializeInventoryItem),
  });
}

export async function POST(request: Request) {
  const { supabase, error } = await requireInventoryAccess();

  if (error) {
    return error;
  }

  const body = (await request.json()) as InventoryRequestBody;
  const name = normalizeText(body.name);
  const unit = normalizeText(body.unit);
  const supplier = normalizeText(body.supplier) || "Supplier";
  const onHand = normalizeInventoryNumber(body.onHand);
  const minNeed = normalizeInventoryNumber(body.minNeed);
  const maxCap = normalizeInventoryNumber(body.maxCap);

  if (!name) {
    return NextResponse.json(
      { error: "Inventory item name is required." },
      { status: 400 }
    );
  }

  if (!unit) {
    return NextResponse.json(
      { error: "Inventory item unit is required." },
      { status: 400 }
    );
  }

  if (onHand === null || minNeed === null || maxCap === null) {
    return NextResponse.json(
      { error: "Inventory stock values must be valid non-negative numbers." },
      { status: 400 }
    );
  }

  const payload = {
    name,
    unit,
    supplier,
    on_hand: onHand,
    min_need: minNeed,
    max_cap: maxCap,
  };

  const requestQuery = body.id
    ? supabase
        .from("inventory_items")
        .update(payload)
        .eq("id", body.id)
        .select(inventorySelect)
        .single<InventoryItemRow>()
    : supabase
        .from("inventory_items")
        .upsert(payload, { onConflict: "name" })
        .select(inventorySelect)
        .single<InventoryItemRow>();

  const { data: item, error: saveError } = await requestQuery;

  if (saveError) {
    return NextResponse.json(
      { error: inventorySetupError(saveError.message) },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: serializeInventoryItem(item) });
}

export async function PATCH(request: Request) {
  const { supabase, error } = await requireInventoryAccess();

  if (error) {
    return error;
  }

  const body = (await request.json()) as InventoryRequestBody;

  if (!body.id) {
    return NextResponse.json(
      { error: "Inventory item ID is required." },
      { status: 400 }
    );
  }

  let nextStock = normalizeInventoryNumber(body.onHand);

  if (body.addStock !== undefined) {
    const addStock = normalizeInventoryNumber(body.addStock);

    if (addStock === null || addStock <= 0) {
      return NextResponse.json(
        { error: "Added stock must be greater than zero." },
        { status: 400 }
      );
    }

    const { data: currentItem, error: currentError } = await supabase
      .from("inventory_items")
      .select("on_hand")
      .eq("id", body.id)
      .single<{ on_hand: number }>();

    if (currentError) {
      return NextResponse.json(
        { error: inventorySetupError(currentError.message) },
        { status: 500 }
      );
    }

    nextStock = currentItem.on_hand + addStock;
  }

  if (nextStock === null) {
    return NextResponse.json(
      { error: "A valid stock value is required." },
      { status: 400 }
    );
  }

  const { data: item, error: updateError } = await supabase
    .from("inventory_items")
    .update({ on_hand: nextStock })
    .eq("id", body.id)
    .select(inventorySelect)
    .single<InventoryItemRow>();

  if (updateError) {
    return NextResponse.json(
      { error: inventorySetupError(updateError.message) },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: serializeInventoryItem(item) });
}

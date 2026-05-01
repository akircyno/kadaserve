import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getOptionalCoordinate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function isValidLatLng(lat: number | null, lng: number | null) {
  if (lat === null && lng === null) {
    return true;
  }

  return (
    lat !== null &&
    lng !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function cleanAddress(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isMissingAddressTable(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    Boolean(error?.message?.toLowerCase().includes("customer_addresses"))
  );
}

function missingAddressTableResponse() {
  return NextResponse.json(
    {
      error:
        "Address book is not set up yet. Run backend/seed/customer-addresses.sql in Supabase SQL Editor.",
    },
    { status: 503 }
  );
}

async function getUserOrResponse() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { supabase, user };
}

export async function GET() {
  try {
    const auth = await getUserOrResponse();

    if ("response" in auth) {
      return auth.response;
    }

    const { data, error } = await auth.supabase
      .from("customer_addresses")
      .select("id, address, delivery_lat, delivery_lng, is_default, created_at, updated_at")
      .eq("customer_id", auth.user.id)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) {
      if (isMissingAddressTable(error)) {
        return missingAddressTableResponse();
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ addresses: data ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading addresses." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getUserOrResponse();

    if ("response" in auth) {
      return auth.response;
    }

    const body = await request.json();
    const address = cleanAddress(body.address);
    const deliveryLat = getOptionalCoordinate(body.deliveryLat);
    const deliveryLng = getOptionalCoordinate(body.deliveryLng);
    const requestedDefault = body.isDefault === true;

    if (!address || address.length > 180) {
      return NextResponse.json(
        { error: "Use a delivery address up to 180 characters." },
        { status: 400 }
      );
    }

    if (!isValidLatLng(deliveryLat, deliveryLng)) {
      return NextResponse.json(
        { error: "Use a valid delivery pin location." },
        { status: 400 }
      );
    }

    const { count } = await auth.supabase
      .from("customer_addresses")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", auth.user.id);
    const shouldSetDefault = requestedDefault || (count ?? 0) === 0;

    if (shouldSetDefault) {
      await auth.supabase
        .from("customer_addresses")
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq("customer_id", auth.user.id);
    }

    const { data, error } = await auth.supabase
      .from("customer_addresses")
      .insert({
        customer_id: auth.user.id,
        address,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        is_default: shouldSetDefault,
      })
      .select("id, address, delivery_lat, delivery_lng, is_default, created_at, updated_at")
      .single();

    if (error) {
      if (isMissingAddressTable(error)) {
        return missingAddressTableResponse();
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ address: data });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while saving the address." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getUserOrResponse();

    if ("response" in auth) {
      return auth.response;
    }

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json({ error: "Address is required." }, { status: 400 });
    }

    if (body.isDefault === true) {
      await auth.supabase
        .from("customer_addresses")
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq("customer_id", auth.user.id);

      const { data, error } = await auth.supabase
        .from("customer_addresses")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("customer_id", auth.user.id)
        .select("id, address, delivery_lat, delivery_lng, is_default, created_at, updated_at")
        .single();

      if (error) {
        if (isMissingAddressTable(error)) {
          return missingAddressTableResponse();
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ address: data });
    }

    return NextResponse.json({ error: "No address changes were provided." }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while updating the address." },
      { status: 500 }
    );
  }
}

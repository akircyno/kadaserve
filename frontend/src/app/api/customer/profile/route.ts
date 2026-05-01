import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("639")) {
    return `0${digits.slice(2, 12)}`;
  }

  return digits.slice(0, 11);
}

function isValidPhilippinePhone(value: string) {
  return /^09\d{9}$/.test(getPhoneDigits(value));
}

function isValidFullName(value: string) {
  return /^[A-Za-z\s.'-]{2,80}$/.test(value.trim());
}

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

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "full_name, email, phone, default_delivery_address, default_delivery_lat, default_delivery_lng"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      profile: {
        fullName: profile?.full_name ?? null,
        email: profile?.email ?? user.email ?? null,
        phone: profile?.phone ?? null,
        defaultDeliveryAddress: profile?.default_delivery_address ?? null,
        defaultDeliveryLat: profile?.default_delivery_lat ?? null,
        defaultDeliveryLng: profile?.default_delivery_lng ?? null,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading your profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const hasDefaultDeliveryAddress = Object.prototype.hasOwnProperty.call(
      body,
      "defaultDeliveryAddress"
    );
    const hasDefaultDeliveryLocation =
      Object.prototype.hasOwnProperty.call(body, "defaultDeliveryLat") ||
      Object.prototype.hasOwnProperty.call(body, "defaultDeliveryLng");
    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const defaultDeliveryAddress =
      typeof body.defaultDeliveryAddress === "string"
        ? body.defaultDeliveryAddress.trim()
        : "";
    const defaultDeliveryLat = hasDefaultDeliveryLocation
      ? getOptionalCoordinate(body.defaultDeliveryLat)
      : null;
    const defaultDeliveryLng = hasDefaultDeliveryLocation
      ? getOptionalCoordinate(body.defaultDeliveryLng)
      : null;

    if (fullName && !isValidFullName(fullName)) {
      return NextResponse.json(
        { error: "Use a valid full name." },
        { status: 400 }
      );
    }

    if (phone && !isValidPhilippinePhone(phone)) {
      return NextResponse.json(
        { error: "Use a valid Philippine mobile number." },
        { status: 400 }
      );
    }

    if (hasDefaultDeliveryAddress && defaultDeliveryAddress.length > 180) {
      return NextResponse.json(
        { error: "Default delivery address is too long." },
        { status: 400 }
      );
    }

    if (
      hasDefaultDeliveryLocation &&
      !isValidLatLng(defaultDeliveryLat, defaultDeliveryLng)
    ) {
      return NextResponse.json(
        { error: "Use a valid delivery pin location." },
        { status: 400 }
      );
    }

    const updates: {
      full_name?: string;
      phone?: string;
      default_delivery_address?: string;
      default_delivery_lat?: number | null;
      default_delivery_lng?: number | null;
    } = {};

    if (fullName) {
      updates.full_name = fullName;
    }

    if (phone) {
      updates.phone = getPhoneDigits(phone);
    }

    if (hasDefaultDeliveryAddress) {
      updates.default_delivery_address = defaultDeliveryAddress;
    }

    if (hasDefaultDeliveryLocation) {
      updates.default_delivery_lat = defaultDeliveryLat;
      updates.default_delivery_lng = defaultDeliveryLng;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No profile changes were provided." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      profile: {
        fullName: fullName || null,
        phone: phone ? getPhoneDigits(phone) : null,
        defaultDeliveryAddress,
        defaultDeliveryLat,
        defaultDeliveryLng,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while updating your profile." },
      { status: 500 }
    );
  }
}

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
    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const defaultDeliveryAddress =
      typeof body.defaultDeliveryAddress === "string"
        ? body.defaultDeliveryAddress.trim()
        : "";

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

    if (defaultDeliveryAddress.length > 180) {
      return NextResponse.json(
        { error: "Default delivery address is too long." },
        { status: 400 }
      );
    }

    const updates: {
      full_name?: string;
      phone?: string;
      default_delivery_address?: string;
    } = {};

    if (fullName) {
      updates.full_name = fullName;
    }

    if (phone) {
      updates.phone = getPhoneDigits(phone);
    }

    updates.default_delivery_address = defaultDeliveryAddress;

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
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while updating your profile." },
      { status: 500 }
    );
  }
}

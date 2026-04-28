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
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const defaultDeliveryAddress =
      typeof body.defaultDeliveryAddress === "string"
        ? body.defaultDeliveryAddress.trim()
        : "";

    if (!phone || !isValidPhilippinePhone(phone)) {
      return NextResponse.json(
        { error: "Use a valid Philippine mobile number." },
        { status: 400 }
      );
    }

    if (!defaultDeliveryAddress) {
      return NextResponse.json(
        { error: "Default delivery address is required." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        phone: getPhoneDigits(phone),
        default_delivery_address: defaultDeliveryAddress,
      })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      profile: {
        phone: getPhoneDigits(phone),
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

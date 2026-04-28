import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const emailPattern =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const loginAttempts = new Map<string, number[]>();
const maxAttempts = 5;
const windowMs = 60 * 1000;

function getUserFullName(
  userMetadata: Record<string, unknown> | null | undefined,
  email: string
) {
  const fullName = userMetadata?.full_name;
  const name = userMetadata?.name;

  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  return email;
}

function getUserPhone(userMetadata: Record<string, unknown> | null | undefined) {
  const phone = userMetadata?.phone;

  if (typeof phone === "string" && phone.trim()) {
    return phone.trim();
  }

  return "09000000000";
}

function getUserDateOfBirth(
  userMetadata: Record<string, unknown> | null | undefined
) {
  const dateOfBirth = userMetadata?.date_of_birth;

  if (
    typeof dateOfBirth === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
  ) {
    return dateOfBirth;
  }

  return "2000-01-01";
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

function isRateLimited(ipAddress: string) {
  const now = Date.now();
  const recentAttempts = (loginAttempts.get(ipAddress) ?? []).filter(
    (timestamp) => now - timestamp < windowMs
  );

  if (recentAttempts.length >= maxAttempts) {
    loginAttempts.set(ipAddress, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  loginAttempts.set(ipAddress, recentAttempts);
  return false;
}

function clearLoginAttempts(ipAddress: string) {
  loginAttempts.delete(ipAddress);
}

export async function POST(request: Request) {
  try {
    const ipAddress = getClientIp(request);

    if (isRateLimited(ipAddress)) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Please try again in one minute." },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedPassword = typeof password === "string" ? password : "";

    if (!emailPattern.test(normalizedEmail) || !normalizedPassword) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: authData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });

    if (signInError || !authData.user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    clearLoginAttempts(ipAddress);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: "Logged in, but role could not be determined." },
        { status: 500 }
      );
    }

    if (!profile) {
      await supabase.from("profiles").upsert({
        id: authData.user.id,
        full_name: getUserFullName(
          authData.user.user_metadata,
          authData.user.email ?? normalizedEmail
        ),
        email: authData.user.email ?? normalizedEmail,
        phone: getUserPhone(authData.user.user_metadata),
        date_of_birth: getUserDateOfBirth(authData.user.user_metadata),
        role: "customer",
      });

      return NextResponse.json({
        success: true,
        role: "customer",
      });
    }

    return NextResponse.json({
      success: true,
      role: profile.role,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong during login." },
      { status: 500 }
    );
  }
}

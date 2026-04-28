import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const emailPattern =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const resetAttempts = new Map<string, number[]>();
const maxAttempts = 3;
const windowMs = 60 * 60 * 1000;

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
  const recentAttempts = (resetAttempts.get(ipAddress) ?? []).filter(
    (timestamp) => now - timestamp < windowMs
  );

  if (recentAttempts.length >= maxAttempts) {
    resetAttempts.set(ipAddress, recentAttempts);
    return true;
  }

  recentAttempts.push(now);
  resetAttempts.set(ipAddress, recentAttempts);
  return false;
}

function getSiteOrigin(request: Request) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(
    /\/$/,
    ""
  );

  if (configuredSiteUrl) {
    return configuredSiteUrl;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const ipAddress = getClientIp(request);

    if (isRateLimited(ipAddress)) {
      return NextResponse.json(
        {
          error:
            "Too many reset requests. Please wait before trying again.",
        },
        { status: 429 }
      );
    }

    const { email } = await request.json();
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!emailPattern.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const siteOrigin = getSiteOrigin(request);
    const supabase = await createClient();

    await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${siteOrigin}/auth/callback?next=/reset-password`,
    });

    return NextResponse.json({
      success: true,
      message:
        "If this email is registered, we sent a password reset link to it.",
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to send password reset instructions right now." },
      { status: 500 }
    );
  }
}

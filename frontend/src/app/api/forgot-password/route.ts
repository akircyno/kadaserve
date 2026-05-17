import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const emailPattern =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const resetAttempts = new Map<string, number[]>();
const maxAttempts = 3;
const windowMs = 60 * 60 * 1000;
const genericResetResponse = {
  success: true,
  message: "If this email is registered, we sent a password reset code to it.",
};

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

export async function POST(request: Request) {
  try {
    const ipAddress = getClientIp(request);

    if (isRateLimited(ipAddress)) {
      return NextResponse.json(
        {
          error: "Too many reset requests. Please wait before trying again.",
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

    const supabase = createAdminClient();

    // 1. Find the user by email
    const { data: users, error: listError } =
      await supabase.auth.admin.listUsers();

    if (listError) {
      console.error("Error listing users:", listError);
      return NextResponse.json(
        { error: "Unable to process request right now." },
        { status: 500 }
      );
    }

    const user = users.users.find((u) => u.email === normalizedEmail);

    if (!user) {
      return NextResponse.json(genericResetResponse);
    }

    // 2. Generate a 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // 3. Save the reset code to the database
    const { error: dbError } = await supabase.from("password_resets").insert({
      user_id: user.id,
      reset_code: resetCode,
      expires_at: expiresAt.toISOString(),
    });

    if (dbError) {
      console.error("Error saving reset code:", dbError);
      return NextResponse.json(
        { error: "Unable to process request right now." },
        { status: 500 }
      );
    }

    // 4. Send the code via email
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: "Your Password Reset Code",
        text: `Your password reset code is: ${resetCode}\n\nThis code will expire in 15 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #0D2E18;">
            <h1 style="font-size: 24px; margin-bottom: 12px;">Password Reset Request</h1>
            <p>Hi,</p>
            <p>You requested to reset your password. Use the code below to proceed:</p>
            <div style="margin: 28px 0; font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #0F441D; background: #f4f4f4; padding: 20px; border-radius: 10px; text-align: center;">
              ${resetCode}
            </div>
            <p>This code will expire in 15 minutes.</p>
            <p style="font-size: 13px; color: #684B35;">If you did not request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Error sending reset email:", emailError);
      // We don't necessarily want to fail here if the DB insert succeeded, 
      // but the user won't get the code. In this case, we should probably return an error.
      return NextResponse.json(
        { error: "Unable to send reset code right now." },
        { status: 500 }
      );
    }

    return NextResponse.json(genericResetResponse);
  } catch (error) {
    console.error("Forgot password route error:", error);
    return NextResponse.json(
      { error: "Unable to process request right now." },
      { status: 500 }
    );
  }
}

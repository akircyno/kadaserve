import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

    if (!emailPattern.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    if (typeof code !== "string" || code.trim().length !== 6) {
      return NextResponse.json({ error: "Invalid code format." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Find the user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error("[verify-reset-code] Error listing users:", listError);
      return NextResponse.json({ error: "Unable to process request right now." }, { status: 500 });
    }

    const user = users.users.find((u) => u.email === normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
    }

    // 2. Look up the most recent matching reset code
    const { data: resetRecord, error: dbError } = await supabase
      .from("password_resets")
      .select("*")
      .eq("user_id", user.id)
      .eq("reset_code", code.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbError) {
      const msg = dbError.message || dbError.code || "unknown";
      console.error("[verify-reset-code] DB error:", msg, JSON.stringify(dbError));
      return NextResponse.json({ error: "Database error: " + msg }, { status: 500 });
    }

    if (!resetRecord) {
      return NextResponse.json(
        { error: "Invalid or expired code. Please request a new one." },
        { status: 400 }
      );
    }

    // 3. Check expiration in JS to avoid DB timezone issues
    if (new Date(resetRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Code verified successfully." });
  } catch (error) {
    console.error("[verify-reset-code] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
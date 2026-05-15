import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const emailPattern =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!emailPattern.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    if (typeof code !== "string" || code.length !== 6) {
      return NextResponse.json(
        { error: "Invalid code format." },
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
      return NextResponse.json(
        { error: "Invalid code. Please try again." },
        { status: 400 }
      );
    }

    // 2. Look up the reset code in the database
    const { data: resetRecords, error: dbError } = await supabase
      .from("password_resets")
      .select("*")
      .eq("user_id", user.id)
      .eq("reset_code", code)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (dbError) {
      console.error("Error looking up reset code:", dbError);
      return NextResponse.json(
        { error: "Unable to process request right now." },
        { status: 500 }
      );
    }

    if (!resetRecords) {
      return NextResponse.json(
        { error: "Invalid or expired code. Please request a new one." },
        { status: 400 }
      );
    }

    // 3. Mark the reset code as used (or delete it)
    const { error: updateError } = await supabase
      .from("password_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetRecords.id);

    if (updateError) {
      console.error("Error marking reset code as used:", updateError);
      return NextResponse.json(
        { error: "Unable to process request right now." },
        { status: 500 }
      );
    }

    // 4. Create a session for the user to allow password reset
    // Store a temporary flag in user metadata or create a session token
    const { error: sessionError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          password_reset_verified: true,
          password_reset_at: new Date().toISOString(),
        },
      }
    );

    if (sessionError) {
      console.error("Error updating user metadata:", sessionError);
      return NextResponse.json(
        { error: "Unable to process request right now." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Code verified successfully.",
    });
  } catch (error) {
    console.error("Verify reset code error:", error);
    return NextResponse.json(
      { error: "Unable to process request right now." },
      { status: 500 }
    );
  }
}

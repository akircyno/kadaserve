import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { email, code, password } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Find user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: "Verification failed." }, { status: 500 });
    }

    const user = users.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user) {
      return NextResponse.json({ error: "Invalid email or code." }, { status: 400 });
    }

    // 2. Check the reset code
    const { data: resetEntry, error: dbError } = await supabase
      .from("password_resets")
      .select("*")
      .eq("user_id", user.id)
      .eq("reset_code", code.trim())
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (dbError || !resetEntry) {
      return NextResponse.json(
        { error: "Invalid or expired reset code." },
        { status: 400 }
      );
    }

    if (password) {
      // 3. Update the user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: password }
      );

      if (updateError) {
        console.error("Error updating password:", updateError);
        return NextResponse.json(
          { error: "Failed to update password." },
          { status: 500 }
        );
      }

      // 4. Mark the code as used
      await supabase
        .from("password_resets")
        .update({ is_used: true })
        .eq("id", resetEntry.id);
    }

    return NextResponse.json({
      success: true,
      message: "Your password has been reset successfully.",
    });
  } catch (error) {
    console.error("Verify reset code error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

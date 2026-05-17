import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getPasswordIssues(password: string) {
  const issues: string[] = [];

  if (password.length < 8) {
    issues.push("8 characters");
  }

  if (!/\d/.test(password)) {
    issues.push("1 number");
  }

  return issues;
}

export async function POST(request: Request) {
  try {
    const { email, code, password } = await request.json();

    if (!email || !code || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email, code, and password are required." },
        { status: 400 }
      );
    }

    const passwordIssues = getPasswordIssues(password);

    if (passwordIssues.length > 0) {
      return NextResponse.json(
        { error: `Password must include: ${passwordIssues.join(", ")}.` },
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
      .is("used_at", null)
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

    // 3. Update the user's password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password }
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
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetEntry.id);

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

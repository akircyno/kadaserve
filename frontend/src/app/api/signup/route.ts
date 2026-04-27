import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getPasswordIssues(password: string) {
  const issues: string[] = [];

  if (password.length < 8) {
    issues.push("At least 8 characters");
  }

  if (!/\d/.test(password)) {
    issues.push("At least one number");
  }

  if (!/[A-Z]/.test(password)) {
    issues.push("At least one uppercase letter");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    issues.push("At least one special character");
  }

  return issues;
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || typeof password !== "string") {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const passwordIssues = getPasswordIssues(password);

    if (passwordIssues.length > 0) {
      return NextResponse.json(
        {
          error: `Password must include: ${passwordIssues.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          role: "customer",
        },
      },
    });

    if (signUpError || !authData.user) {
      return NextResponse.json(
        { error: signUpError?.message || "Account creation failed." },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: authData.user.id,
        email: authData.user.email ?? normalizedEmail,
        role: "customer",
      },
      { onConflict: "id" }
    );

    if (profileError) {
      return NextResponse.json(
        { error: "Account created, but customer profile could not be saved." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      role: "customer",
      needsEmailConfirmation: !authData.session,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong during account creation." },
      { status: 500 }
    );
  }
}

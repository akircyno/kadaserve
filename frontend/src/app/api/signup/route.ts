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

const nameRegex = /^[A-Za-z\s.-]+$/;
const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function isValidName(value: string) {
  return nameRegex.test(value.trim());
}

function isValidPhone(value: string) {
  return /^(09|\+639)\d{9}$/.test(value.trim());
}

function isValidEmail(value: string) {
  return emailRegex.test(value.trim());
}

function getAdultCutoffDate() {
  const today = new Date();
  return new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
}

function isAtLeast18(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const selectedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(selectedDate.getTime())) {
    return false;
  }

  return selectedDate <= getAdultCutoffDate();
}

export async function POST(request: Request) {
  try {
    const { fullName, phone, dateOfBirth, email, password } =
      await request.json();
    const normalizedFullName =
      typeof fullName === "string" ? fullName.trim() : "";
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedDateOfBirth =
      typeof dateOfBirth === "string" ? dateOfBirth.trim() : "";
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (
      !normalizedFullName ||
      !normalizedPhone ||
      !normalizedDateOfBirth ||
      !normalizedEmail ||
      typeof password !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Full name, phone number, date of birth, email, and password are required.",
        },
        { status: 400 }
      );
    }

    if (!isValidName(normalizedFullName)) {
      return NextResponse.json(
        {
          error:
            "Full name can only include letters, spaces, hyphens, and dots.",
        },
        { status: 400 }
      );
    }

    if (!isValidPhone(normalizedPhone)) {
      return NextResponse.json(
        {
          error:
            "Phone number must be a valid Philippine mobile number.",
        },
        { status: 400 }
      );
    }

    if (!isAtLeast18(normalizedDateOfBirth)) {
      return NextResponse.json(
        { error: "You must be at least 18 years old to create an account." },
        { status: 400 }
      );
    }

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
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
          full_name: normalizedFullName,
          name: normalizedFullName,
          phone: normalizedPhone,
          date_of_birth: normalizedDateOfBirth,
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

    if (!authData.session) {
      return NextResponse.json({
        success: true,
        role: "customer",
        needsEmailConfirmation: true,
      });
    }

    return NextResponse.json({
      success: true,
      role: "customer",
      needsEmailConfirmation: false,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong during account creation." },
      { status: 500 }
    );
  }
}

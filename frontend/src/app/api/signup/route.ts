import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "@/lib/email";

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

const nameRegex = /^[A-Za-z\s.-]+$/;
const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

async function sendConfirmationEmail({
  to,
  fullName,
  confirmationUrl,
}: {
  to: string;
  fullName: string;
  confirmationUrl: string;
}) {
  const safeName = escapeHtml(fullName);
  const safeConfirmationUrl = escapeHtml(confirmationUrl);

  await sendEmail({
    to,
    subject: "Confirm your KadaServe account",
    text: `Hi ${fullName},\n\nConfirm your KadaServe account by opening this link:\n${confirmationUrl}\n\nIf you did not create this account, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #0D2E18;">
        <h1 style="font-size: 24px; margin-bottom: 12px;">Confirm your KadaServe account</h1>
        <p>Hi ${safeName},</p>
        <p>Open the button below to verify your email and finish creating your KadaServe account.</p>
        <p style="margin: 28px 0;">
          <a href="${safeConfirmationUrl}" style="background: #0F441D; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">
            Verify email
          </a>
        </p>
        <p style="font-size: 13px; color: #684B35;">If the button does not work, copy and paste this link into your browser:</p>
        <p style="font-size: 13px; word-break: break-all;">
          <a href="${safeConfirmationUrl}" style="color: #0F441D;">${safeConfirmationUrl}</a>
        </p>
        <p style="font-size: 13px; color: #684B35;">If you did not create this account, you can ignore this email.</p>
      </div>
    `,
  });
}

function isValidName(value: string) {
  return nameRegex.test(value.trim());
}

function isValidEmail(value: string) {
  return emailRegex.test(value.trim());
}

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const { fullName, email, password } = await request.json();
    const normalizedFullName =
      typeof fullName === "string" ? fullName.trim() : "";
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (
      !normalizedFullName ||
      !normalizedEmail ||
      typeof password !== "string"
    ) {
      return NextResponse.json(
        { error: "Full name, email, and password are required." },
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

    const supabase = createAdminClient();
    const redirectTo = `${requestUrl.origin}/auth/callback?next=/customer?splash=1`;

    const { data: authData, error: signUpError } =
      await supabase.auth.admin.generateLink({
        type: "signup",
        email: normalizedEmail,
        password,
        options: {
          redirectTo,
          data: {
            full_name: normalizedFullName,
            name: normalizedFullName,
            role: "customer",
          },
        },
      });

    if (signUpError || !authData.user || !authData.properties?.action_link) {
      return NextResponse.json(
        { error: signUpError?.message || "Account creation failed." },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authData.user.id,
      full_name: normalizedFullName,
      email: authData.user.email ?? normalizedEmail,
      phone: null,
      role: "customer",
    });

    if (profileError) {
      return NextResponse.json(
        {
          error: `Account created, but profile could not be saved: ${profileError.message}`,
        },
        { status: 500 }
      );
    }

    try {
      await sendConfirmationEmail({
        to: normalizedEmail,
        fullName: normalizedFullName,
        confirmationUrl: authData.properties.action_link,
      });
    } catch (emailError) {
      await supabase.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        {
          error:
            emailError instanceof Error
              ? emailError.message
              : "Confirmation email could not be sent.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      role: "customer",
      needsEmailConfirmation: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong during account creation." },
      { status: 500 }
    );
  }
}

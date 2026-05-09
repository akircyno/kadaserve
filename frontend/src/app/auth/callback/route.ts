import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getRoleRedirect(role: string | null | undefined) {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "staff") {
    return "/staff";
  }

  return "/customer";
}

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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const safeNext =
    next?.startsWith("/") && !next.startsWith("//") ? next : null;

  if (!code) {
    return NextResponse.redirect(`${requestUrl.origin}/login?error=no-code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=session-exchange-failed`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${requestUrl.origin}/login?error=no-user`);
  }

  if (safeNext?.startsWith("/reset-password")) {
    return NextResponse.redirect(`${requestUrl.origin}${safeNext}`);
  }

  const { data: profile, error: profileFetchError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileFetchError) {
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=profile-fetch-failed`
    );
  }

  if (profile?.role) {
    return NextResponse.redirect(
      `${requestUrl.origin}${safeNext ?? getRoleRedirect(profile.role)}`
    );
  }

  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: getUserFullName(user.user_metadata, user.email ?? ""),
    email: user.email ?? "",
    phone: null,
    role: "customer",
  });

  return NextResponse.redirect(`${requestUrl.origin}${safeNext ?? "/customer"}`);
}

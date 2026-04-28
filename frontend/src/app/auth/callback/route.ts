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

function getUserPhone(userMetadata: Record<string, unknown> | null | undefined) {
  const phone = userMetadata?.phone;

  if (typeof phone === "string" && phone.trim()) {
    return phone.trim();
  }

  return "09000000000";
}

function getUserDateOfBirth(
  userMetadata: Record<string, unknown> | null | undefined
) {
  const dateOfBirth = userMetadata?.date_of_birth;

  if (
    typeof dateOfBirth === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
  ) {
    return dateOfBirth;
  }

  return "2000-01-01";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

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

  if (next?.startsWith("/") && !next.startsWith("//")) {
    return NextResponse.redirect(`${requestUrl.origin}${next}`);
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
      `${requestUrl.origin}${getRoleRedirect(profile.role)}`
    );
  }

  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: getUserFullName(user.user_metadata, user.email ?? ""),
    email: user.email ?? "",
    phone: getUserPhone(user.user_metadata),
    date_of_birth: getUserDateOfBirth(user.user_metadata),
    role: "customer",
  });

  return NextResponse.redirect(`${requestUrl.origin}/customer`);
}

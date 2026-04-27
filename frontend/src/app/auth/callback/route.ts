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

  const { error: profileCreateError } = await supabase.from("profiles").insert({
    id: user.id,
    full_name: getUserFullName(user.user_metadata, user.email ?? ""),
    email: user.email ?? "",
    role: "customer",
  });

  if (profileCreateError) {
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=profile-create-failed`
    );
  }

  return NextResponse.redirect(`${requestUrl.origin}/customer`);
}

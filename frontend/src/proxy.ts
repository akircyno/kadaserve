import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isLoginPage = pathname === "/login";
  const isPublicHome = pathname === "/";
  const isCustomerRoute = pathname.startsWith("/customer");
  const isStaffRoute = pathname.startsWith("/staff");
  const isAdminRoute = pathname.startsWith("/admin");

  if (!user) {
    if (isPublicHome || isLoginPage) {
      return response;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const redirectUrl = request.nextUrl.clone();

    if (profile?.role === "admin") {
      redirectUrl.pathname = "/admin";
    } else if (profile?.role === "staff") {
      redirectUrl.pathname = "/staff";
    } else {
      redirectUrl.pathname = "/customer";
    }

    return NextResponse.redirect(redirectUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "customer";

  if (isCustomerRoute && role !== "customer") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = role === "admin" ? "/admin" : "/staff";
    return NextResponse.redirect(redirectUrl);
  }

  if (isStaffRoute && role !== "staff") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = role === "admin" ? "/admin" : "/customer";
    return NextResponse.redirect(redirectUrl);
  }

  if (isAdminRoute && role !== "admin") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = role === "staff" ? "/staff" : "/customer";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/", "/login", "/customer/:path*", "/staff/:path*", "/admin/:path*"],
};

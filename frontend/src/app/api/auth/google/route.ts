import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${requestUrl.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error || !data.url) {
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=google-auth-failed`
      );
    }

    return NextResponse.redirect(data.url);
  } catch {
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(
      `${requestUrl.origin}/login?error=google-auth-failed`
    );
  }
}

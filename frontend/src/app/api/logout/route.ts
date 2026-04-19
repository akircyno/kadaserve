import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function POST() {
  await signOut();
  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  await signOut();

  const redirectUrl = new URL("/login", request.url);
  return NextResponse.redirect(redirectUrl);
}

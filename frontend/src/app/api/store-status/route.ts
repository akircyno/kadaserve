import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeStoreOverride,
  resolveStoreStatus,
  STORE_STATUS_SETTING_KEY,
  type StoreOverrideStatus,
} from "@/lib/store-status";

function isMissingStoreSettingsTable(error: { message?: string; code?: string } | null) {
  return (
    error?.code === "42P01" ||
    Boolean(error?.message?.toLowerCase().includes("store_settings"))
  );
}

async function getStoreOverride(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("store_settings")
    .select("value, updated_at")
    .eq("key", STORE_STATUS_SETTING_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingStoreSettingsTable(error)) {
      return {
        status: resolveStoreStatus("auto", new Date(), null, true),
        error: null,
      };
    }

    return { status: null, error };
  }

  return {
    status: resolveStoreStatus(
      normalizeStoreOverride(data?.value),
      new Date(),
      data?.updated_at ?? null
    ),
    error: null,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { status, error } = await getStoreOverride(supabase);

    if (error || !status) {
      return NextResponse.json(
        { error: error?.message || "Failed to load store status." },
        { status: 500 }
      );
    }

    return NextResponse.json(status);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while loading store status." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    if (!profile || !["staff", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { overrideStatus?: string };

    if (!["auto", "open", "busy", "closed"].includes(body.overrideStatus ?? "")) {
      return NextResponse.json(
        { error: "Invalid store status." },
        { status: 400 }
      );
    }

    const overrideStatus = body.overrideStatus as StoreOverrideStatus;

    const { data, error } = await supabase
      .from("store_settings")
      .upsert(
        {
          key: STORE_STATUS_SETTING_KEY,
          value: overrideStatus,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      )
      .select("value, updated_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: isMissingStoreSettingsTable(error)
            ? "Create the store_settings table in Supabase first."
            : error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      resolveStoreStatus(
        normalizeStoreOverride(data.value),
        new Date(),
        data.updated_at ?? null
      )
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while updating store status." },
      { status: 500 }
    );
  }
}

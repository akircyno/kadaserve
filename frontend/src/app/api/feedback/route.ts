import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be logged in to submit feedback." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      order_id,
      order_item_id,
      menu_item_id,
      taste_rating,
      strength_rating,
      overall_rating,
      comment,
    } = body;

    if (
      !order_id ||
      !order_item_id ||
      !menu_item_id ||
      !taste_rating ||
      !strength_rating ||
      !overall_rating
    ) {
      return NextResponse.json(
        { error: "Missing required feedback fields." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("feedback").insert({
      order_id,
      order_item_id,
      customer_id: user.id,
      menu_item_id,
      taste_rating,
      strength_rating,
      overall_rating,
      comment: comment?.trim() || null,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong while submitting feedback." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const maxFileSize = 1.5 * 1024 * 1024;

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return {
      supabase,
      error: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  if (!profile || profile.role !== "admin") {
    return {
      supabase,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, error: null };
}

function getFileExtension(file: File) {
  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const { supabase, error } = await requireAdmin();

  if (error) {
    return error;
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Menu image is required." },
      { status: 400 }
    );
  }

  if (!allowedMimeTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPG, PNG, and WEBP images are allowed." },
      { status: 400 }
    );
  }

  if (file.size > maxFileSize) {
    return NextResponse.json(
      {
        error:
          "This image is a bit too large to process. Please try a different photo.",
      },
      { status: 400 }
    );
  }

  const extension = getFileExtension(file);

  if (!extension) {
    return NextResponse.json(
      { error: "Invalid image file type." },
      { status: 400 }
    );
  }

  const filePath = `menu/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("menu-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        error:
          "This image is a bit too large to process. Please try a different photo.",
      },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("menu-images").getPublicUrl(filePath);

  return NextResponse.json({ imageUrl: publicUrl });
}

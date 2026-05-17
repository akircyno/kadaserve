import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bucketName = "profile-avatars";
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const maxFileSize = 1.5 * 1024 * 1024;

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

async function ensureAvatarBucket() {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.getBucket(bucketName);

  if (!error) {
    return supabase;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: maxFileSize,
    allowedMimeTypes,
  });

  if (createError && !createError.message.toLowerCase().includes("already")) {
    throw createError;
  }

  return supabase;
}

export async function POST(request: Request) {
  try {
    const sessionSupabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await sessionSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Profile photo is required." },
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
        { error: "Profile photo must be 1.5MB or smaller after cropping." },
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

    const supabase = await ensureAvatarBucket();
    const filePath = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "Something went wrong while uploading your photo." },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (profileError) {
      return NextResponse.json(
        { error: "Photo uploaded, but your profile was not updated." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      avatarUrl: `${publicUrl}?v=${Date.now()}`,
    });
  } catch (error) {
    console.error("Customer avatar upload error:", error);
    return NextResponse.json(
      { error: "Something went wrong while uploading your photo." },
      { status: 500 }
    );
  }
}

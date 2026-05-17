// app/api/generated-images/community/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const contentRating = req.nextUrl.searchParams.get("contentRating") || "sfw";

  const { data, error } = await supabase
    .from("generated_images")
    .select("id, girlfriend_id, prompt, image_url, aspect_ratio, model, created_at")
    .eq("status", "saved")
    .eq("content_rating", contentRating)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching community images:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ images: data });
}
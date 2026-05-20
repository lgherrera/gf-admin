// app/api/atlas-cloud/upload/route.ts

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Forward to Atlas Cloud uploadMedia
    const uploadForm = new FormData();
    uploadForm.append("file", file);

    const response = await fetch(
      "https://api.atlascloud.ai/api/v1/model/uploadMedia",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.ATLAS_CLOUD_API_KEY}`,
        },
        body: uploadForm,
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Atlas Cloud upload error:", result);
      return NextResponse.json(
        { error: result.error || "Upload failed" },
        { status: response.status }
      );
    }

    // Response shape: { data: { download_url, file_name, content_type, size } }
    const downloadUrl = result?.data?.download_url || result?.url;

    return NextResponse.json({ url: downloadUrl });
  } catch (err: unknown) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
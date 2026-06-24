// app/api/atlas-cloud/route.ts

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ATLAS_BASE = "https://api.atlascloud.ai/api/v1/model";

export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, model, prompt, images, aspect_ratio, duration } = body as {
      type: "image" | "video";
      model: string;
      prompt: string;
      images?: string[];
      aspect_ratio?: string;
      duration?: number;
    };

    const endpoint =
      type === "video"
        ? `${ATLAS_BASE}/generateVideo`
        : `${ATLAS_BASE}/generateImage`;

    // Build payload
    const payload: Record<string, unknown> = {
      model,
      prompt,
    };

    // Atlas Cloud edit models expect "images": ["url1", "url2"]
    if (images && images.length > 0) {
      payload.images = images;
    }

    if (aspect_ratio) {
      payload.aspect_ratio = aspect_ratio;
    }

    if (type === "video" && duration) {
      payload.duration = duration;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ATLAS_CLOUD_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Atlas Cloud generate error:", result);
      return NextResponse.json(
        { error: result.error || result.message || "Generation failed" },
        { status: response.status }
      );
    }

    // Response shape: { data: { id, status } } or { id, status }
    const predictionId = result?.data?.id || result?.predictionId || result?.id;

    return NextResponse.json({ predictionId });
  } catch (err: unknown) {
    console.error("Generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
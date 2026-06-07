// app/api/generate/video/route.ts

import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL_ENDPOINTS: Record<string, string> = {
  grok: "xai/grok-imagine-video/v1.5/image-to-video",
  seedance: "bytedance/seedance-2.0/image-to-video",
};

export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, aspectRatio, duration, model, referenceImage, generateAudio } =
      (await req.json()) as {
        prompt: string;
        aspectRatio: string;
        duration: number;
        model: string;
        referenceImage: string;
        generateAudio?: boolean;
      };

    if (!referenceImage) {
      return NextResponse.json({ error: "Reference image required" }, { status: 400 });
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
    }

    const selectedModel = model ?? "seedance";
    const endpoint = MODEL_ENDPOINTS[selectedModel] ?? MODEL_ENDPOINTS.seedance;

    /* ── Upload reference image to fal storage ──────────────────── */
    const blob = base64ToBlob(referenceImage, "image/jpeg");
    const file = new File([blob], "ref.jpg", { type: "image/jpeg" });
    const imageUrl = await fal.storage.upload(file);

    /* ── Build input payload ─────────────────────────────────────── */
    const input: Record<string, unknown> = {
      image_url: imageUrl,
      aspect_ratio: aspectRatio,
      duration: String(duration),
      enable_safety_checker: false,
    };

    if (prompt?.trim()) {
      input.prompt = prompt.trim();
    }

    if (generateAudio) {
      input.generate_audio = true;
    }

    const result = await fal.subscribe(endpoint, { input });

    const data = result.data as { video?: { url: string } };
    const videoUrl = data?.video?.url;

    if (!videoUrl) {
      return NextResponse.json(
        { error: `Unexpected response: ${JSON.stringify(result.data).slice(0, 300)}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: videoUrl });
  } catch (err) {
    const msg = err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null
        ? JSON.stringify(err)
        : "Unknown error";
    console.error("Generate video error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function base64ToBlob(b64: string, mimeType: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
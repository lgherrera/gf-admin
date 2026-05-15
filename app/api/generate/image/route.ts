// app/api/generate/image/route.ts

import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";
export const maxDuration = 120;

const RATIO_TO_SIZE_V4: Record<string, { width: number; height: number } | string> = {
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
  "2:3": { width: 960, height: 1440 },
};

const RATIO_TO_SIZE_V5: Record<string, string> = {
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
  "2:3": "portrait_4_3",
};

const MODEL_ENDPOINTS: Record<string, string> = {
  seedream: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  seedream5: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
  flux1dev: "fal-ai/flux/dev",
  flux2pro: "fal-ai/flux-2-pro",
  wan25: "fal-ai/wan-25-preview/text-to-image",
  hunyuan3: "fal-ai/hunyuan-image/v3/text-to-image",
};

const EDIT_ENDPOINTS: Record<string, string> = {
  seedream: "fal-ai/bytedance/seedream/v4.5/edit",
  seedream5: "fal-ai/bytedance/seedream/v5/lite/edit",
  flux2pro: "fal-ai/flux-2-pro/edit",
};

export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, aspectRatio, referenceImages, seed, model } = (await req.json()) as {
      prompt: string;
      aspectRatio: string;
      referenceImages?: string[];
      seed?: number;
      model?: string;
    };

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
    }

    const selectedModel = model ?? "seedream";
    const isFlux1Dev = selectedModel === "flux1dev";
    const isFlux2Pro = selectedModel === "flux2pro";
    const isFlux = isFlux1Dev || isFlux2Pro;
    const isV5 = selectedModel === "seedream5";
    const isSeedream = selectedModel === "seedream" || isV5;
    const isWan = selectedModel === "wan25";
    const isHunyuan = selectedModel === "hunyuan3";

    const supportsRefs = isSeedream || isFlux2Pro;

    const endpoint = MODEL_ENDPOINTS[selectedModel] ?? MODEL_ENDPOINTS.seedream;
    const imageSize = isV5 || isFlux2Pro
      ? RATIO_TO_SIZE_V5[aspectRatio] ?? "portrait_16_9"
      : RATIO_TO_SIZE_V4[aspectRatio] ?? "portrait_16_9";
    const resolvedSeed = isV5 || isFlux2Pro
      ? undefined
      : (seed ?? Math.floor(Math.random() * 2147483647));

    // Upload base64 reference images to fal storage
    const referenceImageUrls: string[] = [];
    if (supportsRefs && referenceImages?.length) {
      for (const b64 of referenceImages) {
        const blob = base64ToBlob(b64, "image/jpeg");
        const file = new File([blob], "ref.jpg", { type: "image/jpeg" });
        const url = await fal.storage.upload(file);
        referenceImageUrls.push(url);
      }
    }

    // Use /edit endpoint when reference images are provided
    const useEditEndpoint = referenceImageUrls.length > 0 && supportsRefs;
    const finalEndpoint = useEditEndpoint
      ? EDIT_ENDPOINTS[selectedModel] ?? endpoint
      : endpoint;

    const input: Record<string, unknown> = {
      prompt,
      image_size: imageSize,
      enable_safety_checker: false,
      ...(resolvedSeed !== undefined && { seed: resolvedSeed }),
      ...(isFlux1Dev && { guidance_scale: 3.5 }),
      ...(isFlux2Pro && { safety_tolerance: "5" }),
      ...(isHunyuan && { guidance_scale: 7.5, enable_prompt_expansion: false }),
    };

    if (useEditEndpoint && referenceImageUrls.length > 0) {
      input.image_urls = referenceImageUrls;
    }

    const result = await fal.subscribe(finalEndpoint, { input });

    const images = (result.data as { images?: { url: string }[] })?.images;
    const imageUrl = images?.[0]?.url;

    if (!imageUrl) {
      return NextResponse.json(
        { error: `Unexpected response: ${JSON.stringify(result.data).slice(0, 300)}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: imageUrl, seed: resolvedSeed ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate image error:", msg);
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
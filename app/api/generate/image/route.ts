// app/api/generate/image/route.ts

import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import Replicate from "replicate";

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
  flux2dev: "fal-ai/flux-2",
  flux2max: "fal-ai/flux-2-max",
  wan25: "fal-ai/wan-25-preview/text-to-image",
  hunyuan3: "fal-ai/hunyuan-image/v3/text-to-image",
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

    // ── Replicate branch ──
    if (model === "seedream-r") {
      if (!process.env.REPLICATE_API_TOKEN) {
        return NextResponse.json({ error: "REPLICATE_API_TOKEN not configured" }, { status: 500 });
      }

      const replicate = new Replicate();

      // Build input
      const replicateInput: Record<string, unknown> = {
        prompt,
        aspect_ratio: aspectRatio,
        size: "4K",
      };

      // Add reference images if provided
      if (referenceImages?.length) {
        replicateInput.image_input = referenceImages.map(
          (b64) => `data:image/jpeg;base64,${b64}`
        );
      }

      const output = await replicate.run("bytedance/seedream-4.5", {
        input: replicateInput,
      });

      // Output is an array of FileOutput objects
      const outputArray = output as Array<{ url: () => string }>;
      const imageUrl = outputArray?.[0]?.url?.() || String(outputArray?.[0]);

      if (!imageUrl) {
        return NextResponse.json(
          { error: `Unexpected Replicate response: ${JSON.stringify(output).slice(0, 300)}` },
          { status: 502 }
        );
      }

      return NextResponse.json({ url: imageUrl, seed: null });
    }

    // ── fal.ai branch ──
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
    }

    const isFlux = model === "flux2dev" || model === "flux2max";
    const isFluxMax = model === "flux2max";
    const isFluxDev = model === "flux2dev";
    const isV5 = model === "seedream5";
    const isWan = model === "wan25";
    const isHunyuan = model === "hunyuan3";
    const endpoint = MODEL_ENDPOINTS[model ?? "seedream"] ?? MODEL_ENDPOINTS.seedream;
    const imageSize = isV5
      ? RATIO_TO_SIZE_V5[aspectRatio] ?? "portrait_16_9"
      : RATIO_TO_SIZE_V4[aspectRatio] ?? "portrait_16_9";
    const resolvedSeed = seed ?? Math.floor(Math.random() * 2147483647);

    // Upload base64 reference images to fal storage (Seedream 4.5 only)
    const referenceImageUrls: string[] = [];
    if (!isFlux && !isV5 && !isWan && !isHunyuan && referenceImages?.length) {
      for (const b64 of referenceImages) {
        const blob = base64ToBlob(b64, "image/jpeg");
        const file = new File([blob], "ref.jpg", { type: "image/jpeg" });
        const url = await fal.storage.upload(file);
        referenceImageUrls.push(url);
      }
    }

    // Use /edit endpoint when reference images are provided (Seedream 4.5)
    const useEditEndpoint = referenceImageUrls.length > 0 && model === "seedream";
    const finalEndpoint = useEditEndpoint
      ? "fal-ai/bytedance/seedream/v4.5/edit"
      : endpoint;

    const input: Record<string, unknown> = {
      prompt,
      image_size: imageSize,
      seed: resolvedSeed,
      enable_safety_checker: false,
      ...(isFluxMax && { safety_tolerance: "5" }),
      ...(isFluxDev && { guidance_scale: 3.5, safety_tolerance: "6" }),
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

    return NextResponse.json({ url: imageUrl, seed: resolvedSeed });
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
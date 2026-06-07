// app/api/generate/image/route.ts

import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";
export const maxDuration = 120;

/* ── Aspect-ratio × Resolution → pixel dimensions ─────────────────── */
const SIZE_MAP: Record<string, Record<string, { width: number; height: number }>> = {
  "16:9": {
    "1K": { width: 1280, height: 720 },
    "2K": { width: 1920, height: 1080 },
    "4K": { width: 3840, height: 2160 },
  },
  "9:16": {
    "1K": { width: 720, height: 1280 },
    "2K": { width: 1080, height: 1920 },
    "4K": { width: 2160, height: 3840 },
  },
  "2:3": {
    "1K": { width: 832, height: 1248 },
    "2K": { width: 1200, height: 1800 },
    "4K": { width: 2400, height: 3600 },
  },
};

/* ── Model endpoints ───────────────────────────────────────────────── */
const MODEL_ENDPOINTS: Record<string, string> = {
  seedream: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  seedream5: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
  flux1dev: "fal-ai/flux/dev",
  flux2pro: "fal-ai/flux-2-pro",
  nanobananapro: "fal-ai/nano-banana-pro",
  gptimage2: "openai/gpt-image-2",
};

const EDIT_ENDPOINTS: Record<string, string> = {
  seedream: "fal-ai/bytedance/seedream/v4.5/edit",
  seedream5: "fal-ai/bytedance/seedream/v5/lite/edit",
  flux2pro: "fal-ai/flux-2-pro/edit",
  nanobananapro: "fal-ai/nano-banana-pro/edit",
  gptimage2: "openai/gpt-image-2/edit",
};

/* ── Models that do NOT support seed ───────────────────────────────── */
const NO_SEED_MODELS = new Set(["seedream5", "flux2pro", "gptimage2"]);

export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, aspectRatio, resolution, count, referenceImages, seed, model } =
      (await req.json()) as {
        prompt: string;
        aspectRatio: string;
        resolution?: string;
        count?: number;
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
    const isSeedream = selectedModel === "seedream" || selectedModel === "seedream5";

    const supportsRefs = isSeedream || isFlux2Pro || selectedModel === "nanobananapro" || selectedModel === "gptimage2";

    const endpoint = MODEL_ENDPOINTS[selectedModel] ?? MODEL_ENDPOINTS.seedream;

    /* ── Resolve image size from aspect ratio + resolution ──────── */
    const res = resolution ?? "1K";
    const imageSize = SIZE_MAP[aspectRatio]?.[res] ?? SIZE_MAP["9:16"]["1K"];

    /* ── Seed: skip for models that don't support it ────────────── */
    const resolvedSeed = NO_SEED_MODELS.has(selectedModel)
      ? undefined
      : (seed ?? Math.floor(Math.random() * 2147483647));

    /* ── Image count (1–4) ──────────────────────────────────────── */
    const numImages = Math.min(Math.max(count ?? 1, 1), 4);

    /* ── Upload base64 reference images to fal storage ──────────── */
    const referenceImageUrls: string[] = [];
    if (supportsRefs && referenceImages?.length) {
      for (const b64 of referenceImages) {
        const blob = base64ToBlob(b64, "image/jpeg");
        const file = new File([blob], "ref.jpg", { type: "image/jpeg" });
        const url = await fal.storage.upload(file);
        referenceImageUrls.push(url);
      }
    }

    /* ── Use /edit endpoint when reference images are provided ───── */
    const useEditEndpoint = referenceImageUrls.length > 0 && supportsRefs;
    const finalEndpoint = useEditEndpoint
      ? EDIT_ENDPOINTS[selectedModel] ?? endpoint
      : endpoint;

    /* ── Build input payload ─────────────────────────────────────── */
    const input: Record<string, unknown> = {
      prompt,
      image_size: imageSize,
      num_images: numImages,
      enable_safety_checker: false,
      ...(resolvedSeed !== undefined && { seed: resolvedSeed }),
      ...(isFlux1Dev && { guidance_scale: 3.5 }),
      ...(isFlux2Pro && { safety_tolerance: "5" }),
    };

    if (useEditEndpoint && referenceImageUrls.length > 0) {
      input.image_urls = referenceImageUrls;
    }

    const result = await fal.subscribe(finalEndpoint, { input });

    const images = (result.data as { images?: { url: string }[] })?.images;

    if (!images?.length) {
      return NextResponse.json(
        { error: `Unexpected response: ${JSON.stringify(result.data).slice(0, 300)}` },
        { status: 502 }
      );
    }

    const urls = images.map((img) => img.url);

    return NextResponse.json({
      urls,
      url: urls[0],          // backwards-compatible single URL
      seed: resolvedSeed ?? null,
    });
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
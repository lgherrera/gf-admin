// app/api/runpod/route.ts

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ENDPOINTS: Record<string, string> = {
  flux: "https://api.runpod.ai/v2/byhdkbaav3jnkh/run",
  sdxl_full: "https://api.runpod.ai/v2/0gjnd5ue2fdcjf/run",
  sdxl_lightning: "https://api.runpod.ai/v2/l8kd9k2x0jfl0p/run",
};

const MODEL_DEFAULTS: Record<string, { steps: number; guidance: number; strength: number }> = {
  flux: { steps: 15, guidance: 3.5, strength: 0.85 },
  sdxl_full: { steps: 30, guidance: 5.0, strength: 0.7 },
  sdxl_lightning: { steps: 6, guidance: 1.5, strength: 0.7 },
};

const ASPECT_TO_SIZE: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1536, height: 864 },
  "9:16": { width: 864, height: 1536 },
  "2:3": { width: 960, height: 1440 },
  "1:1": { width: 1024, height: 1024 },
};

export async function POST(req: NextRequest) {
  try {
    const password = req.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      prompt,
      aspectRatio,
      seed,
      steps,
      guidance,
      image_base64,
      strength,
      model,
      negative_prompt,
    } = (await req.json()) as {
      prompt: string;
      aspectRatio?: string;
      seed?: number;
      steps?: number;
      guidance?: number;
      image_base64?: string;
      strength?: number;
      model?: string;
      negative_prompt?: string;
    };

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    if (!process.env.RUNPOD_API_KEY) {
      return NextResponse.json({ error: "RUNPOD_API_KEY not configured" }, { status: 500 });
    }

    const selectedModel = model ?? "flux";
    const endpoint = ENDPOINTS[selectedModel];
    const defaults = MODEL_DEFAULTS[selectedModel] ?? MODEL_DEFAULTS.flux;

    if (!endpoint) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    const size = ASPECT_TO_SIZE[aspectRatio ?? "9:16"] ?? ASPECT_TO_SIZE["9:16"];

    const input: Record<string, unknown> = {
      prompt,
      width: size.width,
      height: size.height,
      steps: steps ?? defaults.steps,
      guidance: guidance ?? defaults.guidance,
    };

    if (seed !== undefined) {
      input.seed = seed;
    }

    if (image_base64) {
      input.image_base64 = image_base64;
      input.strength = strength ?? defaults.strength;
    }

    // SDXL models support negative prompts
    if (selectedModel !== "flux" && negative_prompt) {
      input.negative_prompt = negative_prompt;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({ input }),
    });

    const data = await res.json();

    if (!res.ok || !data.id) {
      return NextResponse.json(
        { error: data.error || "Failed to start RunPod job" },
        { status: 502 }
      );
    }

    return NextResponse.json({ jobId: data.id, status: data.status, model: selectedModel });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("RunPod start error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
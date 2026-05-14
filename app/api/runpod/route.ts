// app/api/runpod/route.ts

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RUNPOD_ENDPOINT = "https://api.runpod.ai/v2/byhdkbaav3jnkh/run";

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

    const { prompt, aspectRatio, seed, steps, guidance } = (await req.json()) as {
      prompt: string;
      aspectRatio?: string;
      seed?: number;
      steps?: number;
      guidance?: number;
    };

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    if (!process.env.RUNPOD_API_KEY) {
      return NextResponse.json({ error: "RUNPOD_API_KEY not configured" }, { status: 500 });
    }

    const size = ASPECT_TO_SIZE[aspectRatio ?? "9:16"] ?? ASPECT_TO_SIZE["9:16"];

    const input: Record<string, unknown> = {
      prompt,
      width: size.width,
      height: size.height,
      steps: steps ?? 15,
      guidance: guidance ?? 3.5,
    };

    if (seed !== undefined) {
      input.seed = seed;
    }

    const res = await fetch(RUNPOD_ENDPOINT, {
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

    return NextResponse.json({ jobId: data.id, status: data.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("RunPod start error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
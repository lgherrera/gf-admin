// app/api/runpod/status/route.ts

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RUNPOD_STATUS_BASE = "https://api.runpod.ai/v2/byhdkbaav3jnkh/status";

export async function GET(req: NextRequest) {
  try {
    const password = req.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobId = req.nextUrl.searchParams.get("id");
    if (!jobId) {
      return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    }

    if (!process.env.RUNPOD_API_KEY) {
      return NextResponse.json({ error: "RUNPOD_API_KEY not configured" }, { status: 500 });
    }

    const res = await fetch(`${RUNPOD_STATUS_BASE}/${jobId}`, {
      headers: {
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
      },
    });

    const data = await res.json();

    if (data.status === "COMPLETED") {
      const base64 = data.output?.image_base64;
      const seed = data.output?.seed ?? null;

      if (!base64) {
        return NextResponse.json(
          { status: "FAILED", error: "No image in output" },
          { status: 502 }
        );
      }

      const url = `data:image/png;base64,${base64}`;
      return NextResponse.json({ status: "COMPLETED", url, seed });
    }

    if (data.status === "FAILED") {
      return NextResponse.json({
        status: "FAILED",
        error: data.error || "Job failed",
      });
    }

    // IN_QUEUE or IN_PROGRESS
    return NextResponse.json({ status: data.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("RunPod status error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
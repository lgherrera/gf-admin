// app/api/atlas-cloud/status/route.ts

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const password = req.headers.get("x-admin-password");
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const predictionId = req.nextUrl.searchParams.get("id");
    if (!predictionId) {
      return NextResponse.json(
        { error: "Missing prediction ID" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.atlascloud.ai/api/v1/model/prediction/${predictionId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.ATLAS_CLOUD_API_KEY}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Atlas Cloud status error:", result);
      return NextResponse.json(
        { error: result.error || "Status check failed" },
        { status: response.status }
      );
    }

    // Normalize response
    const data = result?.data || result;
    const status = data.status;
    const outputs = data.outputs || [];
    const error = data.error;
    const predictTime = data.metrics?.predict_time;

    return NextResponse.json({
      status,
      outputs,
      error,
      predictTime,
    });
  } catch (err: unknown) {
    console.error("Status error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status check failed" },
      { status: 500 }
    );
  }
}
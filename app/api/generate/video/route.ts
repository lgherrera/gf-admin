// app/api/generate/video/route.ts
 
import { NextRequest, NextResponse } from "next/server";
 
export const runtime = "nodejs";
export const maxDuration = 120;
 
export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
 
  // TODO: implement video generation
  return NextResponse.json({ error: "Video generation not yet implemented" }, { status: 501 });
}
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { writeLocalUpload } from "@/lib/storage";

// Local-dev fallback for photo uploads when no S3-compatible bucket is configured.
// Mirrors the shape of a presigned PUT so the client upload code path is identical
// whether it's talking to S3/R2 or this route.
export async function PUT(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = req.nextUrl.searchParams.get("key");
  if (!key || !key.startsWith(`${user.orgId}/`)) {
    return NextResponse.json({ error: "Invalid upload key" }, { status: 400 });
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  await writeLocalUpload(key, buffer);

  return NextResponse.json({ ok: true });
}

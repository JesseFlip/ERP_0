import { NextRequest, NextResponse } from "next/server";
import { processSyncQueue } from "@/lib/qbo/sync";

// Vercel Cron (see vercel.json) hits this on a schedule to retry failed QBO pushes.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processSyncQueue();
  return NextResponse.json(result);
}

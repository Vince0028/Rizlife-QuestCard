import { NextRequest, NextResponse } from "next/server";
import { runScheduledDigests } from "@rizlife/shared/digest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron invocation" }, { status: 401 });
    }
  }

  const dispatched = await runScheduledDigests();
  return NextResponse.json({
    ok: true,
    dispatchedCount: dispatched.length,
    dispatched,
  });
}

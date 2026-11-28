import { NextRequest, NextResponse } from "next/server";
import { checkCronAuthorization } from "@rizlife/shared/cron-auth";
import { runScheduledDigests } from "@rizlife/shared/digest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = checkCronAuthorization(req.headers.get("authorization"));
  if (!auth.ok) {
    if (auth.status === 503) console.error(`[RizLife Cron] ${auth.error}`);
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const dispatched = await runScheduledDigests();
  return NextResponse.json({
    ok: true,
    dispatchedCount: dispatched.length,
    dispatched,
  });
}

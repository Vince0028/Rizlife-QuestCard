import { NextRequest, NextResponse } from "next/server";
import {
  reviewOrStampSubmission,
  toWorkspaceError,
} from "@rizlife/shared/workspace-service";
import { getTeacherSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getTeacherSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const submission = await reviewOrStampSubmission(body, session);
    return NextResponse.json({ ok: true, submission });
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

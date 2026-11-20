import { NextRequest, NextResponse } from "next/server";
import {
  toWorkspaceError,
  updateManagedStudent,
} from "@rizlife/shared/workspace-service";
import { getTeacherSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  const session = await getTeacherSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { studentId } = await context.params;
  try {
    const body = await req.json().catch(() => ({}));
    const res = await updateManagedStudent({
      studentUserId: studentId,
      rawBody: body,
      actor: session,
    });
    return NextResponse.json(res);
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

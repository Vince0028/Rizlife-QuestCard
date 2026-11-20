import { NextRequest, NextResponse } from "next/server";
import {
  removeStudentFromSection,
  toWorkspaceError,
} from "@rizlife/shared/workspace-service";
import { getTeacherSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ sectionId: string; studentId: string }> }
) {
  const session = await getTeacherSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sectionId, studentId } = await context.params;
  try {
    const res = await removeStudentFromSection({
      sectionId,
      studentId,
      user: session,
    });
    return NextResponse.json(res);
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

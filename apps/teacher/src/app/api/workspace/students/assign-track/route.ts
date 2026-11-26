import { NextRequest, NextResponse } from "next/server";
import {
  toWorkspaceError,
  updateEnrollmentTrack,
} from "@rizlife/shared/workspace-service";
import { updateEnrollmentTrackSchema } from "@rizlife/shared/validation";
import { getTeacherSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getTeacherSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = updateEnrollmentTrackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload." },
        { status: 400 }
      );
    }

    const res = await updateEnrollmentTrack({
      sectionId: parsed.data.sectionId,
      studentIds: parsed.data.studentIds,
      finalsTrack: parsed.data.finalsTrack,
      assignedModuleTitle: parsed.data.assignedModuleTitle,
      assignedModuleUrl: parsed.data.assignedModuleUrl,
      user: session,
    });

    return NextResponse.json(res);
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

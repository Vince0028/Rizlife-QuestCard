import { NextRequest, NextResponse, after } from "next/server";
import {
  submitStudentQuest,
  toWorkspaceError,
} from "@rizlife/shared/workspace-service";
import { getStudentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    const { urlCheck, submission: updated } = await submitStudentQuest({
      studentUserId: session.userId,
      rawBody: body,
      // The threshold digest (possibly an SMTP/Resend call) runs after the response.
      scheduleDigestCheck: (task) => after(task),
    });

    return NextResponse.json({
      ok: true,
      urlCheck,
      submission: {
        id: updated.id,
        questId: updated.questId,
        submissionUrl: updated.submissionUrl,
        studentNote: updated.studentNote,
        status: updated.status,
        teacherFeedback: updated.teacherFeedback,
        submittedAt: updated.submittedAt?.toISOString() ?? null,
        stampedAt: updated.stampedAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    const e = toWorkspaceError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}

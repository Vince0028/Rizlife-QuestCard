import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rizlife/shared/db";
import { maybeTriggerThresholdDigest } from "@rizlife/shared/digest";
import { submitQuestSchema, validateSubmissionUrl } from "@rizlife/shared/validation";
import { getStudentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = submitQuestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid submission data." },
      { status: 400 }
    );
  }

  const urlCheck = validateSubmissionUrl(parsed.data.submissionUrl);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    return NextResponse.json(
      { error: urlCheck.error || "Please enter a valid URL." },
      { status: 400 }
    );
  }

  const quest = await prisma.quest.findUnique({
    where: { id: parsed.data.questId },
  });
  if (!quest) {
    return NextResponse.json({ error: "Quest not found." }, { status: 404 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_sectionId: {
        studentId: session.userId,
        sectionId: quest.sectionId,
      },
    },
  });
  if (!enrollment) {
    return NextResponse.json(
      { error: "You are not enrolled in this quest's section." },
      { status: 403 }
    );
  }

  const existing = await prisma.submission.findUnique({
    where: {
      questId_studentId: {
        questId: quest.id,
        studentId: session.userId,
      },
    },
  });

  if (existing?.status === "STAMPED") {
    return NextResponse.json(
      { error: "This quest has already been stamped and verified by your instructor." },
      { status: 409 }
    );
  }

  const now = new Date();
  const updated = await prisma.submission.upsert({
    where: {
      questId_studentId: {
        questId: quest.id,
        studentId: session.userId,
      },
    },
    update: {
      submissionUrl: urlCheck.normalizedUrl,
      studentNote: parsed.data.studentNote?.trim() || null,
      status: "PENDING_REVIEW",
      firstSubmittedAt: existing?.firstSubmittedAt ?? now,
      submittedAt: now,
      includedInDigest: false,
    },
    create: {
      questId: quest.id,
      studentId: session.userId,
      submissionUrl: urlCheck.normalizedUrl,
      studentNote: parsed.data.studentNote?.trim() || null,
      status: "PENDING_REVIEW",
      firstSubmittedAt: now,
      submittedAt: now,
      includedInDigest: false,
    },
  });

  await maybeTriggerThresholdDigest(quest.sectionId);

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
}

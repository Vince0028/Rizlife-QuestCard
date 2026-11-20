import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rizlife/shared/db";
import { computeLeaderboard } from "@rizlife/shared/leaderboard";
import type { SubmissionStatusValue } from "@rizlife/shared/types";
import { getStudentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: session.userId },
    include: {
      section: {
        include: {
          teacher: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const sections = enrollments.map((e) => ({
    id: e.section.id,
    code: e.section.code,
    name: e.section.name,
    term: e.section.term,
    leaderboardVisible: e.section.leaderboardVisible,
    teacherName: e.section.teacher
      ? `${e.section.teacher.firstName} ${e.section.teacher.lastName}`
      : "To Be Assigned",
    teacherEmail: e.section.teacher?.email ?? "",
  }));

  if (sections.length === 0) {
    return NextResponse.json({
      student: session,
      sections: [],
      activeSection: null,
      quests: [],
      submissions: [],
      leaderboard: { visible: false, entries: [] },
    });
  }

  const requestedSectionId = req.nextUrl.searchParams.get("sectionId");
  const activeSection =
    sections.find((s) => s.id === requestedSectionId) ?? sections[0];

  const [quests, mySubmissions] = await Promise.all([
    prisma.quest.findMany({
      where: { sectionId: activeSection.id },
      orderBy: { taskNumber: "asc" },
    }),
    prisma.submission.findMany({
      where: {
        studentId: session.userId,
        quest: { sectionId: activeSection.id },
      },
    }),
  ]);

  let leaderboardEntries: ReturnType<typeof computeLeaderboard> = [];
  if (activeSection.leaderboardVisible) {
    const [sectionEnrollments, allSubs] = await Promise.all([
      prisma.enrollment.findMany({
        where: { sectionId: activeSection.id },
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              lastName: true,
              courseCode: true,
            },
          },
        },
      }),
      prisma.submission.findMany({
        where: { quest: { sectionId: activeSection.id } },
        select: {
          studentId: true,
          questId: true,
          status: true,
          firstSubmittedAt: true,
          submittedAt: true,
          stampedAt: true,
        },
      }),
    ]);

    leaderboardEntries = computeLeaderboard(
      sectionEnrollments.map((e) => e.student),
      allSubs.map((s) => ({
        ...s,
        status: s.status as SubmissionStatusValue,
      })),
      quests.length
    );
  }

  return NextResponse.json({
    student: session,
    sections,
    activeSection,
    quests: quests.map((q) => ({
      id: q.id,
      taskNumber: q.taskNumber,
      title: q.title,
      description: q.description,
      category: q.category,
      openlearningUrl: q.openlearningUrl,
      startDate: q.startDate ? q.startDate.toISOString() : null,
      deadline: q.deadline ? q.deadline.toISOString() : null,
    })),
    submissions: mySubmissions.map((s) => ({
      id: s.id,
      questId: s.questId,
      submissionUrl: s.submissionUrl,
      studentNote: s.studentNote,
      status: s.status,
      teacherFeedback: s.teacherFeedback,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      stampedAt: s.stampedAt ? s.stampedAt.toISOString() : null,
    })),
    leaderboard: {
      visible: activeSection.leaderboardVisible,
      entries: leaderboardEntries,
    },
  });
}

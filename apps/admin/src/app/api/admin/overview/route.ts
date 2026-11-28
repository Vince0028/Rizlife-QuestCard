import { NextResponse } from "next/server";
import { requirePasswordChanged } from "@rizlife/shared/portal-auth";
import { prisma } from "@rizlife/shared/db";
import { isMicrosoftSsoConfigured } from "@rizlife/shared/microsoft-sso";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const passwordGate = requirePasswordChanged(session);
  if (passwordGate) return passwordGate;

  const [
    users,
    sections,
    questCount,
    stampedCount,
    pendingCount,
    digestCount,
    recentDigests,
    settings,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        studentId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        role: true,
        courseCode: true,
        mustChangePassword: true,
        isActive: true,
        createdAt: true,
        _count: { select: { taughtSections: true, enrollments: true } },
      },
      orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.section.findMany({
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { enrollments: true, quests: true } },
      },
      orderBy: [{ term: "desc" }, { code: "asc" }],
    }),
    prisma.quest.count(),
    prisma.submission.count({ where: { status: "STAMPED" } }),
    prisma.submission.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.emailDigestLog.count(),
    prisma.emailDigestLog.findMany({
      select: {
        id: true,
        recipientEmail: true,
        submissionCount: true,
        triggerType: true,
        deliveryStatus: true,
        sentAt: true,
        section: { select: { code: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
      orderBy: { sentAt: "desc" },
      take: 10,
    }),
    prisma.systemSetting.upsert({
      where: { id: "global" },
      update: {},
      create: { id: "global" },
    }),
  ]);

  return NextResponse.json({
    metrics: {
      totalStudents: users.filter((u) => u.role === "STUDENT").length,
      totalTeachers: users.filter((u) => u.role === "TEACHER").length,
      totalAdmins: users.filter((u) => u.role === "ADMIN").length,
      totalSections: sections.length,
      totalQuests: questCount,
      stampedSubmissions: stampedCount,
      pendingSubmissions: pendingCount,
      digestsSent: digestCount,
    },
    users,
    sections,
    recentDigests: recentDigests.map((d) => ({
      id: d.id,
      sectionCode: d.section.code,
      teacherName: `${d.teacher.firstName} ${d.teacher.lastName}`,
      recipientEmail: d.recipientEmail,
      submissionCount: d.submissionCount,
      triggerType: d.triggerType,
      deliveryStatus: d.deliveryStatus,
      sentAt: d.sentAt.toISOString(),
    })),
    settings,
    envStatus: {
      microsoftSsoConfigured: isMicrosoftSsoConfigured(),
      resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
      smtpConfigured: Boolean(
        process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim()
      ),
    },
  });
}

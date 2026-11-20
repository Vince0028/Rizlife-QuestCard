import nodemailer from "nodemailer";
import { prisma } from "./db";
import type { DigestQuestGroup, DigestQueueSummary } from "./types";

interface DigestSubmissionRow {
  id: string;
  submittedAt: Date | null;
  submissionUrl: string | null;
  quest: {
    id: string;
    taskNumber: number;
    title: string;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentId: string | null;
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDigestEmailHtml(params: {
  sectionId: string;
  sectionCode: string;
  sectionName: string;
  term: string;
  teacherName: string;
  groups: DigestQuestGroup[];
  totalSubmissions: number;
  uniqueStudents: number;
  teacherPortalUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `[RizLife QuestCard] ${params.uniqueStudents} ${
    params.uniqueStudents === 1 ? "Student Has" : "Students Have"
  } Submitted Quests for Review (Section ${params.sectionCode})`;

  const reviewLink = `${params.teacherPortalUrl.replace(/\/$/, "")}/dashboard?section=${encodeURIComponent(
    params.sectionId
  )}&tab=queue`;

  const taskNumbers = params.groups.map((g) => g.taskNumber).sort((a, b) => a - b);
  const taskSpan =
    taskNumbers.length === 0
      ? "assigned tasks"
      : taskNumbers.length === 1
      ? `Task ${taskNumbers[0]}`
      : `Tasks ${taskNumbers[0]}–${taskNumbers[taskNumbers.length - 1]}`;

  const groupBulletsHtml = params.groups
    .map((group) => {
      const namesPreview = group.students
        .slice(0, 6)
        .map((s) => escapeHtml(s.studentName))
        .join(", ");
      const remaining =
        group.students.length > 6 ? ` +${group.students.length - 6} more` : "";
      return `
        <li style="margin-bottom: 10px; line-height: 1.45;">
          <strong style="color: #2C2520;">Task ${group.taskNumber}: ${escapeHtml(
            group.title
          )}</strong>
          <span style="display: inline-block; margin-left: 6px; padding: 2px 8px; border-radius: 999px; background: #FEF3C7; color: #92400E; font-size: 12px; font-weight: 600;">
            ${group.count} pending
          </span>
          <div style="font-size: 13px; color: #6B5E53; margin-top: 2px;">
            Students: ${namesPreview}${remaining}
          </div>
        </li>
      `;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background-color:#F4EFE6;font-family:'Segoe UI',Arial,sans-serif;color:#2C2520;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#FAF7F2;border:1px solid #D8CBB8;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#2C2520;color:#FAF7F2;padding:20px 28px;border-bottom:3px solid #C5A880;">
          <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#C5A880;">Asia Pacific College • GE-Rizal</div>
          <h1 style="margin:6px 0 0;font-size:22px;font-family:Georgia,serif;">RizLife QuestCard Review Digest</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:26px 28px;">
          <p style="margin:0 0 14px;font-size:15px;">Good day, <strong>${escapeHtml(
            params.teacherName
          )}</strong>,</p>
          <div style="background:#F4EFE6;border-left:4px solid #15803D;padding:14px 16px;border-radius:6px;margin-bottom:18px;">
            <p style="margin:0;font-size:15px;line-height:1.5;">
              You have <strong>${params.totalSubmissions} pending quest ${
                params.totalSubmissions === 1 ? "submission" : "submissions"
              }</strong> from <strong>${params.uniqueStudents} ${
                params.uniqueStudents === 1 ? "student" : "students"
              }</strong> in <strong>${escapeHtml(params.sectionCode)}</strong> (${escapeHtml(
    params.term
  )}) waiting to be checked across <strong>${taskSpan}</strong>.
            </p>
          </div>
          <p style="margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:0.8px;color:#6B5E53;font-weight:700;">
            Summary Breakdown by Quest
          </p>
          <ul style="margin:0 0 22px;padding-left:20px;">
            ${groupBulletsHtml}
          </ul>
          <div style="text-align:center;margin:24px 0 8px;">
            <a href="${escapeHtml(
              reviewLink
            )}" style="display:inline-block;background:#15803D;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;font-size:14px;">
              Open Your Teacher Review Queue →
            </a>
          </div>
          <p style="margin:20px 0 0;font-size:12px;color:#6B5E53;text-align:center;">
            All student requests were batched into this single email to prevent Outlook inbox flooding.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = [
    `RizLife QuestCard Review Digest (${params.sectionCode} - ${params.term})`,
    "",
    `You have ${params.totalSubmissions} pending quest submissions from ${params.uniqueStudents} students across ${taskSpan}.`,
    "",
    ...params.groups.map(
      (g) =>
        `- Task ${g.taskNumber}: ${g.title} (${g.count} pending) - ${g.students
          .map((s) => s.studentName)
          .join(", ")}`
    ),
    "",
    `Open Review Queue: ${reviewLink}`,
  ];

  return { subject, html, text: textLines.join("\n") };
}

function groupDigestSubmissions(rows: DigestSubmissionRow[]): {
  groups: DigestQuestGroup[];
  uniqueStudents: number;
} {
  const map = new Map<string, DigestQuestGroup>();
  const studentSet = new Set<string>();

  for (const row of rows) {
    studentSet.add(row.student.id);
    let group = map.get(row.quest.id);
    if (!group) {
      group = {
        questId: row.quest.id,
        taskNumber: row.quest.taskNumber,
        title: row.quest.title,
        count: 0,
        students: [],
      };
      map.set(row.quest.id, group);
    }
    group.count += 1;
    group.students.push({
      submissionId: row.id,
      studentName: `${row.student.lastName}, ${row.student.firstName}`,
      studentNumber: row.student.studentId,
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      submissionUrl: row.submissionUrl,
    });
  }

  const groups = Array.from(map.values()).sort((a, b) => a.taskNumber - b.taskNumber);
  return { groups, uniqueStudents: studentSet.size };
}

export async function getSectionDigestQueue(
  sectionId: string
): Promise<DigestQueueSummary | null> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      teacher: true,
    },
  });

  if (!section) return null;

  const pendingRows = await prisma.submission.findMany({
    where: {
      quest: { sectionId },
      status: "PENDING_REVIEW",
      includedInDigest: false,
    },
    include: {
      quest: {
        select: { id: true, taskNumber: true, title: true },
      },
      student: {
        select: { id: true, firstName: true, lastName: true, studentId: true },
      },
    },
    orderBy: [{ quest: { taskNumber: "asc" } }, { submittedAt: "asc" }],
  });

  const { groups, uniqueStudents } = groupDigestSubmissions(pendingRows);
  const teacherPortalUrl =
    process.env.NEXT_PUBLIC_TEACHER_PORTAL_URL || "http://localhost:3002";

  const teacherName = section.teacher
    ? `${section.teacher.firstName} ${section.teacher.lastName}`
    : "Unassigned Teacher";
  const teacherEmail = section.teacher?.email ?? "";
  const { subject, html } = buildDigestEmailHtml({
    sectionId: section.id,
    sectionCode: section.code,
    sectionName: section.name,
    term: section.term,
    teacherName,
    groups,
    totalSubmissions: pendingRows.length,
    uniqueStudents,
    teacherPortalUrl,
  });

  return {
    sectionId: section.id,
    sectionCode: section.code,
    sectionName: section.name,
    teacherEmail,
    teacherName,
    digestEnabled: section.digestEnabled,
    digestThreshold: section.digestThreshold,
    lastDigestSentAt: section.lastDigestSentAt
      ? section.lastDigestSentAt.toISOString()
      : null,
    pendingCount: pendingRows.length,
    uniqueStudentCount: uniqueStudents,
    subject,
    groups,
    htmlPreview: html,
  };
}

async function dispatchEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  provider: string;
  fromAddress: string;
}): Promise<{ status: "SENT" | "PREVIEW_ONLY" | "FAILED"; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (params.provider === "resend" && resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: params.fromAddress,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        return { status: "FAILED", error: `Resend API error: ${msg}` };
      }
      return { status: "SENT" };
    } catch (err) {
      return {
        status: "FAILED",
        error: err instanceof Error ? err.message : "Resend transport failed",
      };
    }
  }

  if (params.provider === "smtp" && smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      await transporter.sendMail({
        from: params.fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      return { status: "SENT" };
    } catch (err) {
      return {
        status: "FAILED",
        error: err instanceof Error ? err.message : "SMTP transport failed",
      };
    }
  }

  // Fallback: record preview cleanly without failing teacher workflow
  if (params.provider === "resend" && !resendKey) {
    return { status: "PREVIEW_ONLY" };
  }
  if (params.provider === "smtp" && (!smtpHost || !smtpUser)) {
    return { status: "PREVIEW_ONLY" };
  }

  return { status: "PREVIEW_ONLY" };
}

export async function sendSectionDigest(
  sectionId: string,
  triggerType: "THRESHOLD" | "SCHEDULED" | "MANUAL"
): Promise<{
  sent: boolean;
  submissionCount: number;
  deliveryStatus?: string;
  logId?: string;
  error?: string;
}> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { teacher: true },
  });

  if (!section) {
    return { sent: false, submissionCount: 0, error: "Section not found." };
  }

  if (!section.teacher || !section.teacherId) {
    return {
      sent: false,
      submissionCount: 0,
      error: "Assign a teacher to this section before sending email summaries.",
    };
  }

  const assignedTeacherId = section.teacherId;
  const assignedTeacher = section.teacher;

  const pendingRows = await prisma.submission.findMany({
    where: {
      quest: { sectionId },
      status: "PENDING_REVIEW",
      includedInDigest: false,
    },
    include: {
      quest: { select: { id: true, taskNumber: true, title: true } },
      student: {
        select: { id: true, firstName: true, lastName: true, studentId: true },
      },
    },
    orderBy: [{ quest: { taskNumber: "asc" } }, { submittedAt: "asc" }],
  });

  if (pendingRows.length === 0) {
    return { sent: false, submissionCount: 0 };
  }

  const settings = await prisma.systemSetting.findUnique({
    where: { id: "global" },
  });

  const provider = settings?.emailProvider ?? "preview";
  const fromAddress =
    process.env.EMAIL_FROM ||
    settings?.emailFromAddress ||
    "RizLife QuestCard <noreply@rizlife.apc.edu.ph>";

  const { groups, uniqueStudents } = groupDigestSubmissions(pendingRows);
  const teacherPortalUrl =
    process.env.NEXT_PUBLIC_TEACHER_PORTAL_URL || "http://localhost:3002";

  const { subject, html, text } = buildDigestEmailHtml({
    sectionId: section.id,
    sectionCode: section.code,
    sectionName: section.name,
    term: section.term,
    teacherName: `${assignedTeacher.firstName} ${assignedTeacher.lastName}`,
    groups,
    totalSubmissions: pendingRows.length,
    uniqueStudents,
    teacherPortalUrl,
  });

  const dispatch = await dispatchEmail({
    to: assignedTeacher.email,
    subject,
    html,
    text,
    provider,
    fromAddress,
  });

  const submissionIds = pendingRows.map((r) => r.id);
  const now = new Date();

  const log = await prisma.$transaction(async (tx) => {
    if (dispatch.status !== "FAILED") {
      await tx.submission.updateMany({
        where: { id: { in: submissionIds } },
        data: { includedInDigest: true },
      });
      await tx.section.update({
        where: { id: section.id },
        data: { lastDigestSentAt: now },
      });
    }

    return tx.emailDigestLog.create({
      data: {
        teacherId: assignedTeacherId,
        sectionId: section.id,
        recipientEmail: assignedTeacher.email,
        subject,
        submissionCount: pendingRows.length,
        triggerType,
        deliveryStatus: dispatch.status,
        htmlPreview: html,
        errorMessage: dispatch.error ?? null,
        sentAt: now,
      },
    });
  });

  return {
    sent: dispatch.status !== "FAILED",
    submissionCount: pendingRows.length,
    deliveryStatus: dispatch.status,
    logId: log.id,
    error: dispatch.error,
  };
}

export async function maybeTriggerThresholdDigest(sectionId: string): Promise<void> {
  try {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      select: { id: true, digestEnabled: true, digestThreshold: true },
    });
    if (!section || !section.digestEnabled) return;

    const pendingCount = await prisma.submission.count({
      where: {
        quest: { sectionId },
        status: "PENDING_REVIEW",
        includedInDigest: false,
      },
    });

    if (pendingCount >= section.digestThreshold) {
      await sendSectionDigest(sectionId, "THRESHOLD");
    }
  } catch (err) {
    console.error("[RizLife Digest] Threshold digest check failed:", err);
  }
}

export async function runScheduledDigests() {
  const sections = await prisma.section.findMany({
    where: { digestEnabled: true },
    select: { id: true, code: true },
  });

  const results = [];
  for (const sec of sections) {
    const res = await sendSectionDigest(sec.id, "SCHEDULED");
    if (res.submissionCount > 0) {
      results.push({ sectionCode: sec.code, ...res });
    }
  }
  return results;
}

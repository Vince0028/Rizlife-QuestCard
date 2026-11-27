import { prisma } from "./db";
import { computeLeaderboard } from "./leaderboard";
import {
  getSectionDigestQueue,
  maybeTriggerThresholdDigest,
  sendSectionDigest,
} from "./digest";
import { generateDefaultPassword, hashPassword } from "./password";
import {
  generateTrackerCsv,
  generateTrackerWorkbook,
  parseStudentImportFile,
} from "./excel";
import {
  createSectionSchema,
  createStudentSchema,
  questPayloadSchema,
  reviewSubmissionSchema,
  submitQuestSchema,
  updateSectionSettingsSchema,
  updateStudentSchema,
  validateSubmissionUrl,
} from "./validation";
import type { RoleValue, SessionPayload, SubmissionStatusValue } from "./types";

const GENERIC_SERVER_ERROR =
  "Something went wrong on the server. Please try again, or contact the RizLife administrator if it keeps happening.";

/**
 * Maps a thrown error to an HTTP status + client-safe message. Errors thrown on purpose
 * carry `status` and a user-facing message. Prisma (and adapter) constraint errors map
 * to 404/409. Anything else is logged server-side and returned as a generic 500, so
 * database or internal details never reach the browser.
 */
export function toWorkspaceError(err: unknown): { status: number; message: string } {
  const e = (typeof err === "object" && err !== null ? err : {}) as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
  };
  if (typeof e.status === "number" && e.status >= 400 && e.status < 500) {
    return {
      status: e.status,
      message: typeof e.message === "string" ? e.message : "Request failed.",
    };
  }
  if (e.code === "P2002") {
    return { status: 409, message: "A record with these details already exists." };
  }
  if (e.code === "P2025") {
    return { status: 404, message: "That record no longer exists. Refresh and try again." };
  }
  if (e.code === "P2003") {
    return {
      status: 409,
      message: "This change conflicts with related records. Refresh and try again.",
    };
  }
  console.error("[RizLife] Unhandled workspace error:", err);
  return { status: 500, message: GENERIC_SERVER_ERROR };
}

/** Thrown for request problems the user can fix (default 400). */
export function clientError(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

/** The global allowed student email domain (Admin settings), e.g. "student.apc.edu.ph". */
async function getAllowedStudentDomain(): Promise<string> {
  const settings = await prisma.systemSetting.findUnique({ where: { id: "global" } });
  return (settings?.allowedStudentDomain ?? "student.apc.edu.ph")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}

function parseOptionalDate(value: string | null | undefined, label: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw clientError(`${label} is not a valid date.`);
  return d;
}

function assertDateOrder(start: Date | null, deadline: Date | null) {
  if (start && deadline && deadline.getTime() < start.getTime()) {
    throw clientError("The deadline can't be before the start date.");
  }
}

/**
 * Teachers may only manage students enrolled in their own sections. A student who is
 * also enrolled in another teacher's (or an unassigned) section is "shared": their
 * password, email and Student ID can only be changed by an admin.
 */
async function getStudentScopeForTeacher(targetId: string, actor: SessionPayload) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: targetId },
    include: { section: { select: { teacherId: true } } },
  });
  return {
    inMySection: enrollments.some((e) => e.section.teacherId === actor.userId),
    shared: enrollments.some((e) => e.section.teacherId !== actor.userId),
  };
}

export async function assertSectionAccess(
  sectionId: string,
  user: SessionPayload
) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      teacher: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!section) {
    throw Object.assign(new Error("Section not found."), { status: 404 });
  }

  if (user.role !== "ADMIN" && section.teacherId !== user.userId) {
    throw Object.assign(new Error("Forbidden: You do not manage this section."), {
      status: 403,
    });
  }

  return section;
}

export async function listManageableSections(user: SessionPayload) {
  const where = user.role === "ADMIN" ? {} : { teacherId: user.userId };
  return prisma.section.findMany({
    where,
    include: {
      teacher: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      _count: {
        select: { enrollments: true, quests: true },
      },
    },
    orderBy: [{ term: "desc" }, { code: "asc" }],
  });
}

export async function getSectionWorkspaceData(
  sectionId: string,
  user: SessionPayload
) {
  const section = await assertSectionAccess(sectionId, user);

  const [quests, enrollments, submissions, digestQueue, digestLogs, lastSentLog] =
    await Promise.all([
      prisma.quest.findMany({
        where: { sectionId },
        orderBy: { taskNumber: "asc" },
      }),
      prisma.enrollment.findMany({
        where: { sectionId },
        include: {
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
              courseCode: true,
              mustChangePassword: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
      }),
      prisma.submission.findMany({
        where: { quest: { sectionId } },
        include: {
          quest: { select: { id: true, taskNumber: true, title: true } },
          stampedBy: { select: { firstName: true, lastName: true } },
          student: {
            select: {
              id: true,
              studentId: true,
              firstName: true,
              middleName: true,
              lastName: true,
              courseCode: true,
              email: true,
            },
          },
        },
        orderBy: [{ submittedAt: "asc" }],
      }),
      getSectionDigestQueue(sectionId),
      // htmlPreview is loaded on demand (getDigestLogPreview) so the workspace payload
      // and the Supabase adapter cache don't carry 15 full email bodies.
      prisma.emailDigestLog.findMany({
        where: { sectionId },
        orderBy: { sentAt: "desc" },
        take: 15,
        select: {
          id: true,
          recipientEmail: true,
          subject: true,
          submissionCount: true,
          triggerType: true,
          deliveryStatus: true,
          errorMessage: true,
          sentAt: true,
        },
      }),
      prisma.emailDigestLog.findFirst({
        where: { sectionId, deliveryStatus: "SENT" },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      }),
    ]);

  const students = enrollments.map((e) => ({
    ...e.student,
    finalsTrack: e.finalsTrack,
    assignedModuleTitle: e.assignedModuleTitle,
    assignedModuleUrl: e.assignedModuleUrl,
  }));
  const leaderboard = computeLeaderboard(
    students.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      firstName: s.firstName,
      middleName: s.middleName,
      lastName: s.lastName,
      courseCode: s.courseCode,
    })),
    submissions.map((sub) => ({
      studentId: sub.studentId,
      questId: sub.questId,
      status: sub.status as SubmissionStatusValue,
      firstSubmittedAt: sub.firstSubmittedAt,
      submittedAt: sub.submittedAt,
      stampedAt: sub.stampedAt,
    })),
    quests.length
  );

  return {
    section: {
      id: section.id,
      code: section.code,
      name: section.name,
      term: section.term,
      teacherId: section.teacherId,
      teacherName: section.teacher
        ? `${section.teacher.firstName} ${section.teacher.lastName}`
        : "Unassigned (Assign Teacher)",
      teacherEmail: section.teacher?.email ?? "",
      leaderboardVisible: section.leaderboardVisible,
      digestThreshold: section.digestThreshold,
      digestEnabled: section.digestEnabled,
      // Latest digest actually emailed (Section.lastDigestSentAt is the last *attempt*).
      lastDigestSentAt: lastSentLog ? lastSentLog.sentAt.toISOString() : null,
    },
    quests: quests.map((q) => ({
      id: q.id,
      sectionId: q.sectionId,
      taskNumber: q.taskNumber,
      title: q.title,
      description: q.description,
      category: q.category,
      openlearningUrl: q.openlearningUrl,
      startDate: q.startDate ? q.startDate.toISOString() : null,
      deadline: q.deadline ? q.deadline.toISOString() : null,
    })),
    students,
    submissions: submissions.map((s) => ({
      id: s.id,
      questId: s.questId,
      studentId: s.studentId,
      submissionUrl: s.submissionUrl,
      studentNote: s.studentNote,
      status: s.status as SubmissionStatusValue,
      teacherFeedback: s.teacherFeedback,
      firstSubmittedAt: s.firstSubmittedAt
        ? s.firstSubmittedAt.toISOString()
        : null,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      stampedAt: s.stampedAt ? s.stampedAt.toISOString() : null,
      stampedByName: s.stampedBy
        ? `${s.stampedBy.firstName} ${s.stampedBy.lastName}`
        : null,
      includedInDigest: s.includedInDigest,
      quest: s.quest,
      student: s.student,
    })),
    leaderboard,
    digestQueue,
    digestLogs: digestLogs.map((l) => ({
      id: l.id,
      recipientEmail: l.recipientEmail,
      subject: l.subject,
      submissionCount: l.submissionCount,
      triggerType: l.triggerType,
      deliveryStatus: l.deliveryStatus,
      errorMessage: l.errorMessage,
      sentAt: l.sentAt.toISOString(),
    })),
  };
}

export async function createManagedSection(
  rawBody: unknown,
  user: SessionPayload
) {
  const parsed = createSectionSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues[0]?.message || "Invalid section input."),
      { status: 400 }
    );
  }

  const settings = await prisma.systemSetting.findUnique({
    where: { id: "global" },
  });

  const teacherId: string | null =
    user.role === "ADMIN"
      ? parsed.data.teacherId?.trim() || null
      : user.userId;

  const term = parsed.data.term || settings?.activeTerm || "Term 2 AY 2026-2027";
  const digestThreshold =
    parsed.data.digestThreshold ?? settings?.defaultDigestThreshold ?? 20;

  return prisma.section.create({
    data: {
      code: parsed.data.code.toUpperCase(),
      name: parsed.data.name,
      term,
      teacherId,
      digestThreshold,
      leaderboardVisible: false,
      digestEnabled: true,
    },
  });
}

export async function updateManagedSection(
  sectionId: string,
  rawBody: unknown,
  user: SessionPayload
) {
  await assertSectionAccess(sectionId, user);
  const parsed = updateSectionSettingsSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues[0]?.message || "Invalid section settings."),
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.leaderboardVisible !== undefined)
    data.leaderboardVisible = parsed.data.leaderboardVisible;
  if (parsed.data.digestEnabled !== undefined)
    data.digestEnabled = parsed.data.digestEnabled;
  if (parsed.data.digestThreshold !== undefined)
    data.digestThreshold = parsed.data.digestThreshold;
  if (parsed.data.code !== undefined) data.code = parsed.data.code.toUpperCase();
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.term !== undefined) data.term = parsed.data.term;
  if (user.role === "ADMIN" && parsed.data.teacherId !== undefined)
    data.teacherId = parsed.data.teacherId?.trim() || null;

  return prisma.section.update({
    where: { id: sectionId },
    data,
  });
}

export async function createManagedQuest(
  rawBody: unknown,
  user: SessionPayload
) {
  const parsed = questPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues[0]?.message || "Invalid quest fields."),
      { status: 400 }
    );
  }

  await assertSectionAccess(parsed.data.sectionId, user);

  let openlearningUrl = parsed.data.openlearningUrl?.trim() || null;
  if (openlearningUrl) {
    const check = validateSubmissionUrl(openlearningUrl);
    if (!check.valid) {
      throw Object.assign(new Error(check.error || "Invalid URL"), { status: 400 });
    }
    openlearningUrl = check.normalizedUrl;
  }

  const maxQuest = await prisma.quest.findFirst({
    where: { sectionId: parsed.data.sectionId },
    orderBy: { taskNumber: "desc" },
    select: { taskNumber: true },
  });

  const taskNumber = parsed.data.taskNumber ?? (maxQuest?.taskNumber ?? 0) + 1;
  if (parsed.data.taskNumber !== undefined) {
    const clash = await prisma.quest.findFirst({
      where: { sectionId: parsed.data.sectionId, taskNumber },
      select: { id: true },
    });
    if (clash) {
      throw clientError(
        `Task #${taskNumber} already exists in this section. Pick another number.`,
        409
      );
    }
  }

  const startDate = parseOptionalDate(parsed.data.startDate, "Start date");
  const deadline = parseOptionalDate(parsed.data.deadline, "Deadline");
  assertDateOrder(startDate, deadline);

  return prisma.quest.create({
    data: {
      sectionId: parsed.data.sectionId,
      taskNumber,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      openlearningUrl,
      startDate,
      deadline,
    },
  });
}

export async function updateManagedQuest(
  questId: string,
  rawBody: unknown,
  user: SessionPayload
) {
  const existing = await prisma.quest.findUnique({ where: { id: questId } });
  if (!existing) {
    throw Object.assign(new Error("Quest not found."), { status: 404 });
  }
  await assertSectionAccess(existing.sectionId, user);

  const parsed = questPayloadSchema
    .omit({ sectionId: true })
    .partial()
    .safeParse(rawBody);
  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues[0]?.message || "Invalid quest update."),
      { status: 400 }
    );
  }

  let openlearningUrl = existing.openlearningUrl;
  if (parsed.data.openlearningUrl !== undefined) {
    const trimmed = parsed.data.openlearningUrl?.trim() || null;
    if (trimmed) {
      const check = validateSubmissionUrl(trimmed);
      if (!check.valid) {
        throw Object.assign(new Error(check.error || "Invalid URL"), { status: 400 });
      }
      openlearningUrl = check.normalizedUrl;
    } else {
      openlearningUrl = null;
    }
  }

  const startDate =
    parsed.data.startDate !== undefined
      ? parseOptionalDate(parsed.data.startDate, "Start date")
      : existing.startDate;
  const deadline =
    parsed.data.deadline !== undefined
      ? parseOptionalDate(parsed.data.deadline, "Deadline")
      : existing.deadline;
  assertDateOrder(startDate, deadline);

  return prisma.quest.update({
    where: { id: questId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description,
      }),
      ...(parsed.data.category !== undefined && {
        category: parsed.data.category,
      }),
      ...(parsed.data.openlearningUrl !== undefined && { openlearningUrl }),
      ...(parsed.data.startDate !== undefined && { startDate }),
      ...(parsed.data.deadline !== undefined && { deadline }),
    },
  });
}

export async function reorderManagedQuest(
  questId: string,
  direction: "UP" | "DOWN",
  user: SessionPayload
) {
  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest) {
    throw Object.assign(new Error("Quest not found."), { status: 404 });
  }
  await assertSectionAccess(quest.sectionId, user);

  const sibling = await prisma.quest.findFirst({
    where: {
      sectionId: quest.sectionId,
      taskNumber:
        direction === "UP"
          ? { lt: quest.taskNumber }
          : { gt: quest.taskNumber },
    },
    orderBy: { taskNumber: direction === "UP" ? "desc" : "asc" },
  });

  if (!sibling) return { swapped: false };

  await prisma.$transaction(async (tx) => {
    await tx.quest.update({
      where: { id: quest.id },
      data: { taskNumber: -9999 },
    });
    await tx.quest.update({
      where: { id: sibling.id },
      data: { taskNumber: quest.taskNumber },
    });
    await tx.quest.update({
      where: { id: quest.id },
      data: { taskNumber: sibling.taskNumber },
    });
  });

  return { swapped: true };
}

export async function deleteManagedQuest(questId: string, user: SessionPayload) {
  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest) {
    throw Object.assign(new Error("Quest not found."), { status: 404 });
  }
  await assertSectionAccess(quest.sectionId, user);

  await prisma.$transaction(async (tx) => {
    await tx.quest.delete({ where: { id: questId } });
    const remaining = await tx.quest.findMany({
      where: { sectionId: quest.sectionId },
      orderBy: { taskNumber: "asc" },
    });
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].taskNumber !== i + 1) {
        await tx.quest.update({
          where: { id: remaining[i].id },
          data: { taskNumber: i + 1 },
        });
      }
    }
  });

  return { deleted: true };
}

export async function reviewOrStampSubmission(
  rawBody: unknown,
  user: SessionPayload
) {
  const parsed = reviewSubmissionSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues[0]?.message || "Invalid review payload."),
      { status: 400 }
    );
  }

  const { questId, studentId, action, teacherFeedback, submissionUrl } =
    parsed.data;

  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest) {
    throw Object.assign(new Error("Quest not found."), { status: 404 });
  }
  await assertSectionAccess(quest.sectionId, user);

  // Teachers can't edit a student's link through review; still reject a malformed one.
  const trimmedUrl = submissionUrl?.trim();
  if (trimmedUrl) {
    const check = validateSubmissionUrl(trimmedUrl);
    if (!check.valid) {
      throw Object.assign(new Error(check.error || "Invalid URL"), { status: 400 });
    }
  }

  const existing = await prisma.submission.findUnique({
    where: { questId_studentId: { questId, studentId } },
  });

  if (action === "STAMP" || action === "NEEDS_REVISION") {
    if (
      !existing ||
      existing.status === "NOT_STARTED" ||
      !existing.submissionUrl?.trim()
    ) {
      throw Object.assign(
        new Error(
          "Cannot stamp this task yet because the student has not submitted an OpenLearning link."
        ),
        { status: 400 }
      );
    }
  }

  if (action === "STAMP" && existing?.status === "STAMPED") {
    throw Object.assign(
      new Error("This task has already been stamped."),
      { status: 409 }
    );
  }

  const now = new Date();

  if (action === "STAMP" && existing) {
    return prisma.submission.update({
      where: { id: existing.id },
      data: {
        status: "STAMPED",
        teacherFeedback: teacherFeedback ?? existing.teacherFeedback ?? null,
        firstSubmittedAt: existing.firstSubmittedAt ?? existing.submittedAt ?? now,
        submittedAt: existing.submittedAt ?? now,
        stampedAt: now,
        stampedById: user.userId,
        includedInDigest: true,
      },
    });
  }

  if (action === "NEEDS_REVISION" && existing) {
    return prisma.submission.update({
      where: { id: existing.id },
      data: {
        status: "NEEDS_REVISION",
        teacherFeedback:
          teacherFeedback?.trim() || "Please revise your submission and resubmit.",
        stampedAt: null,
        stampedById: null,
        includedInDigest: true,
      },
    });
  }

  // RESET
  if (existing) {
    return prisma.submission.update({
      where: { id: existing.id },
      data: {
        status: "NOT_STARTED",
        submissionUrl: null,
        studentNote: null,
        firstSubmittedAt: null,
        submittedAt: null,
        stampedAt: null,
        stampedById: null,
        teacherFeedback: null,
        includedInDigest: true,
      },
    });
  }
  return null;
}

/**
 * Student submit / resubmit (POST /api/submissions on the student portal).
 * - firstSubmittedAt is locked on the first submission and preserved on resubmits
 *   (speed-leaderboard fairness).
 * - includedInDigest resets to false so the resubmission is picked up by the next digest.
 * - STAMPED submissions are final (409).
 * Throws errors carrying `status` (see toWorkspaceError).
 */
export async function submitStudentQuest(params: {
  studentUserId: string;
  rawBody: unknown;
  /**
   * Runs the threshold-digest check outside the request (the student route passes
   * Next's `after`), so the student never waits on SMTP/Resend. Default: run inline.
   */
  scheduleDigestCheck?: (task: () => Promise<void>) => void;
}) {
  const parsed = submitQuestSchema.safeParse(params.rawBody);
  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues[0]?.message || "Invalid submission data."),
      { status: 400 }
    );
  }

  const urlCheck = validateSubmissionUrl(parsed.data.submissionUrl);
  if (!urlCheck.valid || !urlCheck.normalizedUrl) {
    throw Object.assign(new Error(urlCheck.error || "Please enter a valid URL."), {
      status: 400,
    });
  }

  const quest = await prisma.quest.findUnique({
    where: { id: parsed.data.questId },
  });
  if (!quest) {
    throw Object.assign(new Error("Quest not found."), { status: 404 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_sectionId: {
        studentId: params.studentUserId,
        sectionId: quest.sectionId,
      },
    },
  });
  if (!enrollment) {
    throw Object.assign(
      new Error("You are not enrolled in this quest's section."),
      { status: 403 }
    );
  }

  const existing = await prisma.submission.findUnique({
    where: {
      questId_studentId: {
        questId: quest.id,
        studentId: params.studentUserId,
      },
    },
  });

  if (existing?.status === "STAMPED") {
    throw Object.assign(
      new Error(
        "This quest has already been stamped and verified by your instructor."
      ),
      { status: 409 }
    );
  }

  const now = new Date();
  const studentNote = parsed.data.studentNote?.trim() || null;
  const submission = await prisma.submission.upsert({
    where: {
      questId_studentId: {
        questId: quest.id,
        studentId: params.studentUserId,
      },
    },
    update: {
      submissionUrl: urlCheck.normalizedUrl,
      studentNote,
      status: "PENDING_REVIEW",
      firstSubmittedAt: existing?.firstSubmittedAt ?? now,
      submittedAt: now,
      includedInDigest: false,
    },
    create: {
      questId: quest.id,
      studentId: params.studentUserId,
      submissionUrl: urlCheck.normalizedUrl,
      studentNote,
      status: "PENDING_REVIEW",
      firstSubmittedAt: now,
      submittedAt: now,
      includedInDigest: false,
    },
  });

  const digestCheck = () => maybeTriggerThresholdDigest(quest.sectionId);
  if (params.scheduleDigestCheck) params.scheduleDigestCheck(digestCheck);
  else await digestCheck();

  return { urlCheck, submission };
}

export async function createOrEnrollStudent(
  rawBody: unknown,
  user: SessionPayload
) {
  const parsed = createStudentSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues[0]?.message || "Invalid student details."),
      { status: 400 }
    );
  }

  const {
    sectionId,
    studentId,
    firstName,
    middleName,
    lastName,
    courseCode,
    email,
    defaultPassword,
  } = parsed.data;

  await assertSectionAccess(sectionId, user);

  const allowedDomain = await getAllowedStudentDomain();
  if (email.split("@")[1] !== allowedDomain) {
    throw clientError(`Student emails must use @${allowedDomain}.`);
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  const existingByNumber = await prisma.user.findUnique({
    where: { studentId },
  });

  // An existing account is only linked when the Student ID *and* the APC email both
  // point at it. A partial match is usually a typo, and linking on it would enroll (and
  // hand roster control over) a different student.
  if (existingByEmail || existingByNumber) {
    if (existingByEmail && existingByNumber && existingByEmail.id !== existingByNumber.id) {
      throw clientError("Student ID and APC email belong to different existing accounts.", 409);
    }
    if (!existingByNumber) {
      throw clientError(
        "This APC email is already registered with a different Student ID. Check both values, or ask an administrator to correct the existing account.",
        409
      );
    }
    if (!existingByEmail) {
      throw clientError(
        "This Student ID is already registered to a different APC email. Check both values, or ask an administrator to correct the existing account.",
        409
      );
    }
  }

  let studentUser = existingByEmail;
  let created = false;
  const assignedPassword =
    defaultPassword || generateDefaultPassword(studentId);

  if (!studentUser) {
    const hash = await hashPassword(assignedPassword);
    studentUser = await prisma.user.create({
      data: {
        studentId,
        firstName,
        middleName: middleName || null,
        lastName,
        courseCode: courseCode || null,
        email,
        passwordHash: hash,
        role: "STUDENT",
        mustChangePassword: true,
        isActive: true,
      },
    });
    created = true;
  } else if (studentUser.role !== "STUDENT") {
    throw Object.assign(
      new Error(`Account ${studentUser.email} already exists as ${studentUser.role}.`),
      { status: 409 }
    );
  }

  await prisma.enrollment.upsert({
    where: {
      studentId_sectionId: { studentId: studentUser.id, sectionId },
    },
    update: {},
    create: {
      studentId: studentUser.id,
      sectionId,
    },
  });

  return {
    created,
    defaultPassword: created ? assignedPassword : null,
    student: {
      id: studentUser.id,
      studentId: studentUser.studentId,
      firstName: studentUser.firstName,
      lastName: studentUser.lastName,
      email: studentUser.email,
      courseCode: studentUser.courseCode,
    },
  };
}

export async function bulkImportStudentsForSection(params: {
  sectionId: string;
  fileBuffer: Buffer;
  filename: string;
  fallbackPassword?: string;
  user: SessionPayload;
}) {
  await assertSectionAccess(params.sectionId, params.user);
  const parsed = await parseStudentImportFile(params.fileBuffer, params.filename);

  let createdCount = 0;
  let enrolledExistingCount = 0;
  // Rows the parser already rejected (missing fields, bad email) count as skipped too.
  let skippedCount = parsed.errors.length;
  const rowErrors = [...parsed.errors];

  for (const row of parsed.rows) {
    try {
      const res = await createOrEnrollStudent(
        {
          sectionId: params.sectionId,
          studentId: row.studentId,
          firstName: row.firstName,
          middleName: row.middleName,
          lastName: row.lastName,
          courseCode: row.courseCode,
          email: row.email,
          defaultPassword:
            row.password || params.fallbackPassword || undefined,
        },
        params.user
      );
      if (res.created) createdCount += 1;
      else enrolledExistingCount += 1;
    } catch (err) {
      skippedCount += 1;
      rowErrors.push({
        rowNumber: row.rowNumber,
        message: `${row.email}: ${toWorkspaceError(err).message}`,
      });
    }
  }

  return {
    totalParsed: parsed.rows.length + parsed.errors.length,
    createdCount,
    enrolledExistingCount,
    skippedCount,
    errors: rowErrors.sort((a, b) => a.rowNumber - b.rowNumber),
  };
}

export async function resetManagedUserPassword(params: {
  targetUserId: string;
  newPassword: string;
  actor: SessionPayload;
  sectionId?: string;
}) {
  if (params.newPassword.length < 6) {
    throw Object.assign(
      new Error("Temporary password must be at least 6 characters."),
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: params.targetUserId },
  });
  if (!target) {
    throw Object.assign(new Error("User not found."), { status: 404 });
  }

  if ((params.actor.role as RoleValue) !== "ADMIN") {
    if (target.role !== "STUDENT") {
      throw clientError("Teachers can only reset passwords for student accounts.", 403);
    }
    const scope = await getStudentScopeForTeacher(target.id, params.actor);
    if (!scope.inMySection) {
      throw clientError("Student is not enrolled in one of your sections.", 403);
    }
    if (scope.shared) {
      throw clientError(
        "This student is also enrolled in another section, so only an administrator can reset their password.",
        403
      );
    }
  }

  const passwordHash = await hashPassword(params.newPassword);
  await prisma.user.update({
    where: { id: target.id },
    data: {
      passwordHash,
      mustChangePassword: true,
    },
  });

  return { ok: true };
}

export async function removeStudentFromSection(params: {
  sectionId: string;
  studentId: string;
  user: SessionPayload;
}) {
  await assertSectionAccess(params.sectionId, params.user);
  await prisma.enrollment.deleteMany({
    where: { sectionId: params.sectionId, studentId: params.studentId },
  });
  return { removed: true };
}

export async function deleteManagedSection(
  sectionId: string,
  user: SessionPayload
) {
  await assertSectionAccess(sectionId, user);
  await prisma.section.delete({ where: { id: sectionId } });
  return { deleted: true };
}

export async function updateManagedStudent(params: {
  studentUserId: string;
  rawBody: unknown;
  actor: SessionPayload;
}) {
  const parsed = updateStudentSchema.safeParse(params.rawBody);
  if (!parsed.success) {
    throw Object.assign(
      new Error(parsed.error.issues[0]?.message || "Invalid student update payload."),
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: params.studentUserId },
  });
  if (!target) {
    throw Object.assign(new Error("Student account not found."), { status: 404 });
  }

  if ((params.actor.role as RoleValue) !== "ADMIN") {
    if (target.role !== "STUDENT") {
      throw clientError("Teachers can only edit student accounts.", 403);
    }
    const scope = await getStudentScopeForTeacher(target.id, params.actor);
    if (!scope.inMySection) {
      throw clientError("Student is not enrolled in one of your sections.", 403);
    }
    const changesIdentity =
      (parsed.data.email !== undefined && parsed.data.email !== target.email) ||
      (parsed.data.studentId !== undefined &&
        (parsed.data.studentId || null) !== target.studentId);
    if (scope.shared && changesIdentity) {
      throw clientError(
        "This student is also enrolled in another section, so only an administrator can change their APC email or Student ID.",
        403
      );
    }
    if (parsed.data.email !== undefined && parsed.data.email !== target.email) {
      const allowedDomain = await getAllowedStudentDomain();
      if (parsed.data.email.split("@")[1] !== allowedDomain) {
        throw clientError(`Student emails must use @${allowedDomain}.`);
      }
    }
  }

  if (parsed.data.email && parsed.data.email !== target.email) {
    const emailConflict = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (emailConflict && emailConflict.id !== target.id) {
      throw Object.assign(
        new Error(`Email ${parsed.data.email} is already in use by another account.`),
        { status: 409 }
      );
    }
  }

  if (
    parsed.data.studentId !== undefined &&
    parsed.data.studentId &&
    parsed.data.studentId !== target.studentId
  ) {
    const idConflict = await prisma.user.findUnique({
      where: { studentId: parsed.data.studentId },
    });
    if (idConflict && idConflict.id !== target.id) {
      throw Object.assign(
        new Error(
          `Student ID ${parsed.data.studentId} is already assigned to another student.`
        ),
        { status: 409 }
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(parsed.data.studentId !== undefined && {
        studentId: parsed.data.studentId || null,
      }),
      ...(parsed.data.firstName !== undefined && {
        firstName: parsed.data.firstName,
      }),
      ...(parsed.data.middleName !== undefined && {
        middleName: parsed.data.middleName || null,
      }),
      ...(parsed.data.lastName !== undefined && {
        lastName: parsed.data.lastName,
      }),
      ...(parsed.data.courseCode !== undefined && {
        courseCode: parsed.data.courseCode || null,
      }),
      ...(parsed.data.email !== undefined && { email: parsed.data.email }),
    },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      middleName: true,
      lastName: true,
      courseCode: true,
      email: true,
    },
  });

  return { student: updated };
}

export async function updateEnrollmentTrack(params: {
  sectionId: string;
  studentIds: string[];
  finalsTrack: "UNDECIDED" | "SYSTEM" | "OPENLEARNING_MODULE";
  assignedModuleTitle?: string | null;
  assignedModuleUrl?: string | null;
  user: SessionPayload;
}) {
  await assertSectionAccess(params.sectionId, params.user);

  const title =
    params.finalsTrack === "OPENLEARNING_MODULE"
      ? params.assignedModuleTitle?.trim() || null
      : null;
  let url =
    params.finalsTrack === "OPENLEARNING_MODULE"
      ? params.assignedModuleUrl?.trim() || null
      : null;
  if (url) {
    const check = validateSubmissionUrl(url);
    if (!check.valid || !check.normalizedUrl) {
      throw clientError(check.error || "Enter a valid module link (https://...).");
    }
    url = check.normalizedUrl;
  }

  const { count } = await prisma.enrollment.updateMany({
    where: {
      sectionId: params.sectionId,
      studentId: { in: params.studentIds },
    },
    data: {
      finalsTrack: params.finalsTrack,
      assignedModuleTitle: title,
      assignedModuleUrl: url,
    },
  });

  return {
    success: true,
    count,
    finalsTrack: params.finalsTrack,
    assignedModuleTitle: title,
    assignedModuleUrl: url,
  };
}

/**
 * Student picks their Finals track (POST /api/finals-track on the student portal).
 * Only `finalsTrack` changes: a module the teacher assigned stays on the enrollment,
 * so switching SYSTEM -> back to the module track doesn't lose it.
 */
export async function chooseStudentFinalsTrack(params: {
  studentUserId: string;
  sectionId: string;
  finalsTrack: "SYSTEM" | "OPENLEARNING_MODULE";
}) {
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_sectionId: { studentId: params.studentUserId, sectionId: params.sectionId },
    },
  });
  if (!enrollment) throw clientError("You are not enrolled in this section.", 404);

  const updated = await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { finalsTrack: params.finalsTrack },
  });
  return {
    track: updated.finalsTrack,
    assignedModuleTitle: updated.assignedModuleTitle,
    assignedModuleUrl: updated.assignedModuleUrl,
  };
}

export async function exportSectionTrackerFile(params: {
  sectionId: string;
  format: "xlsx" | "csv";
  user: SessionPayload;
}) {
  const workspace = await getSectionWorkspaceData(params.sectionId, params.user);

  if (params.format === "csv") {
    const csv = generateTrackerCsv({
      quests: workspace.quests,
      students: workspace.students,
      submissions: workspace.submissions,
    });
    return {
      contentType: "text/csv; charset=utf-8",
      filename: `${workspace.section.code}_Task_Tracker.csv`,
      data: Buffer.from(csv, "utf-8"),
    };
  }

  const buffer = await generateTrackerWorkbook({
    sectionCode: workspace.section.code,
    sectionName: workspace.section.name,
    term: workspace.section.term,
    quests: workspace.quests,
    students: workspace.students,
    submissions: workspace.submissions,
  });

  return {
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `${workspace.section.code}_Task_Tracker.xlsx`,
    data: buffer,
  };
}

/** Full HTML of one sent/preview digest, for the teacher's "View email" modal. */
export async function getDigestLogPreview(
  sectionId: string,
  logId: string,
  user: SessionPayload
) {
  await assertSectionAccess(sectionId, user);
  const log = await prisma.emailDigestLog.findUnique({ where: { id: logId } });
  if (!log || log.sectionId !== sectionId) {
    throw Object.assign(new Error("Digest log not found."), { status: 404 });
  }
  return { id: log.id, subject: log.subject, html: log.htmlPreview };
}

export async function triggerManualSectionDigest(
  sectionId: string,
  user: SessionPayload
) {
  await assertSectionAccess(sectionId, user);
  return sendSectionDigest(sectionId, "MANUAL");
}
